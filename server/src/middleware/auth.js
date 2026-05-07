// src/middleware/auth.js
const { verifyAccessToken, extractBearerToken } = require('../config/jwt');

/**
 * Protects routes by verifying the JWT access token.
 * On success, attaches `req.user = { userId, email, username }`.
 */
function authenticate(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please provide a Bearer token.',
    });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = payload; // { userId, email, username, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired access token.',
    });
  }
}

module.exports = { authenticate };
