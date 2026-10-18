import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Team from '../models/Team.js';

export const addMemberAndSyncConversation = async (teamId, userId) => {
  const session = await mongoose.startSession();
  try {
    let team;
    await session.withTransaction(async () => {
      team = await Team.findOneAndUpdate(
        { _id: teamId, admin: { $ne: userId }, members: { $ne: userId } },
        { $addToSet: { members: userId } },
        { new: true, session },
      );
      if (!team) return;

      await Conversation.findOneAndUpdate(
        { type: 'team', teamId, isActive: true },
        {
          $setOnInsert: { name: `${team.name} Team Chat`, createdBy: team.admin, type: 'team', teamId },
          $addToSet: { participants: { $each: [team.admin, ...team.members] } },
        },
        { upsert: true, session, setDefaultsOnInsert: true },
      );
    });
    return team;
  } finally {
    await session.endSession();
  }
};

export const removeMemberAndSyncConversation = async (teamId, userId) => {
  const session = await mongoose.startSession();
  try {
    let team;
    await session.withTransaction(async () => {
      team = await Team.findOneAndUpdate(
        { _id: teamId, admin: { $ne: userId } },
        { $pull: { members: userId } },
        { new: true, session },
      );
      if (!team) return;
      await Conversation.updateOne(
        { type: 'team', teamId },
        { $pull: { participants: userId } },
        { session },
      );
    });
    return team;
  } finally {
    await session.endSession();
  }
};
