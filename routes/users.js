import express from 'express'
import * as userController from '../controllers/userController.js'
import auth from '../middlewares/auth.js'
import admin from '../middlewares/admin.js'

const router = express.Router()

router.get('/', auth, admin, userController.getAllUsers)
router.get('/search', auth, userController.searchUsers)
router.post('/', auth, admin, userController.createUser)
router.get('/:id', auth, userController.getUser)
router.put('/:id', auth, userController.updateUser)
router.delete('/:id', auth, admin, userController.deleteUser)


export default router;