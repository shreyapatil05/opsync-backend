import express from 'express';
import multer from 'multer';
import * as fileController from '../controllers/fileController.js';
import auth from '../middlewares/auth.js';
import { validateObjectIdParam } from '../middlewares/validation.js';
import { validateFileSignature } from '../middlewares/fileSignature.js';


const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, 
  },
  fileFilter: (req, file, cb) => cb(null, [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ].includes(file.mimetype))
});

const router = express.Router();
for (const name of ['projectId', 'fileId']) router.param(name, validateObjectIdParam);


router.post('/:projectId/upload', 
  auth, 
  upload.single('file'),
  validateFileSignature,
  fileController.uploadFileController
);

router.get('/:projectId', auth, fileController.getFilesByProject);
router.get('/:fileId/download', auth, fileController.downloadFileController);
router.delete('/:fileId', auth, fileController.deleteFileController);


export default router;
