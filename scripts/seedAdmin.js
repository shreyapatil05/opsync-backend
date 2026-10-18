import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

const email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_SEED_PASSWORD;
const name = process.env.ADMIN_SEED_NAME?.trim() || 'OpSync Admin';

if (!email || !password || password.length < 12) {
  throw new Error('Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD (minimum 12 characters)');
}

await connectDB();
const existing = await User.findOne({ email }).select('+password');
if (existing) {
  existing.role = 'Admin';
  existing.name = name;
  existing.password = password;
  await existing.save();
  logger.info('admin_seed_updated', { userId: existing._id, email });
} else {
  const user = await User.create({ name, email, password, role: 'Admin' });
  logger.info('admin_seed_created', { userId: user._id, email });
}
await mongoose.disconnect();
