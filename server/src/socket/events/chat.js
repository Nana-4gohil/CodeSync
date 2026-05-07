// src/socket/events/chat.js
const ChatMessage = require('../../models/ChatMessage');
const Room = require('../../models/Room');
const User = require('../../models/User');

// Typing state per room: Map<roomId, Map<userId, username>>
const typingUsers = new Map();

// Auto-clear timers: Map<`${roomId}:${userId}`, NodeJS.Timeout>
const typingTimers = new Map();

const TYPING_TIMEOUT_MS = 3000;

function clearTyping(io, roomId, userId) {
  const timerKey = `${roomId}:${userId}`;
  const existing = typingTimers.get(timerKey);
  if (existing) clearTimeout(existing);
  typingTimers.delete(timerKey);

  const roomTyping = typingUsers.get(roomId);
  if (roomTyping) {
    roomTyping.delete(userId);
    broadcastTyping(io, roomId, roomTyping);
    if (roomTyping.size === 0) typingUsers.delete(roomId);
  }
}

function broadcastTyping(io, roomId, typingMap) {
  io.to(roomId).emit('chat:typing-users', {
    userIds: [...typingMap.keys()],
    usernames: [...typingMap.values()],
  });
}

/**
 * Register chat-related socket events.
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
function registerChatEvents(io, socket) {
  // ── chat:send ──────────────────────────────────────────────────────────────
  socket.on('chat:send', async ({ roomId, content }) => {
    if (!roomId || !content?.trim()) return;

    try {
      // Verify membership
      const isMember = await Room.exists({ _id: roomId, 'members.user': socket.user.userId });
      if (!isMember) return socket.emit('error', { message: 'Not a member of this room.' });

      // Persist message
      const message = await ChatMessage.create({
        room: roomId,
        user: socket.user.userId,
        content: content.trim(),
      });

      // Fetch user info for the response
      const user = await User.findById(socket.user.userId).select('username avatarColor');

      // Broadcast to everyone in the room (including sender)
      io.to(roomId).emit('chat:message', {
        id: message._id,
        roomId,
        userId: socket.user.userId,
        username: user.username,
        avatarColor: user.avatarColor,
        content: message.content,
        createdAt: message.createdAt,
      });

      // Clear typing indicator for this user when they send
      clearTyping(io, roomId, socket.user.userId);
    } catch (err) {
      console.error('chat:send error', err.message);
      socket.emit('error', { message: 'Failed to send message.' });
    }
  });

  // ── chat:typing-start ──────────────────────────────────────────────────────
  socket.on('chat:typing-start', ({ roomId }) => {
    if (!roomId) return;

    if (!typingUsers.has(roomId)) typingUsers.set(roomId, new Map());
    typingUsers.get(roomId).set(socket.user.userId, socket.user.username);
    broadcastTyping(io, roomId, typingUsers.get(roomId));

    // Auto-clear after timeout
    const timerKey = `${roomId}:${socket.user.userId}`;
    const existing = typingTimers.get(timerKey);
    if (existing) clearTimeout(existing);

    typingTimers.set(
      timerKey,
      setTimeout(() => clearTyping(io, roomId, socket.user.userId), TYPING_TIMEOUT_MS)
    );
  });

  // ── chat:typing-stop ───────────────────────────────────────────────────────
  socket.on('chat:typing-stop', ({ roomId }) => {
    if (roomId) clearTyping(io, roomId, socket.user.userId);
  });
}

module.exports = { registerChatEvents };
