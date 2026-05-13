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
    // Broadcast to ALL in room (including sender) so every client's
    // userActivity map stays consistent even after reconnects.
    io.to(roomId).emit('presence:remote-idle', {
      userId:   socket.user.userId,
      username: socket.user.username,
    });
  });

  // ── presence:active ────────────────────────────────────────────────────────
  socket.on('presence:active', ({ roomId }) => {
    if (!roomId) return;
    io.to(roomId).emit('presence:remote-active', {
      userId:   socket.user.userId,
      username: socket.user.username,
    });
  });
}

module.exports = { registerPresenceEvents };
