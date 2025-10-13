import Project from '../models/Project.js';
import Task from '../models/Task.js';
import User from '../models/User.js';
import Team from '../models/Team.js';
import bcrypt from 'bcryptjs';

export const getMetrics = async (req, res) => {
  try {
    const [
      totalProjects,
      ongoingTasks,
      completedTasks,
      totalUsers,
      totalTeams
    ] = await Promise.all([
      Project.countDocuments(),
      Task.countDocuments({ status: { $in: ['in-progress', 'todo'] } }),
      Task.countDocuments({ status: 'done' }),
      User.countDocuments(),
      Team.countDocuments()
    ]);

    res.json([
      { 
        key: 'totalProjects', 
        title: 'Total Projects', 
        value: totalProjects.toString(),
        trend: `${totalProjects} active projects`
      },
      { 
        key: 'ongoingTasks', 
        title: 'Ongoing Tasks', 
        value: ongoingTasks.toString(),
        trend: `${completedTasks} completed`
      },
      { 
        key: 'completedTasks', 
        title: 'Completed Tasks', 
        value: completedTasks.toString(),
        trend: `${ongoingTasks} in progress`
      },
      { 
        key: 'totalUsers', 
        title: 'Total Users', 
        value: totalUsers.toString(),
        trend: `${totalTeams} teams`
      }
    ]);
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getProjects = async (req, res) => {
  try {
    const projects = await Project.find()
      .populate('createdBy', 'name')
      .select('name progress status createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    const taskStats = await Task.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      projects: projects.map(project => ({
        _id: project._id,
        name: project.name,
        progress: project.progress || 0,
        status: project.status
      })),
      completionStats: taskStats.map(stat => ({
        name: stat._id === 'done' ? 'Completed' : stat._id === 'in-progress' ? 'In Progress' : 'To Do',
        value: stat.count,
        color: getColorForStatus(stat._id)
      }))
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getActivities = async (req, res) => {
  try {
    const recentActivities = await generateRecentActivities();
    res.json(recentActivities);
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const addEmployee = async (req, res) => {
  try {
    const { name, email, password, role, teamId } = req.body;

   
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    
    const newUser = new User({
      name,
      email: email.toLowerCase(),
      password, 
      role: role || 'Employee',
      teamId: teamId || null
    });

    await newUser.save();

  
    if (teamId) {
      await Team.findByIdAndUpdate(
        teamId,
        { $addToSet: { members: newUser._id } },
        { new: true }
      );
    }

    
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      message: 'Employee added successfully',
      user: userResponse
    });
  } catch (error) {
    console.error('Add employee error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const getAllEmployees = async (req, res) => {
  try {
    const employees = await User.find({ role: { $ne: 'Admin' } })
      .select('_id name email role teamId createdAt')
      .populate('teamId', '_id name')
      .sort({ createdAt: -1 });

    res.json(employees);
  } catch (error) {
    console.error('Get employees error:', error);
    res.status(500).json({ error: error.message });
  }
};


export const getAllTeams = async (req, res) => {
  try {
    const teams = await Team.find()
      .select('_id name')
      .sort({ name: 1 });

    res.json(teams);
  } catch (error) {
    console.error('Get teams error:', error);
    res.status(500).json({ error: error.message });
  }
};


const generateRecentActivities = async () => {
  try {
    const activities = [];

    const recentProjects = await Project.find()
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(3);

    const recentTasks = await Task.find()
      .populate('assignee', 'name')
      .sort({ updatedAt: -1 })
      .limit(3);

    const recentUsers = await User.find()
      .sort({ createdAt: -1 })
      .limit(2);

    recentProjects.forEach(project => {
      activities.push({
        _id: project._id,
        user: { name: project.createdBy?.name || 'System' },
        action: 'created project',
        item: project.name,
        timestamp: project.createdAt
      });
    });

    recentTasks.forEach(task => {
      const action = task.status === 'done' ? 'completed task' : 
                    task.status === 'in-progress' ? 'started task' : 'created task';
      
      activities.push({
        _id: task._id,
        user: { name: task.assignee?.name || 'Unassigned' },
        action: action,
        item: task.title,
        timestamp: task.updatedAt
      });
    });

    recentUsers.forEach(user => {
      activities.push({
        _id: user._id,
        user: { name: 'System' },
        action: 'created user account',
        item: user.name,
        timestamp: user.createdAt
      });
    });

    return activities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);

  } catch (error) {
    console.error('Error generating activities:', error);
    return [];
  }
};

function getColorForStatus(status) {
  const colors = {
    'done': '#22c55e',
    'in-progress': '#3b82f6',
    'todo': '#f59e0b'
  };
  return colors[status] || '#6b7280';
}