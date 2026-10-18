import crypto from 'crypto';
import cloudinary from '../config/cloudinary.js';
import User from '../models/User.js';
import Team from '../models/Team.js';
import Project from '../models/Project.js';
import Task from '../models/Task.js';
import File from '../models/File.js';
import Message from '../models/Message.js';
import Activity from '../models/Activity.js';
import RefreshToken from '../models/RefreshToken.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import EmailVerificationToken from '../models/EmailVerificationToken.js';
import { authCookieOptions } from '../config/cookies.js';
import { sendEmailVerificationEmail } from '../services/emailService.js';
import { createAvailableUsername, isFinalActiveAdmin, publicAccount } from '../services/accountService.js';
import { recordActivity } from '../services/activityService.js';
import { logger } from '../utils/logger.js';

const verificationUrlFor = token => `${process.env.FRONTEND_URL}/verify-email#token=${encodeURIComponent(token)}`;

const issueVerification = async user => {
  await EmailVerificationToken.deleteMany({ userId: user._id });
  const token = crypto.randomBytes(32).toString('hex');
  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  try {
    await sendEmailVerificationEmail({ email: user.email, name: user.name, verificationUrl: verificationUrlFor(token) });
  } catch (error) {
    await EmailVerificationToken.deleteMany({ userId: user._id });
    throw error;
  }
};

export const updateAccountProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+avatarPublicId');
    if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    if (req.body.username !== undefined) {
      const username = await createAvailableUsername(req.body.username, user._id);
      if (username !== req.body.username.toLowerCase()) return res.status(409).json({ error: { code: 'USERNAME_UNAVAILABLE', message: 'That username is not available' } });
      user.username = username;
    }
    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.phone !== undefined) user.phone = req.body.phone;
    if (req.body.bio !== undefined) user.bio = req.body.bio;
    if (req.body.location !== undefined) user.location = req.body.location;
    await user.save();
    await recordActivity({ actor: user._id, category: 'account', action: 'updated profile', targetType: 'account', targetId: user._id, targetName: user.name, targetUrl: '/settings' });
    return res.json(publicAccount(user));
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ error: { code: 'USERNAME_UNAVAILABLE', message: 'That username is not available' } });
    logger.error('account_profile_update_failed', { userId: req.user.id, errorMessage: error.message });
    return res.status(500).json({ error: { code: 'ACCOUNT_UPDATE_FAILED', message: 'Unable to update account' } });
  }
};

export const updateAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+avatarPublicId');
    if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    const previousPublicId = user.avatarPublicId;
    user.avatar = req.body.avatar;
    user.avatarPublicId = req.body.publicId;
    await user.save();
    if (previousPublicId && previousPublicId !== user.avatarPublicId) cloudinary.uploader.destroy(previousPublicId).catch(error => logger.warn('old_avatar_delete_failed', { userId: req.user.id, errorMessage: error.message }));
    return res.json(publicAccount(user));
  } catch (error) {
    logger.error('avatar_update_failed', { userId: req.user.id, errorMessage: error.message });
    return res.status(500).json({ error: { code: 'AVATAR_UPDATE_FAILED', message: 'Unable to update avatar' } });
  }
};

export const removeAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('+avatarPublicId');
    if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    if (user.avatarPublicId) {
      const result = await cloudinary.uploader.destroy(user.avatarPublicId, { resource_type: 'image' });
      if (!['ok', 'not found'].includes(result.result)) throw new Error('Cloudinary did not confirm avatar deletion');
    }
    user.avatar = '';
    user.avatarPublicId = '';
    await user.save();
    return res.json(publicAccount(user));
  } catch (error) {
    logger.error('avatar_remove_failed', { userId: req.user.id, errorMessage: error.message });
    return res.status(502).json({ error: { code: 'AVATAR_REMOVE_FAILED', message: 'Unable to remove avatar' } });
  }
};

export const requestEmailVerification = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found' } });
    if (user.emailVerified) return res.json({ message: 'Email is already verified' });
    await issueVerification(user);
    return res.json({ message: 'Verification email sent' });
  } catch (error) {
    logger.error('verification_email_failed', { userId: req.user.id, errorMessage: error.message });
    return res.status(503).json({ error: { code: 'EMAIL_UNAVAILABLE', message: 'Verification email could not be sent' } });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const tokenHash = crypto.createHash('sha256').update(req.body.token).digest('hex');
    const record = await EmailVerificationToken.findOneAndDelete({ tokenHash, expiresAt: { $gt: new Date() } }).select('+tokenHash');
    if (!record) return res.status(400).json({ error: { code: 'VERIFICATION_TOKEN_INVALID', message: 'This verification link is invalid or expired' } });
    const user = await User.findById(record.userId);
    if (!user || user.status === 'deleted') return res.status(400).json({ error: { code: 'VERIFICATION_TOKEN_INVALID', message: 'This verification link is invalid or expired' } });
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();
    await EmailVerificationToken.deleteMany({ userId: user._id });
    return res.json({ message: 'Email verified successfully' });
  } catch (error) {
    logger.error('email_verification_failed', { errorMessage: error.message });
    return res.status(500).json({ error: { code: 'EMAIL_VERIFICATION_FAILED', message: 'Unable to verify email' } });
  }
};

