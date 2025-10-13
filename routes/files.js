import express from 'express';
import multer from 'multer';
import * as fileController from '../controllers/fileController.js';
import auth from '../middlewares/auth.js';


const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, 
  },
  fileFilter: (req, file, cb) => {
    console.log('Multer File Filter:');
    console.log('   - File name:', file.originalname);
    console.log('   - MIME type:', file.mimetype);
    console.log('   - Field name:', file.fieldname);
    cb(null, true); 
  }
});

const router = express.Router();


router.use('/:projectId/upload', (req, res, next) => {
 
  console.log('Method:', req.method);
  console.log('URL:', req.originalUrl);
  console.log('Headers:', req.headers['content-type']);
  console.log('User:', req.user?.id);
  console.log('Project ID:', req.params.projectId);
  next();
});


router.post('/:projectId/upload', 
  auth, 
  upload.single('file'),
  (req, res, next) => {
    console.log(' Multer passed - File details:');
    console.log('   - File:', req.file);
    console.log('   - Body:', req.body);
    next();
  },
  fileController.uploadFileController
);

router.get('/:projectId', auth, fileController.getFilesByProject);
router.get('/:fileId/download', auth, fileController.downloadFileController);
router.delete('/:fileId', auth, fileController.deleteFileController);


export default router;