const logger = require('../utils/logger');
const { validateRegistration, validateLogin } = require('../utils/validation');
const User = require('../models/User');
const generateTokens = require('../utils/generateToken');
const RefreshToken = require('../models/RefreshToken');

// User Registration
const registerUser = async (req, res) => {
    logger.info('Registering endpoint hit...');
    try {
        // validate the schema
        const { error } = validateRegistration(req.body);
        if (error) {
            logger.warn(`Validation error: ${error.details[0].message}`);
            return res.status(400).json({ 
                success: false,
                message: error.details[0].message 
            });
        }

        const { username, email, password } = req.body;

        let user = await User.findOne({ $or: [ { username }, { email } ] });

        if (user) {
            logger.warn('User already exists');
            return res.status(400).json({ 
                success: false,
                message: 'User with given username or email already exists' 
            });
        }

        user = new User({ username, email, password });
        await user.save();
        logger.info('User registered successfully ', user._id);

        const { accessToken, refreshToken } = await generateTokens(user);

        return res.status(201).json({ 
            success: true,
            message: 'User registered successfully',
            accessToken,
            refreshToken
        });
    } catch(e) {
        logger.error('Registration error occurred', e);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
};

// User Login
const loginUser = async (req, res) => {
    logger.info('Login endpoint hit...');
    try {
        const { error } = validateLogin(req.body);
        if (error) {
            logger.warn(`Validation error: ${error.details[0].message}`);
            return res.status(400).json({ 
                success: false,
                message: error.details[0].message 
            });
        }

        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
            logger.warn('Invalid user');
            return res.status(400).json({ 
                success: false,
                message: 'Invalid Credentials' 
            });
        }

        // User valid password check
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            logger.warn('Invalid password attempt');
            return res.status(400).json({ 
                success: false,
                message: 'Invalid Credentials' 
            });
        }

        const { accessToken, refreshToken } = await generateTokens(user);
        return res.status(200).json({
            success: true,
            message: 'User Logged in successfully',
            accessToken,
            refreshToken,
            userId: user._id
        });
    } catch(e) {
        logger.error('Login error occurred', e);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
}

// Refresh Token
const refreshTokenController = async (req, res) => {
    logger.info('Refresh token endpoint hit...');
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            logger.warn('Refresh token missing');
            return res.status(400).json({
                success: false,
                message: 'Refresh Token is required'
            });
        }

        const storedToken = await RefreshToken.findOne({ token: refreshToken });
        if (!storedToken || storedToken.expiryDate < new Date()) {
            logger.warn('Invalid or expired refresh token');
            return res.status(401).json({
                success: false,
                message: 'Invalid Or Expired Refresh Token'
            });
        }

        const user = await User.findById(storedToken.userId);
        if (!user) {
            logger.warn('User not found for refresh token');
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = await generateTokens(user);

        // delete old refresh token and save new one
        await RefreshToken.deleteOne({ _id: storedToken._id });

        return res.status(201).json({
            success: true,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
    } catch(e) {
        logger.error('Refresh token error occurred', e);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
}

// Logout
const logoutUser = async (req, res) => {
    logger.info('Logout endpoint hit...');
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            logger.warn('Refresh token missing for logout');
            return res.status(400).json({
                success: false,
                message: 'Refresh Token missing'
            });
        }

        await RefreshToken.deleteOne({ token: refreshToken });
        logger.info('User logged out successfully');

        return res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch(e) {
        logger.error('Logout error occurred', e);
        res.status(500).json({
            success: false,
            message: 'Internal Server Error'
        });
    }
};


module.exports = {
    registerUser,
    loginUser,
    refreshTokenController,
    logoutUser
}