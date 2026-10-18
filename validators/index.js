import { body, query } from 'express-validator';
import { handleValidationErrors } from '../middlewares/validation.js';

const objectId = field => body(field).optional({ values: 'null' }).isMongoId();
const text = (field, min, max) => body(field).optional().isString().trim().isLength({ min, max });

export const loginValidation = [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 1, max: 128 }),
  handleValidationErrors,
];

export const signupValidation = [
  body('name').isString().trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 128 }),
  handleValidationErrors,
];

export const resetPasswordValidation = [
  body('token').isString().isLength({ min: 32, max: 256 }),
  body('password').isString().isLength({ min: 8, max: 128 }),
  handleValidationErrors,
];

export const projectCreateValidation = [
  body('name').isString().trim().isLength({ min: 1, max: 150 }),
  text('description', 0, 2000), objectId('teamId'), objectId('projectManager'),
  body('assignedMembers').optional().isArray({ max: 200 }),
  body('assignedMembers.*').optional().isMongoId(),
  handleValidationErrors,
];

export const projectUpdateValidation = [
  text('name', 1, 150), text('description', 0, 2000), objectId('teamId'), objectId('projectManager'),
  body('status').optional().isIn(['todo', 'in-progress', 'completed']),
  body('progress').optional().isInt({ min: 0, max: 100 }),
  body('assignedMembers').optional().isArray({ max: 200 }),
  body('assignedMembers.*').optional().isMongoId(),
  handleValidationErrors,
];

export const taskCreateValidation = [
  body('title').isString().trim().isLength({ min: 1, max: 200 }),
  text('description', 0, 3000),
  body('status').optional().isIn(['todo', 'in-progress', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  objectId('assignee'), body('dueDate').optional({ values: 'falsy' }).isISO8601(),
  handleValidationErrors,
];

export const taskUpdateValidation = [
  text('title', 1, 200), text('description', 0, 3000),
  body('status').optional().isIn(['todo', 'in-progress', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high']),
  objectId('assignee'), body('dueDate').optional({ values: 'falsy' }).isISO8601(),
  handleValidationErrors,
];

export const teamCreateValidation = [
  body('name').isString().trim().isLength({ min: 1, max: 120 }),
  text('description', 0, 1000), text('department', 0, 100),
  handleValidationErrors,
];

export const teamUpdateValidation = [
  text('name', 1, 120), text('description', 0, 1000), text('department', 0, 100),
  handleValidationErrors,
];

export const teamMemberValidation = [body('email').isEmail().normalizeEmail(), handleValidationErrors];

export const userCreateValidation = [
  body('name').isString().trim().isLength({ min: 2, max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8, max: 128 }),
  body('role').optional().isIn(['Admin', 'Manager', 'Employee']),
  handleValidationErrors,
];

export const userUpdateValidation = [
  text('name', 1, 100), body('email').optional().isEmail().normalizeEmail(),
  body('role').optional().isIn(['Admin', 'Manager', 'Employee']),
  text('phone', 0, 30), text('bio', 0, 500), text('location', 0, 100),
  body('avatar').optional({ values: 'falsy' }).isURL({ protocols: ['https'], require_protocol: true }),
  handleValidationErrors,
];

export const messageCreateValidation = [
  body('content').optional().isString().trim().isLength({ min: 1, max: 5000 }),
  body('messageType').optional().isIn(['text', 'file', 'image', 'video', 'system']),
  body('replyTo').optional({ values: 'null' }).isMongoId(),
  handleValidationErrors,
];

export const directConversationValidation = [body('userId').isMongoId(), handleValidationErrors];
export const messageUpdateValidation = [body('content').isString().trim().isLength({ min: 1, max: 5000 }), handleValidationErrors];
export const reactionValidation = [body('emoji').isString().trim().isLength({ min: 1, max: 16 }), handleValidationErrors];

export const ruleCreateValidation = [
  body('name').isString().trim().isLength({ min: 1, max: 120 }),
  body('condition').isString().trim().isLength({ min: 1, max: 500 }),
  body('action').isIn(['notify_manager', 'send_report', 'escalate_senior']),
  body('projectId').isMongoId(), handleValidationErrors,
];

export const ruleUpdateValidation = [
  text('name', 1, 120), text('condition', 1, 500),
  body('action').optional().isIn(['notify_manager', 'send_report', 'escalate_senior']),
  body('isActive').optional().isBoolean(), objectId('projectId'), handleValidationErrors,
];

export const searchValidation = [
  query('q').optional().isString().trim().isLength({ min: 1, max: 100 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidationErrors,
];
