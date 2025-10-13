import express from 'express';
import * as ruleController from '../controllers/ruleController.js';
import auth from '../middlewares/auth.js';
import admin from '../middlewares/admin.js'; 

const router = express.Router();

router.get('/', auth, admin, ruleController.getRules);
router.post('/', auth, admin, ruleController.createRule);
router.put('/:id', auth, admin, ruleController.updateRule);
router.delete('/:id', auth, admin, ruleController.deleteRule);

export default router;