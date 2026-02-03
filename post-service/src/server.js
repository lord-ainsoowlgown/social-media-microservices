require('dotenv').config();
const express = require('express');
const connectToDB = require('./database/db');
const Redis = require('ioredis');
const logger = require('./utils/logger');
const cors = require('cors');
const helmet = require('helmet');
const postRoutes = require('./routes/post-routes');
const errorHandler = require('./middleware/errorHandler');
const { connectToRabbitMQ } = require('./utils/rabbitmq');

const app = express();
const PORT = process.env.PORT || 3002;

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

// Implement ip based rate limiting for sensitive endpoints

// routes -> pass redis client to routes
app.use('/api/posts', (req, res, next) => {
    req.redisClient = redisClient;
    next();
}, postRoutes);

// Error handler
app.use(errorHandler);

async function startServer() {
    try {
        await connectToRabbitMQ();

        app.listen(PORT, () => {
            logger.info(`Post Service running on port ${PORT}`);
        });
    } catch (error) {
        logger.error('Failed to connect to RabbitMQ server', error);
        process.exit(1);
    }
}

startServer();

// Unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});