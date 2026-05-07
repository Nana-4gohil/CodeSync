// src/index.js
require('dotenv').config(); // Load .env first — before any other require

const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { Server: SocketServer } = require('socket.io');

const { connectDB } = require('./config/db');
const { errorHandler } = require('./middleware/error');
const { apiLimiter } = require('./middleware/rateLimit');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes      = require('./routes/auth.routes');
const roomRoutes      = require('./routes/room.routes');
const fileRoutes      = require('./routes/file.routes');
const chatRoutes      = require('./routes/chat.routes');
const executionRoutes = require('./routes/execution.routes');

// ── Socket ────────────────────────────────────────────────────────────────────
const { initSocketServer } = require('./socket');

// ─────────────────────────────────────────────────────────────────────────────

async function bootstrap() {
  // 1. Connect to MongoDB
  await connectDB();

  // 2. Create Express app
  const app = express();

  // ── Security & utility middleware ──────────────────────────────────────────
  app.use(helmet());

  app.use(cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

  // ── Global rate limiter ────────────────────────────────────────────────────
  app.use('/api', apiLimiter);

  // ── REST API Routes ────────────────────────────────────────────────────────
  app.use('/api/auth',                  authRoutes);
  app.use('/api/rooms',                 roomRoutes);
  app.use('/api/rooms/:roomId/files',   fileRoutes);
  app.use('/api/rooms/:roomId/messages', chatRoutes);
  app.use('/api/execute',               executionRoutes);

  // ── Health check ───────────────────────────────────────────────────────────
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // ── 404 handler ────────────────────────────────────────────────────────────
  app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
  });

  // ── Global error handler (must be last) ───────────────────────────────────
  app.use(errorHandler);

  // 3. Create HTTP server
  const httpServer = http.createServer(app);

  // 4. Attach Socket.IO to the same HTTP server
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  initSocketServer(io);

  // 5. Start listening
  const PORT = parseInt(process.env.PORT || '4000', 10);

  httpServer.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`📡 Socket.IO ready at ws://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });

  // 6. Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down gracefully…`);
    httpServer.close(() => {
      console.log('HTTP server closed.');
      process.exit(0);
    });

    // Force exit after 10s if connections don't drain
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  // Catch unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Promise Rejection:', reason);
  });
}

bootstrap().catch((err) => {
  console.error('💥 Fatal startup error:', err);
  process.exit(1);
});
