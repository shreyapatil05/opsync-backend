import crypto from 'crypto';
import User from '../models/User.js';

export const normalizeUsername = value => String(value || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9_]/g, '_')
  .replace(/_+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 30);

export const createAvailableUsername = async (preferred, excludedUserId) => {
  const normalized = normalizeUsername(preferred);
  const base = (normalized.length >= 3 ? normalized : `user_${normalized}`).slice(0, 25);
  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}_${suffix}`;
    const query = { username: candidate };
    if (excludedUserId) query._id = { $ne: excludedUserId };
    if (!await User.exists(query)) return candidate;
  }
  return `user_${crypto.randomBytes(6).toString('hex')}`;
};

export const isFinalActiveAdmin = async user => {
  if (user.role !== 'Admin' || user.status === 'deleted') return false;
  return await User.countDocuments({ role: 'Admin', status: { $nin: ['deactivated', 'deleted'] } }) <= 1;
};

export const publicAccount = user => ({
  id: user._id,
  name: user.name,
  username: user.username,
  email: user.email,
  emailVerified: Boolean(user.emailVerified),
  role: user.role,
  status: user.status || 'active',
  phone: user.phone || '',
  avatar: user.avatar || '',
  bio: user.bio || '',
  location: user.location || '',
  createdAt: user.createdAt,
  lastLogin: user.lastLogin,
});
