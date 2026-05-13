// src/socket/events/execution.js

/**
 * Register execution-related socket events.
 *
 * When a user runs code, the client posts to the REST API (/execute),
 * gets the result, then emits `execution:result` here.
 * The server broadcasts it to every other user in the room so all
 * terminals show the same output in real time.
 *
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerExecutionEvents(io, socket) {
  // ── execution:result ───────────────────────────────────────────────────────
  // Payload: { roomId, fileId, language, stdout, stderr, executionTime, success }
  socket.on('execution:result', ({ roomId, fileId, language, stdout, stderr, executionTime, success }) => {
    if (!roomId) return;

    // Broadcast to everyone ELSE in the room (sender already has the output)
    socket.to(roomId).emit('execution:remote-result', {
      roomId,
      fileId,
      language,
      stdout,
      stderr,
      executionTime,
      success,
      triggeredBy: socket.user.username,
    });
  });

  // ── execution:running ──────────────────────────────────────────────────────
  // Notify peers that someone started running code (so they can show a spinner)
  socket.on('execution:running', ({ roomId, fileId, language }) => {
    if (!roomId) return;
    socket.to(roomId).emit('execution:remote-running', {
      roomId,
      fileId,
      language,
      triggeredBy: socket.user.username,
    });
  });
}

module.exports = { registerExecutionEvents };
