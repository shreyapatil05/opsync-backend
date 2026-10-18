import User from '../models/User.js'
import Team from '../models/Team.js'

export const getAllUsers = async (req , res) =>{
    try{
        const users = await User.find().select('-password').populate('teamId');
        res.json(users);
    }
    catch(error){
        res.status(500).json({ error: error.message })
    }
};

export const searchUsers = async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const users = await User.find({
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } }
      ],
      _id: { $ne: req.user.id } 
    })
    .select('name email avatar role')
    .limit(10);

    res.json(users);
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
};

export const createUser = async(req ,res) => {
    try{
        const{ name, email, password, role,teamId } = req.body;
        const user = new User({ name, email, password, role, teamId });
        await user.save();
        await user.populate('teamId');
        const safeUser = user.toObject();
        delete safeUser.password;
        res.status(201).json(safeUser);
    }
    catch(error){
        res.status(500).json({ error: error.message })
    }
};

export const getUser = async (req, res) =>{
    try{
        const user = await User.findById(req.params.id).select('-password').populate('teamId');
        if(!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    }
    catch(error){
        res.status(500).json({ error: error.message })
    }
};

export const updateUser = async (req , res) => {
    try{
        const isSelf = req.user.id === req.params.id;
        const isAdmin = req.user.role === 'Admin';

        if (!isSelf && !isAdmin) {
            return res.status(403).json({ error: 'You can only update your own profile' });
        }

        const allowedUpdates = {};
        if (req.body.name !== undefined) allowedUpdates.name = req.body.name;

        // Only administrators may change authorization or team membership.
        if (isAdmin) {
            if (req.body.role !== undefined) allowedUpdates.role = req.body.role;
            if (req.body.teamId !== undefined) allowedUpdates.teamId = req.body.teamId;
        }

        if (Object.keys(allowedUpdates).length === 0) {
            return res.status(400).json({ error: 'No permitted fields supplied' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            allowedUpdates,
            { new: true, runValidators: true }
        ).select('-password').populate('teamId');

        if(!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    }
    catch(error){
        res.status(500).json({ error: error.message })
    }
};

export const deleteUser = async (req , res) => {
    try{
        const user = await User.findByIdAndDelete(req.params.id);
        if(!user) return res.status(404).json({ error: 'User not found' });
        res.json({ message: ' User deleted' });
    }
    catch(error){
        res.status(500).json({ error: error.message });
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
    console.log('Admin:', team.admin?.name);

    
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
