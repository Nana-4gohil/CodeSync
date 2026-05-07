// src/routes/file.routes.js
const express = require('express');
// mergeParams: true allows access to :roomId from the parent router
const router = express.Router({ mergeParams: true });

const {
  getFiles, createFile, getFile,
  updateContent, renameFile, deleteFile,
} = require('../controllers/file.controller');
const { authenticate } = require('../middleware/auth');
const { validate, validateCreateFile } = require('../middleware/validate');

// All file routes require authentication
router.use(authenticate);

// GET    /api/rooms/:roomId/files
router.get('/', getFiles);

// POST   /api/rooms/:roomId/files
router.post('/', validate(validateCreateFile), createFile);

// GET    /api/rooms/:roomId/files/:fileId
router.get('/:fileId', getFile);

// PATCH  /api/rooms/:roomId/files/:fileId/content
router.patch('/:fileId/content', updateContent);

// PATCH  /api/rooms/:roomId/files/:fileId/rename
router.patch('/:fileId/rename', renameFile);

// DELETE /api/rooms/:roomId/files/:fileId
router.delete('/:fileId', deleteFile);

module.exports = router;
