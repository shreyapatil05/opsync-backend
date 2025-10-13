import express from 'express';
import auth from '../middlewares/auth.js';
import admin from '../middlewares/admin.js';
import * as dashboardController from '../controllers/dashboardController.js';

const router = express.Router();


router.get('/metrics', auth, admin, dashboardController.getMetrics);
router.get('/projects', auth, admin, dashboardController.getProjects);
router.get('/activities', auth, admin, dashboardController.getActivities);

router.get('/employees', auth, admin, dashboardController.getAllEmployees);
router.post('/employees', auth, admin, dashboardController.addEmployee);
router.get('/teams', auth, admin, dashboardController.getAllTeams);

export default router;