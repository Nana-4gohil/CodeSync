// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();

const { signup, login, refresh, logout, logoutAll, getMe } = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { validate, validateSignup, validateLogin } = require('../middleware/validate');

// POST /api/auth/signup
router.post('/signup', authLimiter, validate(validateSignup), signup);

// POST /api/auth/login
router.post('/login', authLimiter, validate(validateLogin), login);

// POST /api/auth/refresh
router.post('/refresh', refresh);

// POST /api/auth/logout
router.post('/logout', logout);

// POST /api/auth/logout-all  (protected)
router.post('/logout-all', authenticate, logoutAll);

// GET /api/auth/me  (protected)
router.get('/me', authenticate, getMe);

module.exports = router;
