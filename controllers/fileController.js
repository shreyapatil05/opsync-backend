import { uploadFile, downloadFile, deleteFile } from '../utils/fileStorage.js';
import File from '../models/File.js';
import Project from '../models/Project.js';
import Team from '../models/Team.js';

export const uploadFileController = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const fileRecord = await uploadFile(req.file, req.params.projectId, req.user.id);
    res.status(201).json(fileRecord);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getFilesByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    
    
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    
    let hasAccess = false;
    
    if (req.user.role === 'Admin') {
      hasAccess = true;
    } else {
      
      if (project.teamId) {
        const team = await Team.findOne({
          _id: project.teamId,
          $or: [
            { admin: userId },
            { members: userId }
          ]
        });
        hasAccess = !!team;
      } else if (project.createdBy.toString() === userId) {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    
    const files = await File.find({ projectId })
      .populate('uploader', 'name avatar')
      .sort({ createdAt: -1 });
    
    res.json(files);
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const downloadFileController = async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

   
    res.json({ url: file.url, name: file.name });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteFileController = async (req, res) => {
  try {
    const file = await File.findByIdAndDelete(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    await deleteFile(file.path); 
    res.json({ message: 'File deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};