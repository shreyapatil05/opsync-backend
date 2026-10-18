import mongoose from 'mongoose';
import { validationResult } from 'express-validator';

const hasUnsafeKey = (value) => {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(hasUnsafeKey);
  return Object.entries(value).some(([key, child]) =>
    key.startsWith('$') || key.includes('.') || hasUnsafeKey(child),
  );
};

export const validateRequestShape = (req, res, next) => {
  if (hasUnsafeKey(req.body) || hasUnsafeKey(req.query)) {
    return res.status(400).json({
      error: { code: 'INVALID_INPUT', message: 'Request contains unsupported field names' },
    });
  }

  for (const [name, value] of Object.entries(req.params)) {
    if ((name === 'id' || name.endsWith('Id')) && !mongoose.isValidObjectId(value)) {
      return res.status(400).json({
        error: { code: 'INVALID_IDENTIFIER', message: `${name} is invalid` },
      });
    }
  }
  next();
};

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Request validation failed',
      details: errors.array().map(({ path, msg }) => ({ field: path, message: msg })),
    },
  });
};

export const validateObjectIdParam = (req, res, next, value, name) => {
  if (!mongoose.isValidObjectId(value)) {
    return res.status(400).json({
      error: { code: 'INVALID_IDENTIFIER', message: `${name} is invalid` },
    });
  }
  next();
};
