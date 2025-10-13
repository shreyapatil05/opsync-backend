import Rule from '../models/Rule.js';
import User from '../models/User.js';
import Project from '../models/Project.js';

export const getRules = async (req, res) => {
  try {
    const rules = await Rule.find()
      .populate('createdBy', 'name')
      .populate('projectId', 'name')
      .sort({ createdAt: -1 });
    
    res.json(rules);
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createRule = async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can create rules' });
    }

    const { name, condition, action, projectId } = req.body;

    if (!name || !condition || !action || !projectId) {
      return res.status(400).json({ error: 'All fields are required (name, condition, action, projectId)' });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const rule = new Rule({
      name,
      condition,
      action,
      projectId,
      createdBy: req.user.id,
      isActive: true
    });

    await rule.save();
    await rule.populate('createdBy', 'name');
    await rule.populate('projectId', 'name');

    res.status(201).json(rule);
  } catch (error) {
    console.error('Create rule error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateRule = async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can update rules' });
    }

    const { id } = req.params;
    const updates = req.body;

    const rule = await Rule.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .populate('createdBy', 'name')
      .populate('projectId', 'name');
    
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json(rule);
  } catch (error) {
    console.error('Update rule error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const deleteRule = async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only admins can delete rules' });
    }

    const { id } = req.params;
    
    const rule = await Rule.findByIdAndDelete(id);
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ message: 'Rule deleted successfully' });
  } catch (error) {
    console.error('Delete rule error:', error);
    res.status(500).json({ error: error.message });
  }
};