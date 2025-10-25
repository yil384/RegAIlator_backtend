const mongoose = require('mongoose');
const http = require('http'); // 引入 http 模块用于创建服务器
const socketIo = require('socket.io'); // 引入 socket.io 用于 WebSocket 实时通信
const app = require('./app'); // 你的 Express 应用
const config = require('./configs/config');
const logger = require('./configs/logger');
const emailListener = require('./services/emailListener.service'); // 引入邮件监听器

let server;

// 创建 HTTP 服务器，将 Express 应用绑定到 HTTP 服务器
const httpServer = http.createServer(app);

// 初始化 socket.io 并与 HTTP 服务器关联
const io = socketIo(httpServer, {
  cors: {
    origin: '*', // 设置允许的来源
    methods: ['GET', 'POST']
  }
});

io.on('connection', async (socket) => {
  console.log('New client connected');
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
  console.log('mongoose url', config.mongoose.url);
  console.log('mongoose options', config.mongoose.options);
  logger.info('Connected to MongoDB');

  // 启动 HTTP 服务器并监听指定的端口
  server = httpServer.listen(config.port, '0.0.0.0', () => {
    logger.info(`Listening to port ${config.port}`);
  });

  // 启动邮件监听，并将 WebSocket 实例传递给它
  emailListener(io); // 将 io 传递给 emailListener 以便推送消息给前端
});

// 处理退出信号
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

// 处理未捕获的异常和未处理的 promise 拒绝
const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});
