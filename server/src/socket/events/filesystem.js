// src/socket/events/filesystem.js
// Broadcasts file-system mutations (create / rename / delete) to all room members
// so everyone's explorer stays in sync without a page refresh.

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerFilesystemEvents(io, socket) {
  // ── fs:file-created ────────────────────────────────────────────────────────
  // Payload: { roomId, file }  (file = the full serialised File document)
  socket.on('fs:file-created', ({ roomId, file }) => {
    if (!roomId || !file) return;
    socket.to(roomId).emit('fs:remote-file-created', { file, createdBy: socket.user.username });
  });

  // ── fs:file-renamed ────────────────────────────────────────────────────────
  // Payload: { roomId, fileId, name, path }
  socket.on('fs:file-renamed', ({ roomId, fileId, name, path }) => {
    if (!roomId || !fileId) return;
    socket.to(roomId).emit('fs:remote-file-renamed', { fileId, name, path, renamedBy: socket.user.username });
  });

  // ── fs:file-deleted ────────────────────────────────────────────────────────
  // Payload: { roomId, fileId }
  socket.on('fs:file-deleted', ({ roomId, fileId }) => {
    if (!roomId || !fileId) return;
    socket.to(roomId).emit('fs:remote-file-deleted', { fileId, deletedBy: socket.user.username });
  });
}

module.exports = { registerFilesystemEvents };
