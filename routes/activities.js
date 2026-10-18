import express from 'express';
import auth from '../middlewares/auth.js';
import { validateObjectIdParam } from '../middlewares/validation.js';
import * as activityController from '../controllers/activityController.js';

const router = express.Router();
router.param('id', validateObjectIdParam);
router.get('/me', auth, activityController.getMyActivity);
router.patch('/:id/saved', auth, activityController.toggleSaved);
export default router;
