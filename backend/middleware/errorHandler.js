const logger = require('../utils/logger');

module.exports = (err, req, res, next) => {
    logger.error(err.stack);
    
    const status = err.status || 500;
    const message = err.message || 'Error interno del servidor';
    
    res.status(status).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
};