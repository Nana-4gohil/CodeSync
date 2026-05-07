// src/controllers/auth.controller.js
const { v4: uuidv4 } = require('uuid');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../config/jwt');
const { AppError } = require('../middleware/error');

// ─── Helper — issue a new access + refresh token pair ─────────────────────────
async function issueTokenPair(user, familyId) {
  const payload = {
    userId: user._id.toString(),
    email: user.email,
    username: user.username,
  };

  const accessToken = signAccessToken(payload);
  const rawRefreshToken = signRefreshToken({ userId: user._id.toString(), tokenId: uuidv4() });
  const tokenHash = RefreshToken.hashToken(rawRefreshToken);
  const tokenFamilyId = familyId || uuidv4();

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    familyId: tokenFamilyId,
    expiresAt,
  });

  return { accessToken, refreshToken: rawRefreshToken };
}

// POST /api/auth/signup
async function signup(req, res, next) {
  try {
    const { email, username, password } = req.body;

    // Check uniqueness
    const existing = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username }],
    });
    if (existing) {
      throw new AppError('Email or username is already in use.', 409);
    }

    // Create user — passwordHash pre-save hook will bcrypt it
    const user = await User.create({
      email: email.toLowerCase(),
      username,
      passwordHash: password, // will be hashed by pre-save hook
    });

    const tokens = await issueTokenPair(user);

    res.status(201).json({
      success: true,
      data: { user, ...tokens },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // select: false on passwordHash — must explicitly request it
    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
    if (!user) throw new AppError('Invalid credentials.', 401);

    const isMatch = await user.comparePassword(password);
    if (!isMatch) throw new AppError('Invalid credentials.', 401);

    const tokens = await issueTokenPair(user);

    // Remove passwordHash from response (toJSON does it, but just in case)
    const userObj = user.toJSON();

    res.json({
      success: true,
      data: { user: userObj, ...tokens },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/refresh
async function refresh(req, res, next) {
  try {
    const { refreshToken: rawToken } = req.body;
    if (!rawToken) throw new AppError('Refresh token is required.', 400);

    // Verify JWT signature first
    let payload;
    try {
      payload = verifyRefreshToken(rawToken);
    } catch {
      throw new AppError('Invalid refresh token.', 401);
    }

    const tokenHash = RefreshToken.hashToken(rawToken);
    const storedToken = await RefreshToken.findOne({ tokenHash });

    if (!storedToken) throw new AppError('Refresh token not found.', 401);

    // Detect token reuse — revoke the entire family
    if (storedToken.revoked) {
      await RefreshToken.updateMany({ familyId: storedToken.familyId }, { revoked: true });
      throw new AppError('Token reuse detected. All sessions have been revoked.', 401);
    }

    // Revoke used token
    storedToken.revoked = true;
    await storedToken.save();

    const user = await User.findById(storedToken.userId);
    if (!user) throw new AppError('User not found.', 404);

    const tokens = await issueTokenPair(user, storedToken.familyId);

    res.json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
async function logout(req, res, next) {
  try {
    const { refreshToken: rawToken } = req.body;
    if (!rawToken) throw new AppError('Refresh token is required.', 400);

    const tokenHash = RefreshToken.hashToken(rawToken);
    await RefreshToken.findOneAndUpdate({ tokenHash }, { revoked: true });

    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout-all  (requires valid access token)
async function logoutAll(req, res, next) {
  try {
    await RefreshToken.updateMany({ userId: req.user.userId, revoked: false }, { revoked: true });
    res.json({ success: true, message: 'All sessions revoked.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/me
async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) throw new AppError('User not found.', 404);
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, refresh, logout, logoutAll, getMe };
