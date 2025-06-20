const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

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

    console.log('Created user object:', { 
      username: user.username,
      email: user.email, 
      firstName: user.firstName, 
      lastName: user.lastName,
      hasPassword: !!user.password 
    });

    await user.save();
    console.log('User saved successfully');

    // Generate JWT token
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
        lastName: user.lastName
      }
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

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Login attempt for:', { username });

    // Find user by username
    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user) {
      console.log('User not found:', { username });
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    console.log('Password match:', { isMatch });
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
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
        lastName: user.lastName
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