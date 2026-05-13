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

    // Create a language-appropriate starter file for the room
    const STARTERS = {
      javascript: { name: 'index.js',    content: '// Welcome to CodeSync!\nconsole.log("Hello, World!");\n' },
      typescript: { name: 'index.ts',    content: '// Welcome to CodeSync!\nconst greeting: string = "Hello, World!";\nconsole.log(greeting);\n' },
      python:     { name: 'main.py',     content: '# Welcome to CodeSync!\nprint("Hello, World!")\n' },
      java:       { name: 'Main.java',   content: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n' },
      cpp:        { name: 'main.cpp',    content: '#include <iostream>\n\nint main() {\n    std::cout << "Hello, World!" << std::endl;\n    return 0;\n}\n' },
      c:          { name: 'main.c',      content: '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n' },
      go:         { name: 'main.go',     content: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello, World!")\n}\n' },
      rust:       { name: 'main.rs',     content: 'fn main() {\n    println!("Hello, World!");\n}\n' },
      csharp:     { name: 'Program.cs',  content: 'using System;\n\nclass Program {\n    static void Main() {\n        Console.WriteLine("Hello, World!");\n    }\n}\n' },
      php:        { name: 'index.php',   content: '<?php\necho "Hello, World!";\n' },
      ruby:       { name: 'main.rb',     content: '# Welcome to CodeSync!\nputs "Hello, World!"\n' },
      swift:      { name: 'main.swift',  content: 'import Foundation\n\nprint("Hello, World!")\n' },
      kotlin:     { name: 'Main.kt',     content: 'fun main() {\n    println("Hello, World!")\n}\n' },
      html:       { name: 'index.html',  content: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8" />\n  <title>CodeSync</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n</body>\n</html>\n' },
      css:        { name: 'style.css',   content: '/* Welcome to CodeSync! */\nbody {\n  font-family: sans-serif;\n  margin: 0;\n  padding: 1rem;\n}\n' },
      sql:        { name: 'query.sql',   content: '-- Welcome to CodeSync!\nSELECT \'Hello, World!\' AS greeting;\n' },
      shell:      { name: 'script.sh',   content: '#!/bin/bash\n# Welcome to CodeSync!\necho "Hello, World!"\n' },
      markdown:   { name: 'README.md',   content: '# Hello, World!\n\nWelcome to **CodeSync** — your collaborative code editor.\n' },
    };
    const starter = STARTERS[language] ?? STARTERS.javascript;
    await File.create({
      room: room._id,
      name: starter.name,
      path: `/${starter.name}`,
      content: starter.content,
      language,
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
