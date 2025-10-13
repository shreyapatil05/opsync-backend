import dotenv from "dotenv";
dotenv.config();
import express from "express";
import './config/cloudinary.js';
import mongoose from "mongoose";
import morgan from "morgan";
import cors from "cors";
import helmet from 'helmet';
import { Server } from "socket.io";
import { createServer } from 'http';
import cookieParser from "cookie-parser";
import rateLimit from 'express-rate-limit';

// Routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import projectRoutes from "./routes/projects.js";
import chatRoutes from "./routes/chat.js";
import fileRoutes from "./routes/files.js";
import ruleRoutes from "./routes/rules.js";
import analyticsRoutes from './routes/analytics.js';
import teamRoutes from './routes/teams.js'
import messageRoutes from './routes/messages.js';
import dashboardRoutes from './routes/dashboard.js';


import socketSetup from './socket/index.js';


import errorHandler from './middlewares/error.js';

const app = express();
const server = createServer(app); 
const io = new Server(server, {
    cors: {
        origin: allowedOrigins, 
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

import connectDB from './config/db.js'
await connectDB();


app.use(express.json({ limit: '10mb' }))

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173', 
  'http://localhost:3000'  
].filter(Boolean); 
app.use(cors({
  origin: function (origin, callback) {
    
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true
}));

app.use(helmet())
app.use(morgan('dev'))
app.use(cookieParser())

app.use('/uploads', express.static('uploads'))
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, 
    message: { error: 'Too many requests, please try again later' },
}));


app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/projects', projectRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/files', fileRoutes)
app.use('/api/rules', ruleRoutes)
app.use('/api/analytics', analyticsRoutes);
app.use('/api/teams', teamRoutes)
app.use('/api/chat/messages', messageRoutes);
app.use('/api/dashboard',dashboardRoutes )


socketSetup(io);

app.set('io', io);


app.use(errorHandler)


const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});