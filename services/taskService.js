import mongoose from 'mongoose';
import Project from '../models/Project.js';
import Task from '../models/Task.js';

export const createTaskWithProject = async (projectId, taskInput) => {
  const session = await mongoose.startSession();
  try {
    let createdTask;
    await session.withTransaction(async () => {
      [createdTask] = await Task.create([{ ...taskInput, projectId }], { session });
      const projectUpdate = { $push: { tasks: createdTask._id } };
      if (createdTask.assignee) projectUpdate.$addToSet = { assignedMembers: createdTask.assignee };
      await Project.updateOne({ _id: projectId }, projectUpdate, { session });
    });
    return createdTask;
  } finally {
    await session.endSession();
  }
};

export const deleteTaskWithProject = async (projectId, taskId) => {
  const session = await mongoose.startSession();
  try {
    let deletedTask;
    await session.withTransaction(async () => {
      deletedTask = await Task.findOneAndDelete({ _id: taskId, projectId }, { session });
      if (!deletedTask) return;

      await Project.updateOne({ _id: projectId }, { $pull: { tasks: taskId } }, { session });
      if (deletedTask.assignee) {
        const remaining = await Task.exists({ projectId, assignee: deletedTask.assignee }).session(session);
        if (!remaining) {
          await Project.updateOne(
            { _id: projectId },
            { $pull: { assignedMembers: deletedTask.assignee } },
            { session },
          );
        }
      }
    });
    return deletedTask;
  } finally {
    await session.endSession();
  }
};

export const getProjectMemberProgress = async (projectId) => Task.aggregate([
  { $match: { projectId: new mongoose.Types.ObjectId(projectId), assignee: { $ne: null } } },
  { $group: {
    _id: '$assignee',
    totalTasks: { $sum: 1 },
    completedTasks: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } },
    inProgressTasks: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
    todoTasks: { $sum: { $cond: [{ $eq: ['$status', 'todo'] }, 1, 0] } },
  } },
]);
