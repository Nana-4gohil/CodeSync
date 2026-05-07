// src/socket/events/editor.js
const File = require('../../models/File');

// In-memory version map for optimistic conflict resolution
// Key: `${roomId}:${fileId}`, Value: version number
const versionMap = new Map();

// Colour palette for remote cursors — assigned per userId
const CURSOR_COLORS = [
  '#f59e0b', '#10b981', '#3b82f6', '#ec4899',
  '#8b5cf6', '#ef4444', '#14b8a6', '#f97316',
];
const userColorMap = new Map();

function getUserColor(userId) {
  if (!userColorMap.has(userId)) {
    userColorMap.set(userId, CURSOR_COLORS[userColorMap.size % CURSOR_COLORS.length]);
  }
  return userColorMap.get(userId);
}

/**
 * Register editor-related socket events.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerEditorEvents(io, socket) {
  // ── editor:change ──────────────────────────────────────────────────────────
  socket.on('editor:change', async ({ roomId, fileId, content, version }) => {
    if (!roomId || !fileId || content === undefined) return;

    const key = `${roomId}:${fileId}`;
    const currentVersion = versionMap.get(key) ?? 0;

    // Last-write-wins: silently drop stale updates
    if (version < currentVersion) return;

    versionMap.set(key, version);

    // Broadcast the change to everyone else in the room
    socket.to(roomId).emit('editor:remote-change', {
      roomId,
      fileId,
      content,
      version,
      userId: socket.user.userId,
      username: socket.user.username,
    });

    // Persist to MongoDB (fire-and-forget — don't await in the hot path)
    File.findByIdAndUpdate(fileId, { content }).catch((err) => {
      console.warn(`Failed to persist file ${fileId}:`, err.message);
    });
  });

  // ── editor:cursor ──────────────────────────────────────────────────────────
  socket.on('editor:cursor', ({ roomId, fileId, position }) => {
    if (!roomId || !fileId || !position) return;

    socket.to(roomId).emit('editor:remote-cursor', {
      roomId,
      fileId,
      position,
      userId: socket.user.userId,
      username: socket.user.username,
      color: getUserColor(socket.user.userId),
    });
  });

  // ── editor:selection ───────────────────────────────────────────────────────
  socket.on('editor:selection', ({ roomId, fileId, selection }) => {
    if (!roomId || !fileId || !selection) return;

    socket.to(roomId).emit('editor:remote-selection', {
      roomId,
      fileId,
      selection,
      userId: socket.user.userId,
      username: socket.user.username,
      color: getUserColor(socket.user.userId),
    });
  });

  // ── editor:typing ──────────────────────────────────────────────────────────
  socket.on('editor:typing', ({ roomId, fileId }) => {
    if (!roomId) return;
    socket.to(roomId).emit('editor:remote-typing', {
      userId: socket.user.userId,
      username: socket.user.username,
      fileId,
    });
  });
}

module.exports = { registerEditorEvents };
