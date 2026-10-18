import { logger } from '../utils/logger.js';

const errorHandler = (err, req, res, next) => {
    if (res.headersSent) return next(err);

    let statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
    let code = err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_FAILED');
    let message = err.message || 'Server error';
    if (err.code === 11000) {
      statusCode = 409;
      code = 'DUPLICATE_RESOURCE';
      message = 'A resource with that value already exists';
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      statusCode = 413;
      code = 'FILE_TOO_LARGE';
      message = 'Uploaded file exceeds the allowed size';
    }
    if (err.name === 'CastError') {
      statusCode = 400;
      code = 'INVALID_IDENTIFIER';
      message = 'Invalid resource identifier';
    }
    const isServerError = statusCode >= 500;
    logger.error('request_failed', {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: statusCode,
      errorName: err.name,
      errorMessage: err.message,
      stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
    });

    res.status(statusCode).json({
      error: {
        code,
        message: isServerError && process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred'
          : message,
        requestId: req.requestId,
      },
    });
};

export default errorHandler;
