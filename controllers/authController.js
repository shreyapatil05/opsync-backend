import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';
import PasswordResetToken from '../models/PasswordResetToken.js';
import crypto from 'crypto';
import { accessCookieOptions, authCookieOptions, refreshCookieOptions } from '../config/cookies.js';
import { sendPasswordResetEmail } from '../services/emailService.js';
import { logger } from '../utils/logger.js';
import { recordActivity } from '../services/activityService.js';
import { createAvailableUsername, publicAccount } from '../services/accountService.js';

export const login = [
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { password } = req.body;
      const email = req.body.email.trim().toLowerCase();
      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.comparePassword(password))) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      if (user.status && user.status !== 'active') {
        return res.status(403).json({ error: { code: 'ACCOUNT_INACTIVE', message: 'This account is not active' } });
      }
      user.lastLogin = new Date();
        await user.save();
      await recordActivity({ actor: user._id, category: 'account', action: 'logged in', targetType: 'account', targetId: user._id, targetName: user.name, targetUrl: '/profile' });

      const accessToken = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRES || '15m' }
      );
      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES || '7d' }
      );

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await RefreshToken.create({ token: refreshToken, userId: user._id, expiresAt });

      res.cookie('accessToken', accessToken, accessCookieOptions);
      res.cookie('refreshToken', refreshToken, refreshCookieOptions);

      res.json({ user: publicAccount(user) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
];

export const signup = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { name, email, password } = req.body;
      let user = await User.findOne({ email });
      if (user) return res.status(400).json({ error: 'User already exists' });

      // Public registration must never be able to choose a privileged role.
      const username = await createAvailableUsername(name);
      user = new User({ name, email, username, password, role: 'Employee' });
      await user.save();

      const accessToken = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRES || '15m' }
      );
      const refreshToken = jwt.sign(
        { id: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRES || '7d' }
      );

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await RefreshToken.create({ token: refreshToken, userId: user._id, expiresAt });

      res.cookie('accessToken', accessToken, accessCookieOptions);
      res.cookie('refreshToken', refreshToken, refreshCookieOptions);

      res.status(201).json({ user: publicAccount(user) });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
];


export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    console.log("Refresh token attempt");
    
    if (!refreshToken) {
      console.log("No refresh token in cookies");
      return res.status(401).json({ error: 'No refresh token' });
    }

    const storedToken = await RefreshToken.findOne({ token: refreshToken });
    if (!storedToken) {
      console.log("Refresh token not found in database");
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (storedToken.expiresAt < new Date()) {
      console.log("Refresh token expired");
      await RefreshToken.deleteOne({ token: refreshToken });
      return res.status(401).json({ error: 'Refresh token expired' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      console.log("User not found for refresh token");
      return res.status(401).json({ error: 'User not found' });
    }
    if (user.status && user.status !== 'active') {
      await RefreshToken.deleteOne({ token: refreshToken });
      return res.status(403).json({ error: { code: 'ACCOUNT_INACTIVE', message: 'This account is not active' } });
    }

   
    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRES || '15m' }
    );

   
    const newRefreshToken = jwt.sign(
      { id: user._id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRES || '7d' }
    );

    
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); 
    await RefreshToken.findOneAndUpdate(
      { token: refreshToken },
      { 
        token: newRefreshToken,
        expiresAt: expiresAt,
        updatedAt: new Date()
      }
    );

    console.log("🔄 New tokens generated for:", user.email);

    
    res.cookie('accessToken', newAccessToken, accessCookieOptions);
    res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);

console.log("🔄 Cookies set successfully");

    res.json({ 
      user: publicAccount(user),
      message: 'Tokens refreshed successfully'
    });
  } catch (error) {
    console.error('🔄 Refresh token error:', error);
    
    
    res.clearCookie('accessToken', authCookieOptions);
    res.clearCookie('refreshToken', authCookieOptions);
    
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }

    res.clearCookie('accessToken', authCookieOptions);
    res.clearCookie('refreshToken', authCookieOptions);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
        if (!user.username) {
          user.username = await createAvailableUsername(user.name, user._id);
          await user.save();
        }
        res.json(publicAccount(user));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProfile = async (req, res) => {
    const { name, phone, bio, location, avatar } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.name = name || user.name;
        user.phone = phone;
        user.bio = bio;
        user.location = location;
        user.avatar = avatar;

        await user.save();
        await recordActivity({ actor: user._id, category: 'account', action: 'updated profile', targetType: 'account', targetId: user._id, targetName: user.name, targetUrl: '/profile' });
        res.json(user.toObject());
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


export const forgotPassword = async (req, res) => {
  const genericMessage = 'If an account exists for that email, a password reset link has been sent';
  try {
    const email = req.body.email.toLowerCase();
    const user = await User.findOne({ email });
    if (!user) return res.json({ message: genericMessage });

    await PasswordResetToken.deleteMany({ userId: user._id });
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    await PasswordResetToken.create({
      tokenHash,
      userId: user._id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password#token=${encodeURIComponent(resetToken)}`;
    try {
      await sendPasswordResetEmail({ email: user.email, name: user.name, resetUrl });
    } catch (emailError) {
      await PasswordResetToken.deleteMany({ userId: user._id });
      logger.error('password_reset_email_failed', { userId: String(user._id), errorMessage: emailError.message });
      return res.status(503).json({ error: { code: 'EMAIL_UNAVAILABLE', message: 'Password reset email could not be sent. Please try again later.' } });
    }

    res.json({ message: genericMessage });
  } catch (error) {
    logger.error('password_reset_request_failed', { errorMessage: error.message });
    res.status(500).json({ error: { code: 'RESET_REQUEST_FAILED', message: 'Unable to process the request' } });
  }
};

export const resetPassword = async (req, res) => {
    try {
      const { token, password } = req.body;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const resetRecord = await PasswordResetToken.findOneAndDelete({
        tokenHash,
        expiresAt: { $gt: new Date() },
      });
      if (!resetRecord) return res.status(400).json({ error: { code: 'RESET_TOKEN_INVALID', message: 'This reset link is invalid or has expired' } });

      const user = await User.findById(resetRecord.userId).select('+password');
      if (!user) return res.status(400).json({ error: { code: 'RESET_TOKEN_INVALID', message: 'This reset link is invalid or has expired' } });

      user.password = password;
      await user.save();
      await Promise.all([
        PasswordResetToken.deleteMany({ userId: user._id }),
        RefreshToken.deleteMany({ userId: user._id }),
      ]);

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      logger.error('password_reset_failed', { errorMessage: error.message });
      res.status(500).json({ error: { code: 'PASSWORD_RESET_FAILED', message: 'Unable to reset the password' } });
    }
};
export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const user = await User.findById(req.user.id).select('+password');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid current password' });
        }

        if (currentPassword === newPassword) {
            return res.status(400).json({ error: 'New password must be different from the current password' });
        }

        user.password = newPassword;
        await user.save();
        await Promise.all([
          RefreshToken.deleteMany({ userId: user._id }),
          PasswordResetToken.deleteMany({ userId: user._id }),
        ]);
        res.clearCookie('accessToken', authCookieOptions);
        res.clearCookie('refreshToken', authCookieOptions);
        await recordActivity({ actor: user._id, category: 'account', action: 'changed password', targetType: 'account', targetId: user._id, targetName: user.name, targetUrl: '/settings', isSystem: true });
        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
