import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const auth = async (req, res, next) => {
  try {
    
    const token = req.cookies.accessToken;
    
    console.log("Auth middleware - accessToken present:", !!token);
    
    if (!token) {
      return res.status(401).json({ error: 'No token, authorization denied' });
    }
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    console.log("Token decoded for user:", decoded.id);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ error: 'Token invalid - user not found' });
    }

    req.user = user;
    console.log("Auth successful for:", user.email);
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Access token expired" });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ error: "Invalid token" });
    }

    res.status(401).json({ error: 'Authentication failed' });
  }
};

export default auth;