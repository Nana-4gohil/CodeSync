// src/socket/events/room.js
const Room = require('../../models/Room');

/**
 * Register room-related socket events.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 * @param {Map<string, Map<string, string>>} presenceStore
 */
function registerRoomEvents(io, socket, presenceStore) {
  // ── room:join ──────────────────────────────────────────────────────────────
  socket.on('room:join', async ({ roomId }) => {
    if (!roomId) return;

    try {
      // Verify the user is actually a member of the room
      const room = await Room.findOne({
        _id: roomId,
        'members.user': socket.user.userId,
      }).populate('members.user', 'username avatarColor');

      if (!room) {
        return socket.emit('error', { message: 'You are not a member of this room.' });
      }

      socket.join(roomId);

      // Track presence
      if (!presenceStore.has(roomId)) presenceStore.set(roomId, new Map());
      presenceStore.get(roomId).set(socket.user.userId, socket.id);

      // Build the member list for the client
      const members = room.members.map((m) => ({
        userId: m.user._id,
        username: m.user.username,
        avatarColor: m.user.avatarColor,
        role: m.role,
      }));

      // Send current member list to the joining socket
      socket.emit('room:members', { members });

      // Notify others in the room that this user joined
      const joiningMember = members.find((m) => m.userId.toString() === socket.user.userId);
      socket.to(roomId).emit('room:user-joined', { user: joiningMember, members });

      // Broadcast online presence
      io.to(roomId).emit('room:presence', { userId: socket.user.userId, status: 'online' });

      console.log(`👥 ${socket.user.username} joined room ${roomId}`);
    } catch (err) {
      console.error('room:join error', err.message);
      socket.emit('error', { message: 'Failed to join room.' });
    }
  });

  // ── room:leave ─────────────────────────────────────────────────────────────
  socket.on('room:leave', ({ roomId }) => {
    if (!roomId) return;
    socket.leave(roomId);

    const roomPresence = presenceStore.get(roomId);
    if (roomPresence) {
      roomPresence.delete(socket.user.userId);
      if (roomPresence.size === 0) presenceStore.delete(roomId);
    }

    io.to(roomId).emit('room:presence', { userId: socket.user.userId, status: 'offline' });
    console.log(`👋 ${socket.user.username} left room ${roomId}`);
  });
}

module.exports = { registerRoomEvents };
