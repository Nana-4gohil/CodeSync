// src/models/Room.js
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const memberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'editor', 'viewer'],
      default: 'editor',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const roomSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      minlength: [2, 'Room name must be at least 2 characters'],
      maxlength: [100, 'Room name must be at most 100 characters'],
    },
    description: {
      type: String,
      maxlength: [500, 'Description too long'],
      default: '',
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    language: {
      type: String,
      default: 'javascript',
    },
    isPublic: {
      type: Boolean,
      default: true,
    },
    // 12-character alphanumeric invite code — unique
    inviteCode: {
      type: String,
      unique: true,
      default: () => generateInviteCode(),
    },
    members: [memberSchema],
  },
  {
    timestamps: true,
  }
);

// Index for fast member lookups (inviteCode already indexed via unique:true)
roomSchema.index({ 'members.user': 1 });

// Helper: generate a 12-char alphanumeric code
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

module.exports = mongoose.model('Room', roomSchema);
