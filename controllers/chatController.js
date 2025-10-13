import Message from '../models/Message.js';
import cloudinary from 'cloudinary';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import Team from '../models/Team.js';
import Project from '../models/Project.js';
import mongoose from 'mongoose';


export const getConversations = async (req, res) => {
  try {
   
    const userTeams = await Team.find({
      $or: [
        { admin: req.user.id },
        { members: req.user.id }
      ]
    }).select('_id');

    const teamIds = userTeams.map(t => t._id);

    
    const conversations = await Conversation.find({
      $or: [
        
        { participants: req.user.id },
        
        { 
          type: 'team',
          teamId: { $in: teamIds }
        }
      ],
      isActive: true
    })
    .populate('participants', 'name email avatar isOnline')
    .populate('lastMessage')
    .populate('teamId', 'name avatar')
    .populate('projectId', 'name')
    .populate('createdBy', 'name avatar')
    .sort({ updatedAt: -1 })
    .lean();

    console.log(`Found ${conversations.length} conversations for user ${req.user.id}`);

    
    const conversationsWithStatus = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          sender: { $ne: req.user.id },
          readBy: { $ne: req.user.id }
        });

        let isOnline = false;
        if (conv.type === 'direct') {
          const otherParticipant = conv.participants.find(p => 
            p._id.toString() !== req.user.id.toString()
          );
          isOnline = otherParticipant?.isOnline || false;
        }

        return {
          ...conv,
          unreadCount,
          isOnline
        };
      })
    );

    res.json(conversationsWithStatus);
  } catch (error) {
    console.error('Error in getConversations:', error);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
};


export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id; 

   
    const conversation = await Conversation.findById(conversationId).populate('teamId');

    if (!conversation) {
     
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const isDirectParticipant = conversation.participants.some(
      p => p.toString() === userId.toString()
    );

    let isTeamMember = false;
    
    if (conversation.type === 'team' && conversation.teamId) {
      const team = await Team.findOne({
        _id: conversation.teamId,
        $or: [
          { admin: userId },
          { members: userId }
        ]
      });
      isTeamMember = !!team;
    }

    
    if (!isDirectParticipant && !isTeamMember) {
      console.log(`Access denied: User ${userId} is neither direct participant nor team member for conversation ${conversationId}`);
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }
    
    console.log(`Access granted for user ${userId} to conversation ${conversationId}`);
   
    const messages = await Message.find({ conversationId })
      .populate('sender', 'name email avatar')
      .populate('replyTo', 'content sender messageType')
      .populate('replyTo.sender', 'name avatar')
      .sort({ createdAt: 1 });

    await Message.updateMany(
      {
        conversationId,
        sender: { $ne: userId },
        readBy: { $ne: userId }
      },
      {
        $addToSet: { readBy: userId }
      }
    );

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: error.message });
  }
};


export const sendMessage = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content, messageType = 'text', fileUrl, fileName, fileSize, thumbnailUrl, replyTo } = req.body;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user.id,
      isActive: true
    }).populate('participants', 'name email avatar isOnline');

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

   
    if (messageType === 'file' && !conversation.settings.allowFileSharing) {
      return res.status(400).json({ error: 'File sharing is not allowed in this conversation' });
    }

    if (messageType === 'image' && !conversation.settings.allowImages) {
      return res.status(400).json({ error: 'Image sharing is not allowed in this conversation' });
    }

    if (messageType === 'video' && !conversation.settings.allowVideos) {
      return res.status(400).json({ error: 'Video sharing is not allowed in this conversation' });
    }

    const messageData = {
      sender: req.user.id,
      conversationId,
      messageType,
      readBy: [req.user.id] 
    };

    if (messageType === 'text' || messageType === 'system') {
      messageData.content = content;
    } else {
      messageData.fileUrl = fileUrl;
      messageData.fileName = fileName;
      messageData.fileSize = fileSize;
      if (thumbnailUrl) messageData.thumbnailUrl = thumbnailUrl;
      if (content) messageData.content = content; 
    }

    if (replyTo) {
      messageData.replyTo = replyTo;
    }

    const message = new Message(messageData);
    await message.save();
    await message.populate('sender', 'name email avatar');
    await message.populate('replyTo', 'content sender messageType');
    await message.populate('replyTo.sender', 'name avatar');

    
    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    
    if (req.app.get('io')) {
      req.app.get('io').to(conversationId).emit('new_message', {
        message,
        conversation: {
          _id: conversation._id,
          name: conversation.name,
          type: conversation.type,
          participants: conversation.participants,
          lastMessage: message
        }
      });
    }

    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: error.message });
  }
};


