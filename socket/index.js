import cookie from 'cookie';
import jwt from 'jsonwebtoken';
import Message from '../models/Message.js';
import User from '../models/User.js';
import { getConversationAccess } from '../services/conversationAccessService.js';
import { logger } from '../utils/logger.js';

const onlineUsers = new Map();
const MESSAGE_TYPES = new Set(['text', 'file', 'image', 'video']);

const addOnlineSocket = (userId, socketId) => {
  const sockets = onlineUsers.get(userId) || new Set();
  sockets.add(socketId);
  onlineUsers.set(userId, sockets);
  return sockets.size === 1;
};

const removeOnlineSocket = (userId, socketId) => {
  const sockets = onlineUsers.get(userId);
  if (!sockets) return true;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    onlineUsers.delete(userId);
    return true;
  }
  return false;
};

const socketSetup = io => {
  io.use(async (socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie || '');
      if (!cookies.accessToken) return next(new Error('Authentication required'));
      const decoded = jwt.verify(cookies.accessToken, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.id).select('_id name avatar role');
      if (!user) return next(new Error('Authentication required'));
      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      logger.warn('socket_auth_rejected', { errorMessage: error.message });
      next(new Error('Authentication required'));
    }
  });

  io.on('connection', socket => {
    if (addOnlineSocket(socket.userId, socket.id)) {
      User.updateOne({ _id: socket.userId }, { isOnline: true, lastSeen: new Date() }).catch(error => {
        logger.error('socket_presence_update_failed', { errorMessage: error.message });
      });
      socket.broadcast.emit('user_online', {
        userId: socket.userId,
        user: { _id: socket.user._id, name: socket.user.name, avatar: socket.user.avatar },
      });
    }

    socket.on('join_conversation', async conversationId => {
      try {
        const access = await getConversationAccess(conversationId, { id: socket.userId, role: socket.user.role });
        if (!access.canAccess) return socket.emit('conversation_error', { code: 'FORBIDDEN', message: 'Access denied' });
        await socket.join(conversationId);
        await Message.updateMany(
          { conversationId, sender: { $ne: socket.userId }, readBy: { $ne: socket.userId } },
          { $addToSet: { readBy: socket.userId } },
        );
      } catch (error) {
        logger.error('socket_join_failed', { userId: socket.userId, conversationId, errorMessage: error.message });
        socket.emit('conversation_error', { code: 'JOIN_FAILED', message: 'Failed to join conversation' });
      }
    });

    socket.on('leave_conversation', conversationId => {
      if (typeof conversationId === 'string') socket.leave(conversationId);
    });

    socket.on('send_message', async data => {
      try {
        const conversationId = data?.conversationId;
        const messageType = data?.messageType || 'text';
        if (!MESSAGE_TYPES.has(messageType)) return socket.emit('message_error', { error: 'Invalid message type' });
        const access = await getConversationAccess(conversationId, { id: socket.userId, role: socket.user.role });
        if (!access.canAccess || !socket.rooms.has(conversationId)) {
          return socket.emit('message_error', { error: 'Join the authorized conversation before sending' });
        }

        const messageData = { sender: socket.userId, conversationId, messageType, readBy: [socket.userId] };
        if (messageType === 'text') {
          const content = typeof data.content === 'string' ? data.content.trim() : '';
          if (!content || content.length > 5000) return socket.emit('message_error', { error: 'Message must contain 1 to 5000 characters' });
          messageData.content = content;
        } else {
          const file = data.fileData;
          if (!file?.url || typeof file.url !== 'string' || !file.url.startsWith('https://')) {
            return socket.emit('message_error', { error: 'A secure file URL is required' });
          }
          messageData.fileUrl = file.url;
          messageData.fileName = String(file.name || 'attachment').slice(0, 255);
          messageData.fileSize = Number(file.size) || 0;
          messageData.content = messageData.fileName;
        }

        const message = await Message.create(messageData);
        await message.populate('sender', 'name avatar');
        access.conversation.lastMessage = message._id;
        await access.conversation.save();
        io.to(conversationId).emit('new_message', { message, conversation: access.conversation });
      } catch (error) {
        logger.error('socket_message_failed', { userId: socket.userId, errorMessage: error.message });
        socket.emit('message_error', { error: 'Failed to send message' });
      }
    });

    for (const [event, outgoing] of [['typing_start', 'user_typing'], ['typing_stop', 'user_stop_typing']]) {
      socket.on(event, conversationId => {
        if (typeof conversationId !== 'string' || !socket.rooms.has(conversationId)) return;
        socket.to(conversationId).emit(outgoing, {
          userId: socket.userId,
          userName: socket.user.name,
          conversationId,
        });
      });
    }

    socket.on('disconnect', async () => {
      if (!removeOnlineSocket(socket.userId, socket.id)) return;
      await User.updateOne({ _id: socket.userId }, { isOnline: false, lastSeen: new Date() }).catch(error => {
        logger.error('socket_presence_update_failed', { errorMessage: error.message });
      });
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        user: { _id: socket.user._id, name: socket.user.name, avatar: socket.user.avatar },
      });
    });
  });
};

export default socketSetup;
