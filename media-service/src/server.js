require('dotenv').config();
const express = require('express');
const connectToDB = require('./database/db');
const Redis = require('ioredis');
const logger = require('./utils/logger');
const cors = require('cors');
const helmet = require('helmet');
const mediaRoutes = require('./routes/media-routes');
const errorHandler = require('./middleware/errorHandler');
const { connectToRabbitMQ, consumeEvent } = require('./utils/rabbitmq');
const { handlePostDeleted } = require('./eventsHandlers/media-event-handlers');

const app = express();
const PORT = process.env.PORT || 3003;

connectToDB();

app.use(cors());
app.use(helmet());
app.use(express.json());

app.use((req, res, next) => {
    logger.info(`Received ${req.method} request to ${req.url}`);
    logger.info(`Request body, ${req.body}`);
    next();
});

// Implement ip based rate limiting for sensitive endpoints

// Routes
app.use('/api/media', mediaRoutes);

// Error handler
app.use(errorHandler);


async function startServer() {
    try {
        await connectToRabbitMQ();

        // Consume all the events
        await consumeEvent('post.deleted', handlePostDeleted);

        app.listen(PORT, () => {
            logger.info(`Media Service running on port ${PORT}`);
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