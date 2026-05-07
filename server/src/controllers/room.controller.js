// src/controllers/room.controller.js
const Room = require('../models/Room');
const File = require('../models/File');
const { AppError } = require('../middleware/error');

// ─── Helper — generate a unique invite code ────────────────────────────────────
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ─── Helper — check membership and return room ─────────────────────────────────
async function getRoomForUser(roomId, userId) {
  const room = await Room.findOne({
    _id: roomId,
    'members.user': userId,
  }).populate('owner', 'username avatarColor email');
  if (!room) throw new AppError('Room not found or access denied.', 404);
  return room;
}

// GET /api/rooms — list rooms the user belongs to
async function getRooms(req, res, next) {
  try {
    const rooms = await Room.find({ 'members.user': req.user.userId })
      .populate('owner', 'username avatarColor')
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: rooms });
  } catch (err) {
    next(err);
  }
}

// POST /api/rooms — create a new room
async function createRoom(req, res, next) {
  try {
    const { name, description, language = 'javascript', isPublic = true } = req.body;

    const room = await Room.create({
      name: name.trim(),
      description: description?.trim() || '',
      owner: req.user.userId,
      language,
      isPublic,
      members: [{ user: req.user.userId, role: 'owner' }],
    });

    // Create a default starter file for the room
    await File.create({
      room: room._id,
      name: 'index.js',
      path: '/index.js',
      content: '// Welcome to CodeSync!\nconsole.log("Hello, World!");\n',
      language: 'javascript',
      createdBy: req.user.userId,
    });

    await room.populate('owner', 'username avatarColor email');
    res.status(201).json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
}

// POST /api/rooms/join — join by invite code
async function joinRoom(req, res, next) {
  try {
    const { inviteCode } = req.body;
    if (!inviteCode) throw new AppError('Invite code is required.', 400);

    const room = await Room.findOne({ inviteCode: inviteCode.trim() });
    if (!room) throw new AppError('Invalid invite code.', 404);

    // Already a member?
    const isMember = room.members.some((m) => m.user.toString() === req.user.userId);

    if (!isMember) {
      room.members.push({ user: req.user.userId, role: 'editor' });
      await room.save();
    }

    await room.populate('owner', 'username avatarColor email');
    res.json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
}

// GET /api/rooms/:id
async function getRoom(req, res, next) {
  try {
    const room = await getRoomForUser(req.params.id, req.user.userId);
    res.json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/rooms/:id
async function updateRoom(req, res, next) {
  try {
    const room = await getRoomForUser(req.params.id, req.user.userId);

    // Only owner can update
    const memberEntry = room.members.find((m) => m.user.toString() === req.user.userId);
    if (!memberEntry || memberEntry.role !== 'owner') {
      throw new AppError('Only the room owner can update settings.', 403);
    }

    const { name, description, language, isPublic } = req.body;
    if (name !== undefined) room.name = name.trim();
    if (description !== undefined) room.description = description.trim();
    if (language !== undefined) room.language = language;
    if (isPublic !== undefined) room.isPublic = isPublic;

    await room.save();
    res.json({ success: true, data: room });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/rooms/:id
async function deleteRoom(req, res, next) {
  try {
    const room = await getRoomForUser(req.params.id, req.user.userId);
    const memberEntry = room.members.find((m) => m.user.toString() === req.user.userId);

    if (!memberEntry || memberEntry.role !== 'owner') {
      throw new AppError('Only the room owner can delete the room.', 403);
    }

    // Cascade delete files and messages
    await File.deleteMany({ room: room._id });
    await room.deleteOne();

    res.json({ success: true, message: 'Room deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/rooms/:id/members
async function getMembers(req, res, next) {
  try {
    const room = await Room.findOne({
      _id: req.params.id,
      'members.user': req.user.userId,
    }).populate('members.user', 'username avatarColor email');

    if (!room) throw new AppError('Room not found or access denied.', 404);

    const members = room.members.map((m) => ({
      userId: m.user._id,
      username: m.user.username,
      avatarColor: m.user.avatarColor,
      role: m.role,
      joinedAt: m.joinedAt,
    }));

    res.json({ success: true, data: members });
  } catch (err) {
    next(err);
  }
}

// POST /api/rooms/:id/regenerate-invite
async function regenerateInvite(req, res, next) {
  try {
    const room = await getRoomForUser(req.params.id, req.user.userId);
    const memberEntry = room.members.find((m) => m.user.toString() === req.user.userId);

    if (!memberEntry || memberEntry.role !== 'owner') {
      throw new AppError('Only the room owner can regenerate the invite code.', 403);
    }

    room.inviteCode = generateInviteCode();
    await room.save();

    res.json({ success: true, data: { inviteCode: room.inviteCode } });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getRooms,
  createRoom,
  joinRoom,
  getRoom,
  updateRoom,
  deleteRoom,
  getMembers,
  regenerateInvite,
};
