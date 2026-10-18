import Team from '../models/Team.js';
import User from '../models/User.js';
import Conversation from '../models/Conversation.js';
import { canReadTeam } from '../policies/teamPolicy.js';
import { addMemberAndSyncConversation, removeMemberAndSyncConversation } from '../services/teamService.js';


export const getUserTeams = async (req, res) => {
  try {
    const userId = req.user.id;
    
    let query = {};
    
    
    if (req.user.role === 'Admin') {
      query = {}; 
    } else {
      query = {
        $or: [
          { admin: userId },
          { members: userId }
        ]
      };
    }
    
    const teams = await Team.find(query)
      .populate('admin', 'name email avatar')
      .populate('members', 'name email avatar')
      .sort({ createdAt: -1 });

    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
};


export const createTeam = async (req, res) => {
  try {
    const { name } = req.body;

    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can create teams' });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const team = new Team({
      name: name.trim(),
      admin: req.user.id,
      members: []
    });

    await team.save();
    await team.populate('admin', 'name email avatar');

    res.status(201).json(team);
  } catch (error) {
    console.error('Create team error:', error);
    res.status(500).json({ error: 'Failed to create team' });
  }
};

export const getTeam = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id)
      .populate('admin', 'name email avatar')
      .populate('members', 'name email avatar');

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    
    if (!canReadTeam(team, req.user)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(team);
  } catch (error) {
    console.error('Get team error:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
};


export const addTeamMember = async (req, res) => {
  try {
    const teamId = req.params.id; 
    const { email } = req.body;
    
   
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can add team members' });
    }

    
    const newMember = await User.findOne({ email });
    if (!newMember) {
      return res.status(404).json({ error: 'User not found with that email' });
    }
    const userId = newMember._id;

    
    const team = await addMemberAndSyncConversation(teamId, userId);
    if (!team) return res.status(400).json({ error: 'Team not found or user is already a member/admin' });

    await team.populate('admin', 'name email avatar');
    await team.populate('members', 'name email avatar');
    
    res.json({ 
      message: 'Member added successfully',
      team
    });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ error: error.message || 'Failed to add member' });
  }
};


export const getTeamMembers = async (req, res) => {
  try {
    const { teamId } = req.params;

    console.log('Fetching members for team:', teamId);

    const team = await Team.findById(teamId)
      .populate('members', '_id name email avatar role')
      .populate('admin', '_id name email avatar role');

    if (!team) {
      console.log('Team not found:', teamId);
      return res.status(404).json({ error: 'Team not found' });
    }

    console.log('Team found:', team.name);
    console.log('Members count:', team.members?.length || 0);

   
    const allMembers = [
      ...(team.members || []),
      team.admin
    ];

    
    const uniqueMembers = allMembers.filter((member, index, self) =>
      index === self.findIndex(m => m._id.toString() === member._id.toString())
    );

    console.log('Total unique members:', uniqueMembers.length);

    res.json(uniqueMembers);
  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const removeTeamMember = async (req, res) => {
  try {
    const teamId = req.params.id;
    const userIdToRemove = req.params.userId;

    
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can remove team members' });
    }

    const team = await removeMemberAndSyncConversation(teamId, userIdToRemove);
    if (!team) return res.status(404).json({ error: 'Team not found or member cannot be removed' });

    await team.populate('admin', 'name email avatar');
    await team.populate('members', 'name email avatar');

    res.json(team);
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
};


export const updateTeam = async (req, res) => {
  try {
    const { name } = req.body;
    const { id } = req.params;
    const { user } = req;

    
    if (user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can update teams' });
    }

   
    const existingTeam = await Team.findById(id);
    if (!existingTeam) {
      return res.status(404).json({ error: 'Team not found' });
    }

    
    if (existingTeam.admin.toString() !== user.id) {
      return res.status(403).json({ error: 'Only the team admin can update this team' });
    }

    const team = await Team.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true, runValidators: true }
    )
      .populate('admin', '_id name email avatar')
      .populate('members', '_id name email avatar role department');
    
    res.json(team);
  } catch (error) {
    console.error('Update team error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const deleteTeam = async (req, res) => {
  try {
    
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can delete teams' });
    }

    const team = await Team.findById(req.params.id);

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

   
    await Team.findByIdAndDelete(req.params.id);
    
    
    await Conversation.deleteOne({
      type: 'team',
      teamId: req.params.id
    });

    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Delete team error:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
};
