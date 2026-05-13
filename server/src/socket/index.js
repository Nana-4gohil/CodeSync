// src/socket/index.js
const { verifyAccessToken, extractBearerToken } = require('../config/jwt');
const { registerRoomEvents } = require('./events/room');
const { registerEditorEvents } = require('./events/editor');
const { registerChatEvents } = require('./events/chat');
const { registerExecutionEvents } = require('./events/execution');
const { registerFilesystemEvents } = require('./events/filesystem');
const { registerPresenceEvents } = require('./events/presence');

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
    const { username, userId } = socket.user;
    console.log(`\n🔌 [CONNECT]  ${username} (${socket.id})`);
    console.log(`   userId  : ${userId}`);
    console.log(`   transport: ${socket.conn.transport.name}`);

    // ── Universal event logger ──────────────────────────────────────────────
    socket.onAny((event, ...args) => {
      const payload = args[0] ?? {};
      // Build a compact one-line summary of the payload (no huge content blobs)
      const summary = Object.entries(payload)
        .map(([k, v]) => {
          if (k === 'content') return `content: <${typeof v === 'string' ? v.length : '?'}chars>`;
          return `${k}: ${JSON.stringify(v)}`;
        })
        .join(', ');
      console.log(`📡 [EVENT]    ${username} » ${event} { ${summary} }`);
    });

    // Register domain event handlers
    registerRoomEvents(io, socket, presenceStore);
    registerEditorEvents(io, socket);
    registerChatEvents(io, socket);
    registerExecutionEvents(io, socket);
    registerFilesystemEvents(io, socket);
    registerPresenceEvents(io, socket);

    // ── Disconnect — clean up presence with a grace period ──────────────────
    // We wait 4 s before broadcasting "offline" so that a page refresh
    // (which briefly disconnects then reconnects) doesn't evict the user
    // from the room for every other member.
    socket.on('disconnect', (reason) => {
      console.log(`\n🔌 [DISCONNECT] ${username} (${socket.id}) — ${reason}`);

      presenceStore.forEach((userMap, roomId) => {
        if (!userMap.has(socket.user.userId)) return;

        // Schedule the offline broadcast after a grace period
        const timer = setTimeout(() => {
          // Only broadcast if the user hasn't reconnected in the meantime
          // (on reconnect they emit room:join which updates presenceStore)
          const currentSocketId = userMap.get(socket.user.userId);
          if (currentSocketId === socket.id) {
            userMap.delete(socket.user.userId);
            io.to(roomId).emit('room:presence', {
              userId: socket.user.userId,
              status: 'offline',
            });
            if (userMap.size === 0) presenceStore.delete(roomId);
          }
        }, 4000);

        // Store the timer so room:join on reconnect can cancel it
        if (!socket.user._offlineTimers) socket.user._offlineTimers = {};
        socket.user._offlineTimers[roomId] = timer;
      });
    });
  });

  console.log('✅ Socket.IO server initialized');
}

module.exports = { initSocketServer };
