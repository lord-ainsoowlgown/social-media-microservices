require('dotenv').config();
const express = require('express');
const connectToDB = require('./database/db');
const Redis = require('ioredis');
const logger = require('./utils/logger');
const cors = require('cors');
const helmet = require('helmet');
const errorHandler = require('./middleware/errorHandler');
const { connectToRabbitMQ, consumeEvent } = require('./utils/rabbitmq');
const { handlePostCreated, handlePostDeleted } = require('./eventHandlers/search-event-handlers');
const searchRoutes = require('./routes/search-routes');

const app = express();
const PORT = process.env.PORT || 3004;

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

//*** Homework - pass redis client as part of your req and then implement redis caching
app.use("/api/search", searchRoutes);

// Error handler
app.use(errorHandler);

async function startServer() {
    try {
        await connectToRabbitMQ();

        //consume the events / subscribe to the events
        await consumeEvent("post.created", handlePostCreated);
        await consumeEvent("post.deleted", handlePostDeleted);

        app.listen(PORT, () => {
            logger.info(`Search Service running on port ${PORT}`);
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