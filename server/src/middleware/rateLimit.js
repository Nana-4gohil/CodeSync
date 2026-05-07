// src/middleware/rateLimit.js
const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter — 100 requests per 15 minutes per IP.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

/**
 * Strict limiter for auth endpoints — 10 requests per 15 minutes per IP.
 * Counts only failed requests (skipSuccessfulRequests: true).
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many auth attempts. Try again in 15 minutes.' },
});

/**
 * Limiter for code execution — 20 executions per minute per IP.
 */
const executionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many execution requests. Slow down.' },
});

module.exports = { apiLimiter, authLimiter, executionLimiter };
