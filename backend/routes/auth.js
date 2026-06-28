/**
 * Auth Routes — FoodLink AI
 * POST /api/auth/register        — donor or NGO signup (NGO auto-approved)
 * POST /api/auth/login
 * POST /api/auth/google
 * POST /api/auth/forgot-password
 * POST /api/auth/reset-password
 */

const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const pool      = require('../db/connection');

const router = express.Router();

// ─── PASSWORD STRENGTH VALIDATOR ─────────────────────────────────────────────
// Min 8 chars · at least 1 uppercase · 1 digit · 1 special character
function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one capital letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return 'Password must contain at least one special character (e.g. @, #, $, !).';
  }
  return null; // null = valid
}

// ─── EMAIL TRANSPORTER ────────────────────────────────────────────────────────
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  // ── Password strength check (applies to BOTH donor and NGO) ──
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ message: pwError });

  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role || 'donor']
    );

    // ── NGO registration: auto-approved (approved = 1) ──
    if (role === 'ngo') {
      const {
        city, address, org_type,
        latitude, longitude, capacity, accepted_types,
        photo_url,        // optional: URL of uploaded photo (handled by frontend)
        members,
      } = req.body;

      await pool.query(
        `INSERT INTO ngos
           (user_id, name, city, address, latitude, longitude,
            capacity, accepted_types, org_type, email, approved)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          result.insertId,
          name,
          city           || 'Unknown',
          address        || null,
          parseFloat(latitude)  || 0,
          parseFloat(longitude) || 0,
          parseInt(capacity) || parseInt(members) || 100,
          accepted_types || 'cooked,produce,packaged,bakery',
          org_type       || null,
          email          || null,
        ]
      );
    }

    return res.status(201).json({
      message: 'Account created successfully. Please log in.',
      userId: result.insertId,
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Server error during login.' });
  }
});

// ─── GOOGLE SIGN-IN ───────────────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ message: 'Google credential is required.' });
  }

  try {
    const verifyRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
    );
    if (!verifyRes.ok) {
      return res.status(401).json({ message: 'Invalid Google credential.' });
    }

    const payload      = await verifyRes.json();
    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (googleClientId && payload.aud !== googleClientId) {
      return res.status(401).json({ message: 'Google token audience mismatch.' });
    }

    const { email, name } = payload;
    if (!email) {
      return res.status(400).json({ message: 'Google account has no email.' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    let user;

    if (rows.length > 0) {
      user = rows[0];
    } else {
      const randomPwd     = require('crypto').randomBytes(32).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPwd, 10);
      const [result] = await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
        [name || email.split('@')[0], email, hashedPassword, 'donor']
      );
      user = { id: result.insertId, name: name || email.split('@')[0], email, role: 'donor' };
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('Google sign-in error:', err);
    return res.status(500).json({ message: 'Server error during Google sign-in.' });
  }
});

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email address is required.' });

  try {
    const [rows] = await pool.query('SELECT id, name FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.json({ message: 'If this email is registered, a reset link has been sent.' });
    }

    const user       = rows[0];
    const resetToken = jwt.sign(
      { id: user.id, email, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
    const resetLink   = `${frontendUrl}/reset-password.html?token=${resetToken}`;

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️  SMTP not configured. Reset link (dev):', resetLink);
      return res.json({
        message: 'Reset link generated. (SMTP not configured — check server logs for dev link.)',
        devLink: resetLink,
      });
    }

    const transporter = createTransporter();
    await transporter.sendMail({
      from: `"FoodLink AI" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'FoodLink AI — Password Reset Request',
      html: `<p>Hello ${user.name},</p><p><a href="${resetLink}">Reset your password</a> (expires in 15 min).</p>`,
    });

    return res.json({ message: 'If this email is registered, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// ─── RESET PASSWORD ───────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ message: 'Token and new password are required.' });
  }

  // Apply same strong password rules on reset too
  const pwError = validatePassword(password);
  if (pwError) return res.status(400).json({ message: pwError });

  try {
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ message: 'This reset link has expired or is invalid.' });
    }

    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({ message: 'Invalid reset token.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, decoded.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    return res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

module.exports = router;