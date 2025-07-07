const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    minlength: 3,
    maxlength: 20,
    match: /^[a-zA-Z0-9_-]+$/
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true
  },
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  // Email verification fields
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationCode: {
    type: String
  },
  emailVerificationExpires: {
    type: Date
  },
  // Brute force protection fields
  verificationAttempts: {
    type: Number,
    default: 0
  },
  verificationLockoutUntil: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  starredBoards: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Board'
  }]
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  console.log('Comparing passwords:');
  console.log('Candidate password:', candidatePassword);
  console.log('Stored password hash:', this.password);
  const isMatch = await bcrypt.compare(candidatePassword, this.password);
  console.log('Password match result:', isMatch);
  return isMatch;
};

// Method to generate email verification code
userSchema.methods.generateEmailVerificationCode = function() {
  // Generate a 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  this.emailVerificationCode = code;
  this.emailVerificationExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  return code;
};

// Method to verify email code
userSchema.methods.verifyEmailCode = function(code) {
  console.log('=== VERIFY EMAIL CODE DEBUG ===');
  console.log('Input code:', code, 'Type:', typeof code);
  console.log('Stored code:', this.emailVerificationCode, 'Type:', typeof this.emailVerificationCode);
  console.log('Codes match:', this.emailVerificationCode === code);
  console.log('Current time:', Date.now());
  console.log('Expires at:', this.emailVerificationExpires);
  console.log('Is expired:', Date.now() > this.emailVerificationExpires);
  
  if (this.emailVerificationCode !== code) {
    console.log('Code mismatch - verification failed');
    return false;
  }
  
  if (Date.now() > this.emailVerificationExpires) {
    console.log('Code expired - verification failed');
    return false;
  }
  
  console.log('Verification successful - updating user');
  this.isEmailVerified = true;
  this.emailVerificationCode = undefined;
  this.emailVerificationExpires = undefined;
  this.verificationAttempts = 0; // Reset attempts on successful verification
  this.verificationLockoutUntil = undefined; // Clear lockout
  console.log('==================');
  return true;
};

// Method to check if account is locked out
userSchema.methods.isLockedOut = function() {
  if (!this.verificationLockoutUntil) {
    return false;
  }
  return Date.now() < this.verificationLockoutUntil.getTime();
};

// Method to increment failed attempts
userSchema.methods.incrementFailedAttempts = function() {
  this.verificationAttempts += 1;
  
  // Lock out after 5 failed attempts for 15 minutes
  if (this.verificationAttempts >= 5) {
    this.verificationLockoutUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  }
  
  return this.verificationAttempts;
};

// Method to reset verification attempts (for resend)
userSchema.methods.resetVerificationAttempts = function() {
  this.verificationAttempts = 0;
  this.verificationLockoutUntil = undefined;
};

module.exports = mongoose.model('User', userSchema); 