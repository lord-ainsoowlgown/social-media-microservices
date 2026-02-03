const mongoose = require("mongoose");
const logger = require("../utils/logger");

const connectToDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("MongoDB connected successfully");
  } catch (e) {
    logger.error("MongoDB connection failed");
    process.exit(1);
  }
};

module.exports = connectToDB;