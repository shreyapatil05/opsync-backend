import express from 'express'
import * as authController from '../controllers/authController.js'
import auth from '../middlewares/auth.js'

const router = express.Router()

router.post('/login', authController.login)
router.post('/signup', authController.signup)
router.post('/refresh', authController.refreshToken)
router.post('/logout', auth, authController.logout)
router.post('/forgot-password', authController.forgotPassword)
router.post('/reset-password', authController.resetPassword)
router.get('/profile',auth,  authController.getProfile)
router.put('/profile', auth, authController.updateProfile);
router.post('/change-password', auth, authController.changePassword);



export default router