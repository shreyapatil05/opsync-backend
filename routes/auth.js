import express from 'express'
import * as authController from '../controllers/authController.js'
import auth from '../middlewares/auth.js'
import { issueCsrfToken } from '../middlewares/csrf.js'
import { body } from 'express-validator'
import { handleValidationErrors } from '../middlewares/validation.js'
import { loginValidation, resetPasswordValidation, signupValidation } from '../validators/index.js'
import rateLimit from 'express-rate-limit'
import * as accountController from '../controllers/accountController.js'

const router = express.Router()

router.get('/csrf-token', issueCsrfToken)

router.post('/login', loginValidation, authController.login)
router.post('/signup', signupValidation, authController.signup)
router.post('/refresh', authController.refreshToken)
router.post('/logout', auth, authController.logout)
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many password reset attempts. Try again later.' } },
});

router.post('/forgot-password', passwordResetLimiter, body('email').isEmail().normalizeEmail(), handleValidationErrors, authController.forgotPassword)
router.post('/reset-password', passwordResetLimiter, resetPasswordValidation, authController.resetPassword)
router.get('/profile',auth,  authController.getProfile)
router.put('/profile', auth,
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('phone').optional().isLength({ max: 30 }),
  body('bio').optional().isLength({ max: 500 }),
  body('location').optional().isLength({ max: 100 }),
  body('avatar').optional({ values: 'falsy' }).isURL({ protocols: ['https'], require_protocol: true }),
  handleValidationErrors,
  authController.updateProfile,
);
router.post('/change-password', auth,
  body('currentPassword').isString().notEmpty(),
  body('newPassword').isLength({ min: 8, max: 128 }),
  handleValidationErrors,
  authController.changePassword,
);

const accountActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Too many account requests. Try again later.' } },
});

router.patch('/account/profile', auth,
  body('name').optional().trim().isLength({ min: 1, max: 100 }),
  body('username').optional().trim().toLowerCase().matches(/^[a-z0-9_]{3,30}$/),
  body('phone').optional().trim().isLength({ max: 30 }),
  body('bio').optional().trim().isLength({ max: 500 }),
  body('location').optional().trim().isLength({ max: 100 }),
  handleValidationErrors,
  accountController.updateAccountProfile,
);
router.put('/account/avatar', auth,
  body('avatar').isURL({ protocols: ['https'], require_protocol: true }).custom(value => { const host = new URL(value).hostname; return host === 'cloudinary.com' || host.endsWith('.cloudinary.com'); }),
  body('publicId').isString().trim().isLength({ min: 1, max: 300 }).custom(value => value.startsWith('opsync/avatars/')),
  handleValidationErrors,
  accountController.updateAvatar,
);
router.delete('/account/avatar', auth, accountController.removeAvatar);
router.post('/account/email-verification', auth, accountActionLimiter, accountController.requestEmailVerification);
router.post('/account/verify-email', accountActionLimiter,
  body('token').isHexadecimal().isLength({ min: 64, max: 64 }),
  handleValidationErrors,
  accountController.verifyEmail,
);
router.get('/account/export', auth, accountActionLimiter, accountController.exportAccountData);
router.post('/account/deactivate', auth, accountActionLimiter,
  body('password').isString().isLength({ min: 8, max: 128 }),
  handleValidationErrors,
  accountController.deactivateAccount,
);
router.delete('/account', auth, accountActionLimiter,
  body('password').isString().isLength({ min: 8, max: 128 }),
  body('confirmation').equals('DELETE'),
  handleValidationErrors,
  accountController.deleteAccount,
);



export default router
