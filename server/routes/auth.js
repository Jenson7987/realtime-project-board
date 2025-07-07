const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

// POST /api/auth/register - Register a new user
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    console.log('Registration attempt for:', { username, email, firstName, lastName });

    // Check if username already exists
    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      console.log('Username already exists:', { username });
      return res.status(400).json({ error: 'Username already taken' });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      console.log('Email already exists:', { email });
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create new user
    const user = new User({
      username: username.toLowerCase(),
      email,
      password,
      firstName,
      lastName
    });

    // Generate email verification code
    const verificationCode = user.generateEmailVerificationCode();

    console.log('Created user object:', { 
      username: user.username,
      email: user.email, 
      firstName: user.firstName, 
      lastName: user.lastName,
      hasPassword: !!user.password 
    });

    await user.save();
    console.log('User saved successfully');

    // Send verification email
    console.log('=== REGISTRATION DEBUG ===');
    console.log('About to send verification email to:', email);
    console.log('Verification code:', verificationCode);
    console.log('==========================');
    
    try {
      await sendVerificationEmail(email, verificationCode, username);
      console.log('Email sending completed successfully');
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      console.error('Email error details:', emailError.message);
      // Don't fail registration if email fails, but log it
    }

    // Generate JWT token (user can still login but with limited access)
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Generated token for user:', { userId: user._id });

    res.status(201).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified
      },
      message: 'Registration successful! Please check your email for a verification code.',
      requiresVerification: true
    });
  } catch (err) {
    console.error('Registration error:', err);
    if (err.code === 11000) {
      if (err.keyPattern.username) {
        return res.status(400).json({ error: 'Username already taken' });
      }
      if (err.keyPattern.email) {
        return res.status(400).json({ error: 'Email already registered' });
      }
    }
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// POST /api/auth/verify-email - Verify email address with code
router.post('/verify-email', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    console.log('=== VERIFICATION DEBUG ===');
    console.log('Received code:', code);
    console.log('Code type:', typeof code);

    const user = await User.findOne({ emailVerificationCode: code });

    if (!user) {
      console.log('No user found with code:', code);
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    console.log('Found user:', user.email);
    console.log('Stored code:', user.emailVerificationCode);
    console.log('Code expires at:', user.emailVerificationExpires);
    console.log('Current time:', new Date());
    console.log('Is expired:', Date.now() > user.emailVerificationExpires.getTime());

    // Check if account is locked out
    if (user.isLockedOut()) {
      const lockoutTime = Math.ceil((user.verificationLockoutUntil.getTime() - Date.now()) / 1000 / 60);
      return res.status(429).json({ 
        error: `Too many failed attempts. Please try again in ${lockoutTime} minutes.`,
        lockoutTime: lockoutTime
      });
    }

    if (Date.now() > user.emailVerificationExpires.getTime()) {
      console.log('Code has expired');
      return res.status(400).json({ error: 'Verification code has expired' });
    }

    // Verify the email
    const isVerified = user.verifyEmailCode(code);
    console.log('Verification result:', isVerified);
    
    if (!isVerified) {
      console.log('Verification failed');
      // Increment failed attempts
      const attempts = user.incrementFailedAttempts();
      await user.save();
      
      const remainingAttempts = 5 - attempts;
      if (remainingAttempts > 0) {
        return res.status(400).json({ 
          error: `Invalid verification code. ${remainingAttempts} attempts remaining.` 
        });
      } else {
        return res.status(429).json({ 
          error: 'Too many failed attempts. Please try again in 15 minutes.',
          lockoutTime: 15
        });
      }
    }

    await user.save();
    console.log('User saved successfully, email verified');

    // Generate new JWT token for verified user
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Generated new token for verified user');
    console.log('==================');

    res.json({ 
      message: 'Email verified successfully!',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Failed to verify email' });
  }
});

// POST /api/auth/resend-verification - Resend verification email
router.post('/resend-verification', async (req, res) => {
  try {
    let user;
    
    // Try to get user from auth token first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.userId);
      } catch (tokenError) {
        console.log('Invalid token, will try email lookup');
      }
    }
    
    // If no user from token, try to get from request body
    if (!user && req.body.email) {
      user = await User.findOne({ email: req.body.email.toLowerCase() });
    }
    
    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Check if account is locked out
    if (user.isLockedOut()) {
      const lockoutTime = Math.ceil((user.verificationLockoutUntil.getTime() - Date.now()) / 1000 / 60);
      return res.status(429).json({ 
        error: `Account is locked due to too many failed attempts. Please try again in ${lockoutTime} minutes.`,
        lockoutTime: lockoutTime
      });
    }

    // Generate new verification code and reset attempts
    const verificationCode = user.generateEmailVerificationCode();
    user.resetVerificationAttempts(); // Reset brute force protection
    await user.save();

    // Send verification email
    await sendVerificationEmail(user.email, verificationCode, user.username);

    res.json({ message: 'Verification email sent successfully' });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
    }

    // Generate password reset token
    const resetToken = user.generateEmailVerificationCode(); // Reuse the same method
    await user.save();

    // Send password reset email
    await sendPasswordResetEmail(user.email, resetToken, user.username);

    res.json({ message: 'If an account with that email exists, a password reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Failed to process password reset request' });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    const user = await User.findOne({ emailVerificationCode: token });

    if (!user) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    if (Date.now() > user.emailVerificationExpires.getTime()) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Update password
    user.password = newPassword;
    user.emailVerificationCode = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt for:', { username });

    // Find user by username or email
    const user = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: username.toLowerCase() }
      ]
    });
    
    if (!user) {
      console.log('User not found:', { username });
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    console.log('Password match:', { isMatch });
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username/email or password' });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({ 
        error: 'Please verify your email address before logging in',
        requiresVerification: true,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isEmailVerified: user.isEmailVerified
        }
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('Login successful:', { userId: user._id });
    res.json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// GET /api/auth/me - Get current user
router.get('/me', auth, async (req, res) => {
  try {
    // The user object is already attached to req.user by the auth middleware
    res.json(req.user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 