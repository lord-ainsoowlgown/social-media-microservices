const logger = require('../utils/logger');
const { uploadMediaToCloudinary } = require('../utils/cloudinary');
const Media = require('../models/Media');

const uploadMedia = async (req, res) => {
    logger.info('Starting media upload process');
    try {
        if(!req.file) {
            logger.warn('No file found. Please add a file and try again.');
            return res.status(400).json({ 
                success: false,
                message: 'No file found. Please add a file and try again.' 
            });
        }

        const { originalname, mimetype, buffer } = req.file;
        const userId = req.user.userId; // Assuming user ID is available in req.user

        logger.info(`File details - Name: ${originalname}, Type: ${mimetype}`);
        logger.info('Uploading to cloudinary starting...');

        const cloudinaryUploadResult = await uploadMediaToCloudinary(req.file);
        logger.info('Upload to Cloudinary successful. Public ID: ', cloudinaryUploadResult.public_id);
        

        const newlyCreatedMedia = new Media({
            publicId: cloudinaryUploadResult.public_id,
            originalName: originalname,
            mimeType: mimetype,
            url: cloudinaryUploadResult.secure_url,
            userId,
        });

        await newlyCreatedMedia.save();
        logger.info('Media metadata saved to database with ID: ', newlyCreatedMedia._id);

        res.status(201).json({
            success: true,
            message: 'Media uploaded successfully',
            mediaId: newlyCreatedMedia._id,
            url: newlyCreatedMedia.url,
        });
    } catch (error) {
        logger.error('Media upload failed:', error);
        res.status(500).json({ message: 'Media upload failed', error: error.message });
    }
}

const getAllMedia = async (req, res) => {
    try {
        const results = await Media.find({});
        res.status(200).json({
            success: true,
            results,
        });
    } catch (error) {
        logger.error('Error fetching media:', error);
        res.status(500).json({ 
            success: false,
            message: 'Error fetching media',
            error: error.message
        });
    }
}

module.exports = {
    uploadMedia,
    getAllMedia,
};