export const startDirectConversation = async (req, res) => {
  try {
    const { userId } = req.body;

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot start conversation with yourself' });
    }

    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    
    let conversation = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [req.user.id, userId], $size: 2 }
    })
    .populate('participants', 'name email avatar isOnline')
    .populate('lastMessage');

    if (!conversation) {
      
      conversation = new Conversation({
        type: 'direct',
        participants: [req.user.id, userId],
        createdBy: req.user.id,
        settings: {
          allowFileSharing: true,
          allowImages: true,
          allowVideos: true
        }
      });

      await conversation.save();
      await conversation.populate('participants', 'name email avatar isOnline');

      
      const welcomeMessage = new Message({
        content: `You started a conversation with ${otherUser.name}`,
        sender: req.user.id,
        conversationId: conversation._id,
        messageType: 'system'
      });
      await welcomeMessage.save();

      conversation.lastMessage = welcomeMessage._id;
      await conversation.save();
      await conversation.populate('lastMessage');
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const addTeamMemberToChat = async (req, res) => {
  try {
    const { teamId, userId } = req.body;

   
    let conversation = await Conversation.findOne({
      type: 'team',
      teamId: teamId,
      isActive: true
    });

    if (!conversation) {
     
      const team = await Team.findById(teamId).populate('members');
      conversation = await Conversation.create({
        type: 'team',
        name: team.name,
        teamId: teamId,
        participants: team.members,
        isActive: true
      });
      console.log('Created new team conversation:', conversation._id);
    } else {
      
      if (!conversation.participants.includes(userId)) {
        conversation.participants.push(userId);
        await conversation.save();
        console.log('Added user to team conversation');
      }
    }

    res.json({ 
      message: 'User added to team chat',
      conversation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getTeamConversation = async (req, res) => {
  try {
    const { teamId } = req.params;

   
    const team = await Team.findOne({
      _id: teamId,
      $or: [
        { admin: req.user.id },
        { members: req.user.id }
      ]
    })
    .populate('members', 'name email avatar')
    .populate('admin', 'name email avatar');

    if (!team) {
      return res.status(403).json({ error: 'Access denied to this team' });
    }

    let conversation = await Conversation.findOne({
      type: 'team',
      teamId
    })
    .populate('participants', 'name email avatar isOnline')
    .populate('lastMessage');

    if (!conversation) {
     
      const allParticipants = [
        ...team.members.map(m => m._id),
        team.admin._id
      ];

      conversation = new Conversation({
        name: `${team.name} Team Chat`,
        type: 'team',
        participants: allParticipants,
        teamId,
        createdBy: team.admin._id,
        description: `Team chat for ${team.name}`,
        settings: {
          allowFileSharing: true,
          allowImages: true,
          allowVideos: true
        }
      });

      await conversation.save();
      await conversation.populate('participants', 'name email avatar isOnline');

      console.log(`Created team conversation with ${allParticipants.length} participants`);
      
      // Add welcome message
      const welcomeMessage = new Message({
        content: `Welcome to ${team.name} team chat!`,
        sender: team.admin._id,
        conversationId: conversation._id,
        messageType: 'system'
      });
      await welcomeMessage.save();

      conversation.lastMessage = welcomeMessage._id;
      await conversation.save();
      await conversation.populate('lastMessage');
    } else {
     
      const teamMemberIds = team.members.map(m => m._id.toString());
      const conversationParticipantIds = conversation.participants.map(p => p._id.toString());

      
      const missingMembers = teamMemberIds.filter(
        id => !conversationParticipantIds.includes(id)
      );

      if (missingMembers.length > 0) {
        conversation.participants.push(...missingMembers);
        await conversation.save();
        console.log(`Added ${missingMembers.length} missing members to conversation`);
      }

      
      if (!conversationParticipantIds.includes(team.admin._id.toString())) {
        conversation.participants.push(team.admin._id);
        await conversation.save();
        console.log(`Added admin to conversation`);
      }

      await conversation.populate('participants', 'name email avatar isOnline');
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error in getTeamConversation:', error);
    res.status(500).json({ error: 'Failed to get team conversation' });
  }
};


export const getProjectConversation = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId)
      .populate('createdBy', 'name email avatar')
      .populate('teamId');

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    
    let hasAccess = false;
    if (req.user.role === 'Admin') {
      hasAccess = true;
    } else if (project.createdBy._id.toString() === req.user.id) {
      hasAccess = true;
    } else if (project.teamId) {
      const team = await Team.findOne({
        _id: project.teamId._id,
        $or: [
          { admin: req.user.id },
          { members: req.user.id }
        ]
      });
      hasAccess = !!team;
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this project' });
    }

    
    let conversation = await Conversation.findOne({
      type: 'project',
      projectId
    })
    .populate('participants', 'name email avatar isOnline')
    .populate('lastMessage');

    if (!conversation) {
      
      let participants = [project.createdBy._id, req.user.id];
      
      if (project.teamId) {
        const team = await Team.findById(project.teamId._id).populate('members admin');
        participants = [...new Set([...participants, ...team.members.map(m => m._id), team.admin._id])];
      }

      conversation = new Conversation({
        name: `${project.name} Project Chat`,
        type: 'project',
        participants,
        projectId,
        createdBy: req.user.id,
        description: `Project discussion for ${project.name}`,
        settings: {
          allowFileSharing: true,
          allowImages: true,
          allowVideos: true
        }
      });

      await conversation.save();
      await conversation.populate('participants', 'name email avatar isOnline');
      
     
      const welcomeMessage = new Message({
        content: `Welcome to the ${project.name} project chat! Discuss project-related topics here.`,
        sender: req.user.id,
        conversationId: conversation._id,
        messageType: 'system'
      });
      await welcomeMessage.save();

      conversation.lastMessage = welcomeMessage._id;
      await conversation.save();
      await conversation.populate('lastMessage');
    }

    res.json(conversation);
  } catch (error) {
    console.error('Error in getProjectConversation:', error);
    res.status(500).json({ error: 'Failed to get project conversation' });
  }
};


export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json([]);
    }

    const users = await User.find({
      _id: { $ne: req.user.id },
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ]
    })
    .select('name email avatar isOnline department')
    .limit(10);

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { conversationId } = req.body;

   
    const conversation = await Conversation.findOne({
      _id: conversationId,
      participants: req.user.id
    });

    if (!conversation) {
      return res.status(403).json({ error: 'Access denied to this conversation' });
    }

    
    let resourceType = 'auto';
    if (req.file.mimetype.startsWith('image/')) {
      resourceType = 'image';
    } else if (req.file.mimetype.startsWith('video/')) {
      resourceType = 'video';
    }

    console.log(`Uploading file: ${req.file.originalname} (${req.file.mimetype})`);

    
    const uploadPromise = new Promise((resolve, reject) => {
      const uploadStream = cloudinary.v2.uploader.upload_stream(
        {
          resource_type: resourceType,
          folder: 'chat-files',
          public_id: `${Date.now()}-${req.file.originalname}`,
          timeout: 120000,
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            reject(error);
          } else {
            console.log('File uploaded to Cloudinary:', result.secure_url);
            resolve(result);
          }
        }
      );

      uploadStream.end(req.file.buffer);
    });

    const result = await uploadPromise;

    res.json({
      url: result.secure_url,
      publicId: result.public_id,
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      resourceType: resourceType,
      type: req.file.mimetype.split('/')[0], 
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: error.message || 'File upload failed' });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const { publicId, resourceType } = req.body;

    if (!publicId) {
      return res.status(400).json({ error: 'No public ID provided' });
    }

    await cloudinary.v2.uploader.destroy(publicId, { 
      resource_type: resourceType || 'auto' 
    });

    console.log('File deleted from Cloudinary:', publicId);
    res.json({ message: 'File deleted successfully' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ error: error.message });
  }
};


const getMessageType = (mimeType) => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'file';
};