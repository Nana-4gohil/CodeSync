// src/middleware/validate.js

/**
 * Simple validation middleware factory.
 * Pass a validation function that receives req.body and returns
 * an array of error strings. If the array is non-empty, responds 422.
 *
 * Usage:
 *   router.post('/signup', validate(validateSignup), controller)
 *
 *   function validateSignup(body) {
 *     const errors = [];
 *     if (!body.email) errors.push('Email is required');
 *     return errors;
 *   }
 */
function validate(validatorFn) {
  return (req, res, next) => {
    const errors = validatorFn(req.body);
    if (errors && errors.length > 0) {
      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }
    next();
  };
}

// ─── Built-in validators ──────────────────────────────────────────────────────

function validateSignup(body) {
  const errors = [];
  if (!body.email || !/^\S+@\S+\.\S+$/.test(body.email)) errors.push('Valid email is required');
  if (!body.username || body.username.length < 3) errors.push('Username must be at least 3 characters');
  if (!/^[a-zA-Z0-9_-]+$/.test(body.username || '')) errors.push('Username may only contain letters, numbers, _ and -');
  if (!body.password || body.password.length < 8) errors.push('Password must be at least 8 characters');
  return errors;
}

function validateLogin(body) {
  const errors = [];
  if (!body.email) errors.push('Email is required');
  if (!body.password) errors.push('Password is required');
  return errors;
}

function validateCreateRoom(body) {
  const errors = [];
  if (!body.name || body.name.trim().length < 2) errors.push('Room name must be at least 2 characters');
  if (body.name && body.name.length > 100) errors.push('Room name must be at most 100 characters');
  return errors;
}

function validateCreateFile(body) {
  const errors = [];
  if (!body.name || !body.name.trim()) errors.push('File name is required');
  if (!body.path || !body.path.trim()) errors.push('File path is required');
  return errors;
}

function validateChatMessage(body) {
  const errors = [];
  if (!body.content || !body.content.trim()) errors.push('Message content is required');
  if (body.content && body.content.length > 2000) errors.push('Message too long (max 2000 chars)');
  return errors;
}

module.exports = {
  validate,
  validateSignup,
  validateLogin,
  validateCreateRoom,
  validateCreateFile,
  validateChatMessage,
};
