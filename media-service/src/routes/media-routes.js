const express = require('express');
const multer = require('multer');
const { uploadMedia, getAllMedia } = require('../controllers/media-controller');
const { authenticateRequest } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
}).single("file");

router.post('/upload', authenticateRequest,  (req, res, next) => {
    upload(req, res, function(err) {
        if (err instanceof multer.MulterError) {
            logger.error('Multer error while uploading:', err)
            return res.status(400).json({ 
                success: false,
                message: 'Multer error while uploading',
                error: err.message,
                stack: err.stack
            });
        } else if (err) {
            logger.error('Unknown error while uploading:', err)
            return res.status(500).json({ 
                success: false,
                message: 'Unknown error while uploading',
                error: err.message,
                stack: err.stack
            });
        }

        if (!req.file) {
            logger.warn('No file provided in the request');
            return res.status(400).json({ 
                success: false,
                message: 'No file provided in the request' 
            });
        }
        next();
    });
}, uploadMedia);

router.get('/get', authenticateRequest, getAllMedia);

module.exports = router;