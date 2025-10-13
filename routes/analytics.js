import express from 'express';
import { getEmployeeAnalytics, getProjectsForEmployee } from '../controllers/analyticsController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();


router.get('/employee', auth, getEmployeeAnalytics);
router.get('/projects', auth, getProjectsForEmployee);

export default router;
