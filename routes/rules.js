import express from 'express';
import * as ruleController from '../controllers/ruleController.js';
import auth from '../middlewares/auth.js';
import admin from '../middlewares/admin.js'; 
import { validateObjectIdParam } from '../middlewares/validation.js';
import { ruleCreateValidation, ruleUpdateValidation } from '../validators/index.js';

const router = express.Router();
router.param('id', validateObjectIdParam);

router.get('/', auth, admin, ruleController.getRules);
router.post('/', auth, admin, ruleCreateValidation, ruleController.createRule);
router.put('/:id', auth, admin, ruleUpdateValidation, ruleController.updateRule);
router.delete('/:id', auth, admin, ruleController.deleteRule);

export default router;
