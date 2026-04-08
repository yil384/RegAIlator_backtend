const mongoose = require('mongoose');
const http = require('http');
const socketIo = require('socket.io');
const app = require('./app');
const config = require('./configs/config');
const logger = require('./configs/logger');
const emailListener = require('./services/emailListener.service');

let server;

// Create HTTP server bound to Express app
const httpServer = http.createServer(app);

// Initialize Socket.io with CORS support
const io = socketIo(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  logger.info('New client connected');
  socket.on('disconnect', () => {
    logger.info('Client disconnected');
  });
});

// Connect to MongoDB then start the server
mongoose
  .connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    logger.info('Connected to MongoDB');

    server = httpServer.listen(config.port, '0.0.0.0', () => {
      logger.info(`Listening to port ${config.port}`);
    });

    // Handle port-in-use error gracefully instead of crash-looping
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${config.port} is already in use. Retrying in 3 seconds...`);
        setTimeout(() => {
          server.close();
          server.listen(config.port, '0.0.0.0');
        }, 3000);
      } else {
        logger.error(`Server error: ${err.message}`);
        process.exit(1);
      }
    });

    // Start email listener with WebSocket instance for real-time push
    emailListener(io);
  })
  .catch((err) => {
    logger.error(`Failed to connect to MongoDB: ${err.message}`);
    process.exit(1);
  });

// Graceful shutdown
const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
});
