// src/routes/chat.routes.js
const express = require('express');
const router = express.Router({ mergeParams: true });

const { getMessages } = require('../controllers/chat.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/rooms/:roomId/messages?limit=50&before=<ISO>
router.get('/', getMessages);

module.exports = router;
