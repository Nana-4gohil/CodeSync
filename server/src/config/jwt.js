// src/config/jwt.js
const jwt = require('jsonwebtoken');

/**
 * Sign a short-lived access token (default 15m).
 * Payload: { userId, email, username }
 */
function signAccessToken(payload) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
}

/**
 * Sign a long-lived refresh token (default 7d).
 * Payload: { userId, tokenId }
 */
function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

/**
 * Extract the raw token from "Bearer <token>" header.
 * Returns null if missing or malformed.
 */
function extractBearerToken(header) {
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7);
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractBearerToken,
};