export const exportAccountData = async (req, res) => {
  try {
    const userId = req.user._id;
    const [user, teams, projects, tasks, files, messages, activities] = await Promise.all([
      User.findById(userId).select('-password -avatarPublicId').lean(),
      Team.find({ $or: [{ admin: userId }, { members: userId }] }).lean(),
      Project.find({ $or: [{ createdBy: userId }, { projectManager: userId }, { assignedMembers: userId }] }).lean(),
      Task.find({ $or: [{ createdBy: userId }, { assignedTo: userId }, { assignee: userId }] }).lean(),
      File.find({ uploader: userId }).lean(), Message.find({ sender: userId }).lean(), Activity.find({ actor: userId }).lean(),
    ]);
    res.setHeader('Content-Disposition', `attachment; filename="opsync-account-${userId}.json"`);
    return res.json({ exportedAt: new Date().toISOString(), account: user, teams, projects, tasks, files, messages, activities });
  } catch (error) {
    logger.error('account_export_failed', { userId: req.user.id, errorMessage: error.message });
    return res.status(500).json({ error: { code: 'EXPORT_FAILED', message: 'Unable to export account data' } });
  }
};

const confirmPassword = async (userId, password) => {
  const user = await User.findById(userId).select('+password +avatarPublicId');
  return user && await user.comparePassword(password) ? user : null;
};

export const deactivateAccount = async (req, res) => {
  try {
    const user = await confirmPassword(req.user.id, req.body.password);
    if (!user) return res.status(400).json({ error: { code: 'PASSWORD_INVALID', message: 'Current password is incorrect' } });
    if (await isFinalActiveAdmin(user)) return res.status(409).json({ error: { code: 'FINAL_ADMIN', message: 'Assign another active administrator before deactivating this account' } });
    user.status = 'deactivated'; user.deactivatedAt = new Date(); user.isOnline = false;
    await user.save();
    await RefreshToken.deleteMany({ userId: user._id });
    res.clearCookie('accessToken', authCookieOptions); res.clearCookie('refreshToken', authCookieOptions);
    return res.json({ message: 'Account deactivated' });
  } catch (error) {
    logger.error('account_deactivation_failed', { userId: req.user.id, errorMessage: error.message });
    return res.status(500).json({ error: { code: 'DEACTIVATION_FAILED', message: 'Unable to deactivate account' } });
  }
};

export const deleteAccount = async (req, res) => {
  try {
    const user = await confirmPassword(req.user.id, req.body.password);
    if (!user) return res.status(400).json({ error: { code: 'PASSWORD_INVALID', message: 'Current password is incorrect' } });
    if (await isFinalActiveAdmin(user)) return res.status(409).json({ error: { code: 'FINAL_ADMIN', message: 'Assign another active administrator before deleting this account' } });
    if (user.avatarPublicId) await cloudinary.uploader.destroy(user.avatarPublicId, { resource_type: 'image' }).catch(error => logger.warn('deleted_account_avatar_cleanup_failed', { userId: req.user.id, errorMessage: error.message }));
    const anonymousId = crypto.randomBytes(12).toString('hex');
    Object.assign(user, { name: 'Deleted user', username: `deleted_${anonymousId}`, email: `deleted+${anonymousId}@invalid.opsync.local`, phone: '', bio: '', location: '', avatar: '', avatarPublicId: '', teamId: undefined, emailVerified: false, status: 'deleted', deletedAt: new Date(), isOnline: false, password: crypto.randomBytes(48).toString('hex') });
    await user.save();
    await Promise.all([RefreshToken.deleteMany({ userId: user._id }), PasswordResetToken.deleteMany({ userId: user._id }), EmailVerificationToken.deleteMany({ userId: user._id }), Team.updateMany({}, { $pull: { members: user._id } })]);
    res.clearCookie('accessToken', authCookieOptions); res.clearCookie('refreshToken', authCookieOptions);
    return res.json({ message: 'Account deleted and personal data anonymized' });
  } catch (error) {
    logger.error('account_deletion_failed', { userId: req.user.id, errorMessage: error.message });
    return res.status(500).json({ error: { code: 'ACCOUNT_DELETE_FAILED', message: 'Unable to delete account' } });
  }
};
