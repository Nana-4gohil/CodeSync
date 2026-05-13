// src/socket/events/editor.js
const File = require('../../models/File');
const { transformOpsAgainstHistory, applyOpToString, getFileState } = require('../../ot');

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
  // Payload: { roomId, fileId, revision, operations: OTOp[] }
  //   revision = client's last known server revision (base for these ops)
  //   operations = array of { type:'insert'|'delete', pos, text?, len? }
  socket.on('editor:change', async ({ roomId, fileId, revision, operations }) => {
    if (!roomId || !fileId || !Array.isArray(operations) || operations.length === 0) return;

    // Load canonical document.  For first edit, seed from DB.
    let state = getFileState(fileId);
    if (state.revision === 0 && state.content === '') {
      try {
        const file = await File.findById(fileId).select('content').lean();
        if (file) state.content = file.content ?? '';
      } catch { /* ignore — proceed with empty */ }
    }

    // ── OT: transform incoming ops against history since client's revision ──
    const transformedOps = transformOpsAgainstHistory(operations, state.history, revision);

    // Apply transformed ops to canonical content
    for (const op of transformedOps) {
      state.content = applyOpToString(state.content, op);
    }

    // Record this batch in history and advance revision
    state.history.push(transformedOps);
    state.revision += 1;
    const newRevision = state.revision;

    // ── ACK the sender with the new server revision ────────────────────────
    socket.emit('editor:ack', { fileId, revision: newRevision });

    // ── Broadcast transformed ops to everyone else in the room ────────────
    if (transformedOps.length > 0) {
      socket.to(roomId).emit('editor:remote-change', {
        roomId,
        fileId,
        operations: transformedOps,
        revision: newRevision,
        userId: socket.user.userId,
        username: socket.user.username,
      });
    }

    // ── Persist to MongoDB (fire-and-forget) ──────────────────────────────
    File.findByIdAndUpdate(fileId, { content: state.content }).catch((err) => {
      console.warn(`[OT] Failed to persist file ${fileId}:`, err.message);
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
