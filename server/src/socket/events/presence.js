// src/socket/events/presence.js
// Broadcasts idle/active status changes so all clients can dim avatar rings.

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerPresenceEvents(io, socket) {
  // ── presence:idle ──────────────────────────────────────────────────────────
  socket.on('presence:idle', ({ roomId }) => {
    if (!roomId) return;
    socket.to(roomId).emit('presence:remote-idle', { userId: socket.user.userId });
  });

  // ── presence:active ────────────────────────────────────────────────────────
  socket.on('presence:active', ({ roomId }) => {
    if (!roomId) return;
    socket.to(roomId).emit('presence:remote-active', { userId: socket.user.userId });
  });
}

module.exports = { registerPresenceEvents };
