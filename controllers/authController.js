import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import RefreshToken from '../models/RefreshToken.js';

export const login = [
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { email, password } = req.body;
      const user = await User.findOne({ email }).select('+password');
      if (!user || !(await user.comparePassword(password))) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      user.lastLogin = new Date();
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

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: true,              
        sameSite: 'None', 
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,              
        sameSite: 'None', 
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.json({ user: { id: user._id, name: user.name, email, role: user.role } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
];

export const signup = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Invalid email format'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').optional().isIn(['Admin', 'Manager', 'Employee']).withMessage('Invalid role'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { name, email, password, role } = req.body;
      let user = await User.findOne({ email });
      if (user) return res.status(400).json({ error: 'User already exists' });

      user = new User({ name, email, password, role });
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

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: true,             
        sameSite: 'None', 
        maxAge: 15 * 60 * 1000,
      });
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: true,              
        sameSite: 'None', 
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(201).json({ user: { id: user._id, name, email, role } });
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

    
    res.cookie('accessToken', newAccessToken, {
  httpOnly: true,
  secure: true,              
  sameSite: 'None', 
  maxAge: 15 * 60 * 1000,
});

res.cookie('refreshToken', newRefreshToken, {
  httpOnly: true,
  secure: true,              
  sameSite: 'None', 
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

console.log("🔄 Cookies set successfully");

    res.json({ 
      user: { 
        id: user._id, 
        name: user.name, 
        email: user.email, 
        role: user.role 
      },
      message: 'Tokens refreshed successfully'
    });
  } catch (error) {
    console.error('🔄 Refresh token error:', error);
    
    
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
        res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProfile = async (req, res) => {
    const { name, email, phone, bio, location, avatar } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        user.name = name || user.name;
        user.email = email || user.email;
        user.phone = phone;
        user.bio = bio;
        user.location = location;
        user.avatar = avatar;

        await user.save();
        res.json(user);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ error: 'Server error' });
    }
};


export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
   
    const toEmail = 'patilshreya7905@gmail.com'; 
    const user = await User.findOne({ email }); 
    if (!user) return res.status(404).json({ error: 'User not found' });

    const resetToken = jwt.sign(
      { id: user._id },
      process.env.JWT_ACCESS_SECRET,
      { expiresIn: '1h' }
    );

    const transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 587,
      secure: false,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY,
      },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    await transporter.sendMail({
      from: 'onboarding@resend.dev',
      to: toEmail,
      subject: 'Opsync Password Reset',
      html: `<p>Please click <a href="${resetUrl}">here</a> to reset your password. Link expires in 1 hour.</p>`,
    });

    res.json({ message: 'Reset email sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const resetPassword = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

      const { token, password } = req.body;
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      user.password = password; // Will be hashed by pre-save hook
      await user.save();

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      res.status(401).json({ error: 'Invalid or expired reset token' });
    }
  },
];
export const changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid current password' });
        }

        user.password = newPassword;
        await user.save();
        res.status(200).json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ error: 'Server error' });
    }
};