/**
 * FoodLink AI - Backend Server (MySQL)
 * Setup:
 *   1. Run db/schema.sql in MySQL Workbench
 *   2. Fill in .env with your MySQL credentials
 *   3. npm install
 *   4. npm run dev
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const donationRoutes = require('./routes/donations');
const ngoRoutes = require('./routes/ngos');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ─────────────────────────────────────────────────────────────────
// Allow requests from any origin (for local frontend development and deployed frontends)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json());

// ─── ROOT HEALTH CHECK ────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ message: 'FoodLink AI Backend is running!', version: '2.0.0' });
});

// ─── ROUTES ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/ngos', ngoRoutes);
app.use('/api/admin', adminRoutes);

// ─── 404 HANDLER ──────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found.' });
});

// ─── GLOBAL ERROR HANDLER ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`✅ FoodLink AI Server running on http://localhost:${PORT}`);
});