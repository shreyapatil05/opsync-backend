import dotenv from 'dotenv';
dotenv.config();
import cron from 'node-cron';
import mongoose from 'mongoose';
import connectDB from './config/db.js';
import { runOverdueCheck } from './services/automationService.js';
import { logger } from './utils/logger.js';

await connectDB();
logger.info('automation_worker_started');

const job = cron.schedule(process.env.AUTOMATION_CRON || '0 9 * * *', async () => {
  try {
    await runOverdueCheck();
  } catch (error) {
    logger.error('automation_worker_run_failed', { errorMessage: error.message, stack: error.stack });
  }
});

if (process.env.AUTOMATION_RUN_ON_START === 'true') await runOverdueCheck();

let shuttingDown = false;
const shutdown = async signal => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('automation_worker_shutdown_started', { signal });
  job.stop();
  await mongoose.disconnect();
  logger.info('automation_worker_shutdown_complete');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
