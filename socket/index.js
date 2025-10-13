import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import Team from '../models/Team.js';

const onlineUsers = new Map();

const socketSetup = (io) => {
    io.use(async (socket, next) => {
        try {
            const cookies = cookie.parse(socket.handshake.headers.cookie || '');
            
           
            const token = cookies.accessToken;
            console.log('Socket auth - accessToken present:', !!token);

            if (!token) {
                console.log('No token found in socket handshake');
                return next(new Error('Authentication error: No token provided'));
            }

           
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            
            const user = await User.findById(decoded.id);
            if (!user) {
                console.log('User not found in database');
                socket.userId = null;
                socket.user = null;
                return next();
            }

            socket.userId = decoded.id;
            socket.user = user;
            console.log('Socket authenticated for user:', user.name);
            next();
        } catch (jwtError) {
            console.error('JWT verification failed:', jwtError.message);
            socket.userId = null;
            socket.user = null;
            next();
        }
    });

    io.on('connection', (socket) => {
        console.log('User connected:', socket.userId, socket.id);

        onlineUsers.set(socket.userId.toString(), {
            socketId: socket.id,
            user: socket.user,
            lastSeen: new Date()
        });

        socket.broadcast.emit('user_online', { 
            userId: socket.userId,
            user: {
                _id: socket.user._id,
                name: socket.user.name,
                avatar: socket.user.avatar
            }
        });

        User.findByIdAndUpdate(socket.userId, { 
            isOnline: true,
            lastSeen: new Date()
        }).catch(console.error);

        
        socket.on('join_conversation', async (conversationId) => {
            try {
  
    const conversation = await Conversation.findById(conversationId)
      .populate('teamId');

   
    const isDirectParticipant = conversation.participants.some(
      p => p.toString() === socket.userId.toString()
    );

    let isTeamMember = false;
    if (conversation.type === 'team' && conversation.teamId) {
      const team = await Team.findOne({
        _id: conversation.teamId,
        $or: [
          { admin: socket.userId },
          { members: socket.userId }
        ]
      });
      isTeamMember = !!team;
    }

    if (isDirectParticipant || isTeamMember) {
      socket.join(conversationId);
      console.log(`User ${socket.userId} joined team conversation`);

     
      await Message.updateMany(
        {
          conversationId,
          sender: { $ne: socket.userId },
          readBy: { $ne: socket.userId }
        },
        {
          $addToSet: { readBy: socket.userId }
        }
      );
    } else {
      socket.emit('error', { error: 'Access denied to this conversation' });
    }
  } catch (error) {
    console.error('Error joining conversation:', error);
    socket.emit('error', { error: 'Failed to join conversation' });
  }
});

        
        socket.on('leave_conversation', (conversationId) => {
            socket.leave(conversationId);
            console.log(`User ${socket.userId} left conversation ${conversationId}`);
        });

       

socket.on('send_message', async (data) => {
  try {
    const { conversationId, content, messageType = 'text', fileData } = data;

   
    const conversation = await Conversation.findById(conversationId).populate('teamId');

    if (!conversation) {
      return socket.emit('message_error', { error: 'Conversation not found' });
    }

   
    const isDirectParticipant = conversation.participants.some(
      p => p.toString() === socket.userId.toString()
    );

    let isTeamMember = false;
    if (conversation.type === 'team' && conversation.teamId) {
      const team = await Team.findOne({
        _id: conversation.teamId,
        $or: [
          { admin: socket.userId },
          { members: socket.userId }
        ]
      });
      isTeamMember = !!team;
    }

    if (!isDirectParticipant && !isTeamMember) {
      return socket.emit('message_error', { error: 'Access denied to this conversation' });
    }

    console.log(`User has access to conversation ${conversationId}`);

   
    if (messageType === 'text' && !content?.trim()) {
      return socket.emit('message_error', { error: 'Message content is required' });
    }
    if ((messageType === 'file' || messageType === 'image' || messageType === 'video') && !fileData?.url) {
      console.error('File message missing fileData.url');
      return socket.emit('message_error', { error: 'File URL is required' });
    }

    
    const messageData = {
      sender: socket.userId,
      conversationId: conversationId,
      messageType: messageType,
      readBy: [socket.userId],
      createdAt: new Date()
    };

    
    if (messageType === 'text') {
      messageData.content = content.trim();
    } else if (fileData) {
      messageData.fileUrl = fileData.url;
      messageData.fileName = fileData.name;
      messageData.fileSize = fileData.size;
      messageData.content = fileData.name;
      if (fileData.type) {
        messageData.messageType = messageType;
      }
      console.log('Saving file message:', {
        fileName: messageData.fileName,
        fileUrl: messageData.fileUrl,
        messageType: messageData.messageType
      });
    }

   
    const message = new Message(messageData);
    await message.save();

    console.log('Message saved to DB:', {
      _id: message._id,
      messageType: message.messageType,
      fileName: message.fileName,
      fileUrl: message.fileUrl ? 'exists' : 'MISSING'
    });

   
    await message.populate('sender', 'name avatar');

   
    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    
    io.to(conversationId).emit('new_message', {
      message,
      conversation: {
        _id: conversation._id,
        name: conversation.name,
        type: conversation.type,
        participants: conversation.participants,
        lastMessage: message
      }
    });

    console.log(`Message emitted to ${conversation.participants.length} participants`);

  } catch (error) {
    console.error('Error in send_message:', error);
    socket.emit('message_error', { 
      error: 'Failed to send message',
      details: error.message 
    });
  }
});


       
        socket.on('typing_start', (conversationId) => {
            socket.to(conversationId).emit('user_typing', {
                userId: socket.userId,
                userName: socket.user.name,
                conversationId
            });
        });

        socket.on('typing_stop', (conversationId) => {
            socket.to(conversationId).emit('user_stop_typing', {
                userId: socket.userId,
                conversationId
            });
        });

        
        socket.on('disconnect', async () => {
            console.log('User disconnected:', socket.userId, socket.id);

            onlineUsers.delete(socket.userId.toString());

            await User.findByIdAndUpdate(socket.userId, { 
                isOnline: false,
                lastSeen: new Date()
            }).catch(console.error);

            socket.broadcast.emit('user_offline', { 
                userId: socket.userId,
                user: {
                    _id: socket.user._id,
                    name: socket.user.name,
                    avatar: socket.user.avatar
                }
            });
        });

        socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    });
};

export default socketSetup;