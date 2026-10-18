import express from 'express'
import * as userController from '../controllers/userController.js'
import auth from '../middlewares/auth.js'
import admin from '../middlewares/admin.js'
import { validateObjectIdParam } from '../middlewares/validation.js'
import { searchValidation, userCreateValidation, userUpdateValidation } from '../validators/index.js'

const router = express.Router()
router.param('id', validateObjectIdParam)

router.get('/', auth, admin, userController.getAllUsers)
router.get('/search', auth, searchValidation, userController.searchUsers)
router.post('/', auth, admin, userCreateValidation, userController.createUser)
router.get('/:id', auth, userController.getUser)
router.put('/:id', auth, userUpdateValidation, userController.updateUser)
router.delete('/:id', auth, admin, userController.deleteUser)


export default router;
