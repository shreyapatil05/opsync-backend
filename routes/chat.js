import express from 'express';
import * as chatController from '../controllers/chatController.js';
import auth from '../middlewares/auth.js';
import multer from 'multer';
import { query } from 'express-validator';
import { handleValidationErrors, validateObjectIdParam } from '../middlewares/validation.js';
import { directConversationValidation, messageCreateValidation, searchValidation } from '../validators/index.js';
import { validateFileSignature } from '../middlewares/fileSignature.js';

const router = express.Router();
for (const name of ['conversationId', 'teamId', 'projectId']) router.param(name, validateObjectIdParam);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {

    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/mpeg',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});


router.get('/conversations', auth, chatController.getConversations);
router.get('/conversations/:conversationId/messages', auth,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('before').optional().isISO8601(),
  handleValidationErrors,
  chatController.getMessages,
);
router.post('/conversations/:conversationId/messages', auth, messageCreateValidation, chatController.sendMessage);
router.post('/conversations/direct', auth, directConversationValidation, chatController.startDirectConversation);


router.get('/teams/:teamId/conversation', auth, chatController.getTeamConversation);
router.get('/projects/:projectId/conversation', auth, chatController.getProjectConversation);


router.get('/users/search', auth, searchValidation, chatController.searchUsers);


router.post('/upload', auth, upload.single('file'), validateFileSignature, chatController.uploadFile);
router.delete('/file', auth, chatController.deleteFile);

export default router;
