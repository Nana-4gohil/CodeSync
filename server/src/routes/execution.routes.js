// src/routes/execution.routes.js
const express = require('express');
const router = express.Router();

const { executeCode } = require('../controllers/execution.controller');
const { authenticate } = require('../middleware/auth');
const { executionLimiter } = require('../middleware/rateLimit');

// POST /api/execute
router.post('/', authenticate, executionLimiter, executeCode);

module.exports = router;
