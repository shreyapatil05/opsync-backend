import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { logger } from '../utils/logger.js';
import '../models/Conversation.js';
import '../models/File.js';
import '../models/Message.js';
import '../models/OAuthToken.js';
import '../models/PasswordResetToken.js';
import '../models/Project.js';
import '../models/RefreshToken.js';
import '../models/Rule.js';
import '../models/Task.js';
import '../models/Team.js';
import '../models/User.js';

await connectDB();
for (const model of Object.values(mongoose.models)) {
  const result = await model.syncIndexes();
  logger.info('indexes_synced', { model: model.modelName, droppedIndexes: result });
}
await mongoose.disconnect();
