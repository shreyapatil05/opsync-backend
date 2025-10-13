import Project from '../models/Project.js';
import Task from '../models/Task.js';
import Team from '../models/Team.js';
import User from '../models/User.js'; 


export const getProjects = async (req, res) => {
  try {
    const { user } = req;
    
    let query = {};
    
    if (user.role === 'Admin') {
      
      query = {};
    } else {
      
      const userTeams = await Team.find({
        $or: [
          { admin: user.id },
          { members: user.id }
        ]
      }).select('_id');
      
      const teamIds = userTeams.map(team => team._id);
      
      query = {
        $or: [
          { createdBy: user.id }, 
          { projectManager: user.id }, 
          { assignedMembers: user.id }, 
          { teamId: { $in: teamIds } } 
        ]
      };
    }
    
    const projects = await Project.find(query)
      .populate('teamId', '_id name')
      .populate('createdBy', '_id name')
      .populate('projectManager', '_id name email avatar')
      .sort({ createdAt: -1 });
    
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const createProject = async (req, res) => {
  try {
    const { name, description, teamId, projectManager, additionalMembers } = req.body;
    const { user } = req;

    if (user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can create projects' });
    }

    let finalTeamId = null;
    let finalProjectManager = null;
    let assignedMembers = [];

   
    if (teamId) {
      const team = await Team.findById(teamId).populate('admin').populate('members');
      if (!team) {
        return res.status(404).json({ error: 'Team not found' });
      }
      finalTeamId = teamId;
      
      assignedMembers.push(team.admin._id);
      assignedMembers.push(...team.members.map(member => member._id));
      
     
      assignedMembers = [...new Set(assignedMembers.map(id => id.toString()))];
    }

    
    if (projectManager) {
      const manager = await User.findById(projectManager);
      if (!manager) {
        return res.status(404).json({ error: 'Project manager not found' });
      }
      
     
      if (finalTeamId) {
        const team = await Team.findById(finalTeamId);
        const isInTeam = team.admin.toString() === projectManager || 
                         team.members.some(member => member.toString() === projectManager);
        if (!isInTeam) {
          return res.status(400).json({ error: 'Project manager must be a member of the selected team' });
        }
      }
      
      finalProjectManager = projectManager;
    }

    
    if (additionalMembers && Array.isArray(additionalMembers)) {
      assignedMembers.push(...additionalMembers);
      
      assignedMembers = [...new Set(assignedMembers.map(id => id.toString()))];
    }

    const project = new Project({ 
      name, 
      description, 
      teamId: finalTeamId,
      projectManager: finalProjectManager,
      createdBy: user.id,
      assignedMembers: assignedMembers 
    });
    
    await project.save();
    await project.populate('teamId', '_id name');
    await project.populate('createdBy', '_id name');
    await project.populate('projectManager', '_id name email avatar');
    await project.populate('assignedMembers', '_id name email avatar');
    
    res.status(201).json(project);
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const getProject = async (req, res) => {
  try {
    const { user } = req;
    
    let query = {};
    
    if (user.role === 'Admin') {
      
      query = {};
    } else {
      
      const userTeams = await Team.find({
        $or: [
          { admin: user.id },
          { members: user.id }
        ]
      }).select('_id');
      
      const teamIds = userTeams.map(team => team._id);
      
    
      query = {
        $or: [
          { assignedMembers: user.id }, 
          { teamId: { $in: teamIds } }, 
          { projectManager: user.id }, 
          { createdBy: user.id } 
        ]
      };
    }
    
    const projects = await Project.find(query)
      .populate('teamId', '_id name')
      .populate('createdBy', '_id name')
      .populate('projectManager', '_id name email avatar')
      .populate('assignedMembers', '_id name email avatar') 
      .sort({ createdAt: -1 });
    
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const getProjectMembers = async (req, res) => {
  try {
    const userId = req.user.id;
    const { projectId } = req.params;

    
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    
    let hasAccess = false;
    if (req.user.role === 'Admin' || req.user.role === 'Manager') {
      hasAccess = true;
    } else if (project.createdBy.toString() === userId) {
      hasAccess = true;
    } else if (project.teamId) {
      const team = await Team.findOne({
        _id: project.teamId,
        $or: [
          { admin: userId },
          { members: userId }
        ]
      });
      hasAccess = !!team;
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    let members = [];

    
    if (project.teamId) {
      const team = await Team.findById(project.teamId)
        .populate('admin', '_id name email avatar role')
        .populate('members', '_id name email avatar role');

      if (team) {
        
        members = [team.admin, ...team.members];
        
       
        members = members.filter((member, index, self) =>
          index === self.findIndex(m => m._id.toString() === member._id.toString())
        );
      }
    } else {
      
      const creator = await require('../models/User.js').default.findById(project.createdBy)
        .select('_id name email avatar role');
      if (creator) {
        members = [creator];
      }
    }

    res.json(members);
  } catch (error) {
    console.error('Get project members error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const getProjectsForEmployee = async (req, res) => {
  try {
    const userId = req.user.id;

   
    const userTeams = await Team.find({
      $or: [
        { admin: userId },
        { members: userId }
      ]
    }).select('_id');

    const teamIds = userTeams.map(team => team._id);

    const projects = await Project.find({
      $or: [
        { assignedMembers: userId },
        { createdBy: userId }
      ]
    })
    .populate('teamId', '_id name')
    .select('_id name');

    res.json(projects);
  } catch (error) {
    console.error('Get projects for employee error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const updateProject = async (req, res) => {
  try {
    const { name, description, progress, status, teamId, additionalMembers } = req.body;
    const { user } = req;

   
    const existingProject = await Project.findById(req.params.id);
    if (!existingProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    
    let canUpdate = false;
    
    if (user.role === 'Admin' || user.role === 'Manager') {
      canUpdate = true;
    } else if (existingProject.createdBy.toString() === user.id) {
      canUpdate = true;
    } else if (existingProject.teamId) {
      const team = await Team.findOne({
        _id: existingProject.teamId,
        admin: user.id
      });
      canUpdate = !!team;
    }

    if (!canUpdate) {
      return res.status(403).json({ error: 'Access denied' });
    }

   
    const updateData = {};
    
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (progress !== undefined) updateData.progress = progress;
    if (status !== undefined) updateData.status = status;

    if (teamId !== undefined) {
      updateData.teamId = teamId;
      
      let newAssignedMembers = [];
      
      if (teamId && teamId !== 'none' && teamId !== null) {
        
        const team = await Team.findById(teamId).populate('admin').populate('members');
        if (team) {
          newAssignedMembers.push(team.admin._id);
          newAssignedMembers.push(...team.members.map(member => member._id));
        }
      }
      
      
      if (additionalMembers && Array.isArray(additionalMembers)) {
        newAssignedMembers.push(...additionalMembers);
      }
      
      
      newAssignedMembers = [...new Set(newAssignedMembers.map(id => id.toString()))];
      updateData.assignedMembers = newAssignedMembers;
    } else if (additionalMembers !== undefined) {
      
      let currentAssignedMembers = [];
      
      if (existingProject.teamId) {
        const team = await Team.findById(existingProject.teamId).populate('admin').populate('members');
        if (team) {
          currentAssignedMembers.push(team.admin._id);
          currentAssignedMembers.push(...team.members.map(member => member._id));
        }
      }
      
     
      if (additionalMembers && Array.isArray(additionalMembers)) {
        currentAssignedMembers.push(...additionalMembers);
      }
      
     
      currentAssignedMembers = [...new Set(currentAssignedMembers.map(id => id.toString()))];
      updateData.assignedMembers = currentAssignedMembers;
    }

    
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
    .populate('teamId', '_id name')
    .populate('createdBy', '_id name')
    .populate('projectManager', '_id name email avatar')
    .populate('assignedMembers', '_id name email avatar');
    
    res.json(project);
  } catch (error) {
    console.error('Update project error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const deleteProject = async (req, res) => {
  try {
    const { user } = req;
    
    const project = await Project.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    
    let canDelete = false;
    
    if (user.role === 'Admin' || user.role === 'Manager') {
      canDelete = true;
    } else if (project.createdBy.toString() === user.id) {
      canDelete = true;
    } else if (project.teamId) {
      const team = await Team.findOne({
        _id: project.teamId,
        admin: user.id
      });
      canDelete = !!team;
    }

    if (!canDelete) {
      return res.status(403).json({ error: 'Access denied' });
    }

    
    await Project.findByIdAndDelete(req.params.id);
    await Task.deleteMany({ projectId: req.params.id });
    
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const getTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    let query = { projectId };

    
    if (userRole !== 'Admin') {
     
      if (project.projectManager && project.projectManager.toString() === userId) {
        
      }
      
      else if (project.assignedMembers.includes(userId)) {
        query.assignee = userId; 
      }
      
      else if (project.createdBy.toString() === userId && !project.teamId) {
        
      } else {
        
        return res.status(403).json({ error: 'Access denied to this project' });
      }
    }
 
    const tasks = await Task.find(query)
      .populate('assignee', '_id name email avatar')
      .sort({ createdAt: -1 });
    
    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createTask = async (req, res) => {
  try {
    const { title, description, status, assignee, priority, dueDate } = req.body;
    const { projectId } = req.params;
    const { user } = req;

 
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    let canCreateTask = false;

    if (user.role === 'Admin') {
      canCreateTask = true;
    }
    
    else if (project.projectManager && project.projectManager.toString() === user.id) {
      canCreateTask = true;
    }
    
    else if (project.teamId) {
      const team = await Team.findOne({
        _id: project.teamId,
        $or: [
          { admin: user.id },
          { members: user.id }
        ]
      });
      canCreateTask = !!team;
    }
    
    else if (project.createdBy.toString() === user.id) {
      canCreateTask = true;
    }

    if (!canCreateTask) {
      return res.status(403).json({ error: 'You do not have permission to create tasks in this project' });
    }

    
    const task = new Task({ 
      title, 
      description, 
      status, 
      assignee, 
      priority,
      dueDate, 
      projectId 
    });
    
    await task.save();
    await task.populate('assignee', '_id name email avatar');

    
    await Project.findByIdAndUpdate(projectId, { $push: { tasks: task._id } });

    
    if (assignee) {
      await Project.findByIdAndUpdate(
        projectId,
        { $addToSet: { assignedMembers: assignee } }, 
        { new: true }
      );
      console.log(`Added user ${assignee} to project ${projectId} assignedMembers`);
    }

    res.status(201).json(task);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const updateTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const updates = req.body;

    const oldTask = await Task.findById(taskId);
    if (!oldTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

   
    const task = await Task.findByIdAndUpdate(
      taskId,
      updates,
      { new: true, runValidators: true }
    ).populate('assignee', '_id name email avatar');

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    
    if (updates.assignee && updates.assignee !== oldTask.assignee?.toString()) {
      
      if (updates.assignee) {
        await Project.findByIdAndUpdate(
          projectId,
          { $addToSet: { assignedMembers: updates.assignee } }
        );
      }
      
      if (oldTask.assignee) {
        const otherTasksWithAssignee = await Task.countDocuments({
          projectId,
          assignee: oldTask.assignee,
          _id: { $ne: taskId }
        });
        
        if (otherTasksWithAssignee === 0) {
          await Project.findByIdAndUpdate(
            projectId,
            { $pull: { assignedMembers: oldTask.assignee } }
          );
        }
      }
    }

    res.json(task);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const deleteTask = async (req, res) => {
  try {
    const { projectId, taskId } = req.params;

    const task = await Task.findOneAndDelete({ _id: taskId, projectId });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

   
    await Project.findByIdAndUpdate(projectId, { $pull: { tasks: taskId } });

    if (task.assignee) {
      const otherTasksWithAssignee = await Task.countDocuments({
        projectId,
        assignee: task.assignee
      });
      
      if (otherTasksWithAssignee === 0) {
        await Project.findByIdAndUpdate(
          projectId,
          { $pull: { assignedMembers: task.assignee } }
        );
        console.log(`Removed user ${task.assignee} from project ${projectId} assignedMembers`);
      }
    }

    res.json({ message: 'Task deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const getEmployeeProgress = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.query;

    
    const userTasks = await Task.find({ 
      projectId, 
      assignee: userId 
    });

    const totalTasks = userTasks.length;
    const completedTasks = userTasks.filter(task => task.status === 'done').length;
    const inProgressTasks = userTasks.filter(task => task.status === 'in-progress').length;
    const todoTasks = userTasks.filter(task => task.status === 'todo').length;

    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    res.json({
      userId,
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      progress
    });
  } catch (error) {
    console.error('Get employee progress error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const getAllEmployeesProgress = async (req, res) => {
  try {
    const { projectId } = req.params;

    
    const project = await Project.findById(projectId).populate('assignedMembers', '_id name email avatar');
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const employeesProgress = [];

    for (const member of project.assignedMembers) {
      const userTasks = await Task.find({ 
        projectId, 
        assignee: member._id 
      });

      const totalTasks = userTasks.length;
      const completedTasks = userTasks.filter(task => task.status === 'done').length;
      const inProgressTasks = userTasks.filter(task => task.status === 'in-progress').length;
      const todoTasks = userTasks.filter(task => task.status === 'todo').length;

      const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      employeesProgress.push({
        user: {
          _id: member._id,
          name: member.name,
          email: member.email,
          avatar: member.avatar
        },
        totalTasks,
        completedTasks,
        inProgressTasks,
        todoTasks,
        progress
      });
    }

    res.json(employeesProgress);
  } catch (error) {
    console.error('Get all employees progress error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const addEmployeeToProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.body;
    const { user } = req;

   
    if (user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can add employees to projects' });
    }

   
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    
    const employee = await User.findById(userId);
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    
    if (project.assignedMembers.includes(userId)) {
      return res.status(400).json({ error: 'Employee is already assigned to this project' });
    }

    
    await Project.findByIdAndUpdate(
      projectId,
      { $addToSet: { assignedMembers: userId } },
      { new: true }
    );

    
    const updatedProject = await Project.findById(projectId)
      .populate('assignedMembers', '_id name email avatar')
      .populate('projectManager', '_id name email avatar')
      .populate('createdBy', '_id name email avatar');

    res.json({
      message: 'Employee added to project successfully',
      project: updatedProject
    });
  } catch (error) {
    console.error('Add employee to project error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const removeEmployeeFromProject = async (req, res) => {
  try {
    const { projectId, userId } = req.params;
    const { user } = req;

    
    if (user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can remove employees from projects' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (!project.assignedMembers.includes(userId)) {
      return res.status(400).json({ error: 'Employee is not assigned to this project' });
    }

    await Project.findByIdAndUpdate(
      projectId,
      { $pull: { assignedMembers: userId } },
      { new: true }
    );

    await Task.updateMany(
      { projectId, assignee: userId },
      { $unset: { assignee: 1 } }
    );

   
    const updatedProject = await Project.findById(projectId)
      .populate('assignedMembers', '_id name email avatar')
      .populate('projectManager', '_id name email avatar')
      .populate('createdBy', '_id name email avatar');

    res.json({
      message: 'Employee removed from project successfully',
      project: updatedProject
    });
  } catch (error) {
    console.error('Remove employee from project error:', error);
    res.status(500).json({ error: error.message });
  }
};