require('dotenv').config();
const express = require('express');
const connectToDB = require('./database/db');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('./utils/logger');
const { RateLimiterRedis } = require('rate-limiter-flexible');
const Redis = require('ioredis');
const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const routes = require('./routes/identity-service');
const errorHandler = require("./middleware/errorHandler");
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectToDB();

const redisClient = new Redis(process.env.REDIS_URL);

// Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    logger.info(`Received ${req.method} request to ${req.url}`);
    logger.info(`Request body, ${req.body}`);
    next();
});

// DDOS protection and rate limiting
const rateLimiter = new RateLimiterRedis({
    storeClient: redisClient,
    keyPrefix: 'middleware',
    points: 10, // 10 requests
    duration: 2, // per 2 seconds by IP
});

app.use((req, res, next) => {
    rateLimiter.consume(req.ip).then(() => {
        next();
    }).catch(() => {
        logger.info(`Rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too Many Requests'
        });
    });
});

// Ip based rate limiting  for the sensitive endpoints
const sensitiveEndpointsLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 20 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.info(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
        res.status(429).json({
            success: false,
            message: 'Too Many Requests on sensitive endpoint'
        });
    },
    store: new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
    }),
});

// Apply this sensitiveEndpointsLimiter to our sensitive routes
app.use('/api/auth/register', sensitiveEndpointsLimiter);

// Routes
app.use('/api/auth', routes);

// Error handler
app.use(errorHandler);


app.listen(PORT, () => {
    logger.info(`Identity Service running on port ${PORT}`);
});

// Unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});