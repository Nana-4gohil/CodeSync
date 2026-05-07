// src/socket/index.js
const { verifyAccessToken, extractBearerToken } = require('../config/jwt');
const { registerRoomEvents } = require('./events/room');
const { registerEditorEvents } = require('./events/editor');
const { registerChatEvents } = require('./events/chat');

/**
 * In-memory presence store.
 * Structure: Map<roomId, Map<userId, socketId>>
 *
 * In production with multiple server instances, replace with Redis.
 */
const presenceStore = new Map();

/**
 * Initialize the Socket.IO server with JWT middleware and event routing.
 * @param {import('socket.io').Server} io
 */
function initSocketServer(io) {
  // ── JWT authentication middleware ──────────────────────────────────────────
  io.use((socket, next) => {
    // Token can come from auth.token or Authorization header
    const raw =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization;

    const token = extractBearerToken(raw);

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const user = verifyAccessToken(token);
      socket.user = user; // { userId, email, username }
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  // ── Connection handler ─────────────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.user.username} (${socket.id})`);

    // Register domain event handlers
    registerRoomEvents(io, socket, presenceStore);
    registerEditorEvents(io, socket);
    registerChatEvents(io, socket);

    // ── Disconnect — clean up presence across all rooms ─────────────────────
    socket.on('disconnect', (reason) => {
      console.log(`🔌 Disconnected: ${socket.user.username} — ${reason}`);

      presenceStore.forEach((userMap, roomId) => {
        if (userMap.has(socket.user.userId)) {
          userMap.delete(socket.user.userId);

          // Notify remaining room members
          io.to(roomId).emit('room:presence', {
            userId: socket.user.userId,
            status: 'offline',
          });

          if (userMap.size === 0) presenceStore.delete(roomId);
        }
      });
    });
  });

  console.log('✅ Socket.IO server initialized');
}

module.exports = { initSocketServer };
