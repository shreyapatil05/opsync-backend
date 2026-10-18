import dotenv from "dotenv";
dotenv.config();
import express from "express";
import './config/cloudinary.js';
import mongoose from "mongoose";
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
import activityRoutes from './routes/activities.js';


import socketSetup from './socket/index.js';


import errorHandler from './middlewares/error.js';
import { csrfProtection } from './middlewares/csrf.js';
import { requestContext } from './middlewares/requestContext.js';
import { validateRequestShape } from './middlewares/validation.js';
import { logger } from './utils/logger.js';
import { openApiDocument } from './docs/openapi.js';



const app = express();
app.set('trust proxy', 1);
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173', 
  'http://localhost:3000'  
].filter(Boolean); 

const server = createServer(app); 
const io = new Server(server, {
    cors: {
        origin: allowedOrigins, 
        methods: ['GET', 'POST'],
        credentials: true,
    },
});

import connectDB from './config/db.js'


app.use(express.json({ limit: '10mb' }))


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
app.use(cookieParser())
app.use(requestContext)
app.use(validateRequestShape)
app.use(csrfProtection)

app.use('/uploads', express.static('uploads'))
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === 'production' ? 500 : 2000,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please try again later' } },
}));


app.get('/health/live', (req, res) => res.json({ status: 'ok' }));
app.get('/health/ready', (req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready', database: ready ? 'connected' : 'disconnected' });
});
app.get('/api/openapi.json', (req, res) => res.json(openApiDocument));
app.get('/api/docs', (req, res) => {
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self' https://unpkg.com 'unsafe-inline'; style-src 'self' https://unpkg.com 'unsafe-inline'");
  res.type('html').send(`<!doctype html><html><head><title>OpSync API</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:'/api/openapi.json',dom_id:'#swagger-ui'});</script></body></html>`);
});

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
app.use('/api/activities', activityRoutes)


socketSetup(io);

app.set('io', io);


app.use((req, res) => res.status(404).json({
  error: { code: 'NOT_FOUND', message: 'Route not found', requestId: req.requestId },
}));
app.use(errorHandler)


const PORT = process.env.PORT || 5000;
await connectDB();

server.listen(PORT, () => {
  logger.info('server_started', { port: Number(PORT), environment: process.env.NODE_ENV || 'development' });
});

let shuttingDown = false;
const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('shutdown_started', { signal });

  const forceExit = setTimeout(() => {
    logger.error('shutdown_timeout');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  server.close(async (error) => {
    if (error) {
      logger.error('server_close_failed', { errorMessage: error.message });
      process.exitCode = 1;
    }
    await mongoose.disconnect();
    clearTimeout(forceExit);
    logger.info('shutdown_complete');
    process.exit();
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { errorMessage: reason instanceof Error ? reason.message : String(reason) });
  shutdown('unhandledRejection');
});
process.on('uncaughtException', (error) => {
  logger.error('uncaught_exception', { errorMessage: error.message, stack: error.stack });
  shutdown('uncaughtException');
});

export { app, server };
