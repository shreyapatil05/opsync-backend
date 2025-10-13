const errorHandler = (err, req, res, next) => {
   
    console.error(err);

    
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Server Error';

    
    res.status(statusCode).json({
        error: {
            message: message,
            
            ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
        },
    });
};

export default errorHandler;