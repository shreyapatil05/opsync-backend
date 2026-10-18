import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Team from '../models/Team.js';

export const getConversationAccess = async (conversationId, user) => {
  if (!mongoose.isValidObjectId(conversationId)) return { conversation: null, canAccess: false };
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !conversation.isActive) return { conversation, canAccess: false };
  if (user.role === 'Admin') return { conversation, canAccess: true };
  if (conversation.participants.some(id => id.toString() === user.id.toString())) {
    return { conversation, canAccess: true };
  }
  if (conversation.type === 'team' && conversation.teamId) {
    const team = await Team.exists({
      _id: conversation.teamId,
      $or: [{ admin: user.id }, { members: user.id }],
    });
    return { conversation, canAccess: Boolean(team) };
  }
  return { conversation, canAccess: false };
};
