import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import File from '../models/File.js';
import Message from '../models/Message.js';
import Project from '../models/Project.js';
import Rule from '../models/Rule.js';
import Task from '../models/Task.js';

export const deleteProjectData = async projectId => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const conversationIds = await Conversation.find({ projectId }).distinct('_id').session(session);
      await Promise.all([
        Message.deleteMany({ conversationId: { $in: conversationIds } }, { session }),
        Conversation.deleteMany({ projectId }, { session }),
        Task.deleteMany({ projectId }, { session }),
        Rule.deleteMany({ projectId }, { session }),
        File.deleteMany({ projectId }, { session }),
        Project.deleteOne({ _id: projectId }, { session }),
      ]);
    });
  } finally {
    await session.endSession();
  }
};
