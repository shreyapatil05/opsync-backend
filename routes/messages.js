import express from 'express';
import * as messageController from '../controllers/messageController.js';
import auth from '../middlewares/auth.js';

const router = express.Router();


router.get('/:messageId', auth, messageController.getMessage);
router.put('/:messageId', auth, messageController.updateMessage);
router.delete('/:messageId', auth, messageController.deleteMessage);
router.post('/:messageId/read', auth, messageController.markAsRead);
router.post('/:messageId/reactions', auth, messageController.addReaction);
router.delete('/:messageId/reactions', auth, messageController.removeReaction);

export default router;