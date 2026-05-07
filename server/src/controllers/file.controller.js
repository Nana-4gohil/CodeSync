// src/controllers/file.controller.js
const Room = require('../models/Room');
const File = require('../models/File');
const { AppError } = require('../middleware/error');

// ─── Helper — verify user is a member of the room ─────────────────────────────
async function assertMembership(roomId, userId) {
  const room = await Room.findOne({ _id: roomId, 'members.user': userId });
  if (!room) throw new AppError('Access denied to this room.', 403);
  return room;
}

// GET /api/rooms/:roomId/files
async function getFiles(req, res, next) {
  try {
    await assertMembership(req.params.roomId, req.user.userId);

    const files = await File.find({ room: req.params.roomId })
      .select('-__v')
      .sort({ path: 1 });

    res.json({ success: true, data: files });
  } catch (err) {
    next(err);
  }
}

// POST /api/rooms/:roomId/files
async function createFile(req, res, next) {
  try {
    await assertMembership(req.params.roomId, req.user.userId);

    const { name, path, content = '', language } = req.body;

    // Normalize path
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    const file = await File.create({
      room: req.params.roomId,
      name: name.trim(),
      path: normalizedPath,
      content,
      language: language || undefined, // auto-detected by pre-save hook if not provided
      createdBy: req.user.userId,
    });

    res.status(201).json({ success: true, data: file });
  } catch (err) {
    next(err);
  }
}

// GET /api/rooms/:roomId/files/:fileId
async function getFile(req, res, next) {
  try {
    await assertMembership(req.params.roomId, req.user.userId);

    const file = await File.findOne({ _id: req.params.fileId, room: req.params.roomId });
    if (!file) throw new AppError('File not found.', 404);

    res.json({ success: true, data: file });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/rooms/:roomId/files/:fileId/content — update file content (auto-save)
async function updateContent(req, res, next) {
  try {
    await assertMembership(req.params.roomId, req.user.userId);

    const { content } = req.body;
    if (content === undefined) throw new AppError('Content is required.', 400);

    const file = await File.findOneAndUpdate(
      { _id: req.params.fileId, room: req.params.roomId },
      { content },
      { new: true, runValidators: true }
    );

    if (!file) throw new AppError('File not found.', 404);

    res.json({ success: true, data: file });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/rooms/:roomId/files/:fileId/rename
async function renameFile(req, res, next) {
  try {
    await assertMembership(req.params.roomId, req.user.userId);

    const { name, path } = req.body;
    if (!name || !path) throw new AppError('Name and path are required.', 400);

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    const file = await File.findOneAndUpdate(
      { _id: req.params.fileId, room: req.params.roomId },
      { name: name.trim(), path: normalizedPath },
      { new: true, runValidators: true }
    );

    if (!file) throw new AppError('File not found.', 404);

    res.json({ success: true, data: file });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/rooms/:roomId/files/:fileId
async function deleteFile(req, res, next) {
  try {
    await assertMembership(req.params.roomId, req.user.userId);

    const file = await File.findOneAndDelete({
      _id: req.params.fileId,
      room: req.params.roomId,
    });

    if (!file) throw new AppError('File not found.', 404);

    res.json({ success: true, message: 'File deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { getFiles, createFile, getFile, updateContent, renameFile, deleteFile };
