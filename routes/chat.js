import express from 'express';
import * as chatController from '../controllers/chatController.js';
import auth from '../middlewares/auth.js';
import multer from 'multer';
import { addTeamMemberToChat } from '../controllers/chatController.js';

const router = express.Router();

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, 
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
router.get('/conversations/:conversationId/messages', auth, chatController.getMessages);
router.post('/conversations/:conversationId/messages', auth, chatController.sendMessage);
router.post('/conversations/direct', auth, chatController.startDirectConversation);
router.post('/team/add-member', auth, addTeamMemberToChat);


router.get('/teams/:teamId/conversation', auth, chatController.getTeamConversation);
router.get('/projects/:projectId/conversation', auth, chatController.getProjectConversation);


router.get('/users/search', auth, chatController.searchUsers);


router.post('/upload', auth, upload.single('file'), chatController.uploadFile);
router.delete('/file', auth, chatController.deleteFile);

export default router;