/**
 * NGO Routes
 * POST  /api/ngos/register     -> register as an NGO (pending approval)
 * GET   /api/ngos               -> list all approved NGOs (optionally sorted by distance)
 * PATCH /api/ngos/:id/approve   -> approve an NGO (admin only)
 */

const express = require('express');
const pool = require('../db/connection');
const authMiddleware = require('../middleware/auth');
const { adminOnly } = require('../middleware/auth');

const router = express.Router();

// ─── HAVERSINE DISTANCE (km) ──────────────────────────────────────────────
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── REGISTER AS NGO ────────────────────────────────────────────────────────
router.post('/register', authMiddleware, async (req, res) => {
  const { name, city, latitude, longitude, capacity, accepted_types } = req.body;

  if (!name || latitude == null || longitude == null) {
    return res.status(400).json({ message: 'Name, latitude, and longitude are required.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO ngos (user_id, name, city, latitude, longitude, capacity, accepted_types, approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        req.user.id,
        name,
        city || 'Unknown',
        latitude,
        longitude,
        capacity || 100,
        accepted_types || 'cooked,produce,packaged,bakery',
      ]
    );

    return res.status(201).json({
      message: 'NGO registered successfully. You can now log in.',
      ngoId: result.insertId,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while registering NGO.' });
  }
});

// ─── LIST APPROVED NGOS (all NGOs, with distance if lat/lng provided) ───────
router.get('/', async (req, res) => {
  try {
    const [ngos] = await pool.query('SELECT * FROM ngos WHERE approved = 1 ORDER BY name ASC');

    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const hasUserLocation = !isNaN(lat) && !isNaN(lng);

    const enriched = ngos.map((ngo) => ({
      ...ngo,
      distance_km: hasUserLocation ? getDistanceKm(lat, lng, ngo.latitude, ngo.longitude) : null,
    }));

    if (hasUserLocation) {
      enriched.sort((a, b) => a.distance_km - b.distance_km);
    }

    return res.json({ ngos: enriched });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while fetching NGOs.' });
  }
});

// ─── APPROVE NGO (admin only) ────────────────────────────────────────────────
router.patch('/:id/approve', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [result] = await pool.query('UPDATE ngos SET approved = 1 WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'NGO not found.' });
    }

    return res.json({ message: 'NGO approved successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;