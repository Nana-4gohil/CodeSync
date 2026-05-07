// src/models/File.js
const mongoose = require('mongoose');

// Map of file extension → Monaco language identifier
const LANGUAGE_MAP = {
  js: 'javascript', jsx: 'javascript',
  ts: 'typescript', tsx: 'typescript',
  py: 'python', rs: 'rust', go: 'go',
  java: 'java', cpp: 'cpp', c: 'c',
  cs: 'csharp', html: 'html', css: 'css',
  json: 'json', md: 'markdown', yaml: 'yaml',
  yml: 'yaml', sh: 'shell', sql: 'sql', xml: 'xml',
};

function detectLanguage(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return LANGUAGE_MAP[ext] || 'plaintext';
}

const fileSchema = new mongoose.Schema(
  {
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'File name is required'],
      trim: true,
      maxlength: [255, 'File name too long'],
    },
    // Relative path within the room e.g. "/src/index.js"
    path: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      default: 'javascript',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique paths per room
fileSchema.index({ room: 1, path: 1 }, { unique: true });

// Auto-detect language from file name before save
// Mongoose 7+: no next() — just return. Works for both new docs and updates.
fileSchema.pre('save', function () {
  if (this.isNew || this.isModified('name')) {
    this.language = detectLanguage(this.name);
  }
});

module.exports = mongoose.model('File', fileSchema);
