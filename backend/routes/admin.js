/**
 * Admin Routes (admin role only)
 * GET   /api/admin/stats           -> platform-wide metrics for admin.html
 * GET   /api/admin/ngos/pending    -> NGOs awaiting approval
 * GET   /api/admin/logs            -> recent activity (latest donations + NGO signups)
 */

const express = require('express');
const pool = require('../db/connection');
const authMiddleware = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');

const router = express.Router();

// All admin routes require a valid token AND role = 'admin'
router.use(authMiddleware, adminOnly);

// ─── PLATFORM STATS ─────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [[userCount]] = await pool.query('SELECT COUNT(*) AS total FROM users');
    const [[ngoCount]] = await pool.query('SELECT COUNT(*) AS total FROM ngos WHERE approved = 1');
    const [[pendingNgoCount]] = await pool.query('SELECT COUNT(*) AS total FROM ngos WHERE approved = 0');
    const [[donationCount]] = await pool.query('SELECT COUNT(*) AS total FROM donations');
    const [[failedCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM donations WHERE status = 'cancelled' OR (status = 'pending' AND ngo_id IS NULL)"
    );
    const [[mealsTotal]] = await pool.query(
      "SELECT COALESCE(SUM(quantity), 0) AS total FROM donations WHERE status != 'cancelled'"
    );

    return res.json({
      totalUsers: userCount.total,
      approvedNgos: ngoCount.total,
      pendingNgos: pendingNgoCount.total,
      totalDonations: donationCount.total,
      failedMatches: failedCount.total,
      totalMealsDonated: mealsTotal.total,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while fetching stats.' });
  }
});

// ─── PENDING NGO APPROVALS ──────────────────────────────────────────────────
router.get('/ngos/pending', async (req, res) => {
  try {
    const [ngos] = await pool.query(
      `SELECT n.*, u.name AS registered_by, u.email AS contact_email
       FROM ngos n
       LEFT JOIN users u ON n.user_id = u.id
       WHERE n.approved = 0
       ORDER BY n.created_at DESC`
    );
    return res.json({ ngos });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while fetching pending NGOs.' });
  }
});

// ─── RECENT ACTIVITY LOG ────────────────────────────────────────────────────
router.get('/logs', async (req, res) => {
  try {
    const [donationLogs] = await pool.query(
      `SELECT id, food_type, quantity, status, ngo_name, created_at
       FROM donations ORDER BY created_at DESC LIMIT 10`
    );

    const [ngoLogs] = await pool.query(
      `SELECT id, name, approved, created_at
       FROM ngos ORDER BY created_at DESC LIMIT 10`
    );

    return res.json({ donationLogs, ngoLogs });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while fetching logs.' });
  }
});

module.exports = router;