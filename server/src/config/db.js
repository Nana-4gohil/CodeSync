// src/config/db.js
const mongoose = require('mongoose');

/**
 * Global Mongoose plugin — applied to EVERY schema.
 *
 * When Express calls res.json(doc), it calls doc.toJSON().
 * This plugin makes all documents return:
 *   • id  (string)  instead of  _id  (ObjectId)
 *   • no __v field
 *
 * Must be registered BEFORE any model is require()'d.
 */
mongoose.plugin((schema) => {
  schema.set('toJSON', {
    virtuals: true,
    versionKey: false,          // removes __v
    transform(_doc, ret) {
      ret.id = ret._id?.toString(); // add id string
      delete ret._id;               // remove ObjectId
    },
  });
});

/**
 * Connect to MongoDB using Mongoose.
 * Retries automatically via Mongoose's built-in reconnection.
 */
async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in environment variables');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      // Mongoose 7+ defaults — listed for clarity
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log(`✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }

  // Log connection events
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
  });
}

module.exports = { connectDB };
