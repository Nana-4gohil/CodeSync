// src/controllers/chat.controller.js
const Room = require('../models/Room');
const ChatMessage = require('../models/ChatMessage');
const { AppError } = require('../middleware/error');

// GET /api/rooms/:roomId/messages?limit=50&before=<ISO timestamp>
async function getMessages(req, res, next) {
  try {
    // Verify membership
    const room = await Room.findOne({
      _id: req.params.roomId,
      'members.user': req.user.userId,
    });
    if (!room) throw new AppError('Access denied to this room.', 403);

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const filter = { room: req.params.roomId };

    // Cursor-based pagination: fetch messages before a given timestamp
    if (req.query.before) {
      filter.createdAt = { $lt: new Date(req.query.before) };
    }

    const messages = await ChatMessage.find(filter)
      .populate('user', 'username avatarColor')
      .sort({ createdAt: -1 }) // newest first for cursor pagination
      .limit(limit)
      .lean();

    // Return in ascending (chronological) order for the client
    const formatted = messages.reverse().map((m) => ({
      id: m._id,
      roomId: m.room,
      userId: m.user._id,
      username: m.user.username,
      avatarColor: m.user.avatarColor,
      content: m.content,
      createdAt: m.createdAt,
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMessages };
