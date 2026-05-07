// src/routes/room.routes.js
const express = require('express');
const router = express.Router();

const {
  getRooms, createRoom, joinRoom,
  getRoom, updateRoom, deleteRoom,
  getMembers, regenerateInvite,
} = require('../controllers/room.controller');
const { authenticate } = require('../middleware/auth');
const { validate, validateCreateRoom } = require('../middleware/validate');

// All room routes require authentication
router.use(authenticate);

// GET    /api/rooms           — list user's rooms
router.get('/', getRooms);

// POST   /api/rooms           — create a new room
router.post('/', validate(validateCreateRoom), createRoom);

// POST   /api/rooms/join      — join via invite code
router.post('/join', joinRoom);

// GET    /api/rooms/:id       — get a single room
router.get('/:id', getRoom);

// PATCH  /api/rooms/:id       — update room settings (owner only)
router.patch('/:id', updateRoom);

// DELETE /api/rooms/:id       — delete room (owner only)
router.delete('/:id', deleteRoom);

// GET    /api/rooms/:id/members
router.get('/:id/members', getMembers);

// POST   /api/rooms/:id/regenerate-invite
router.post('/:id/regenerate-invite', regenerateInvite);

module.exports = router;
