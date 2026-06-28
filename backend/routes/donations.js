/**
 * Donations Routes
 * POST  /api/donations            -> create donation + AI-match nearest suitable NGO
 * GET   /api/donations/my         -> list logged-in user's donations
 * GET   /api/donations/ngo        -> donations matched to this NGO (for NGO dashboard)
 * GET   /api/donations/all        -> all donations (admin only)
 * GET   /api/donations/:id        -> get single donation
 * PATCH /api/donations/:id/accept -> NGO accepts a pending donation
 * PATCH /api/donations/:id/status -> update status (donor)
 * PATCH /api/donations/:id/complete -> mark donation as completed (NGO)
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

// ─── AI MATCHING ENGINE ───────────────────────────────────────────────────
async function findBestNGO(donation) {
  const [ngos] = await pool.query('SELECT * FROM ngos WHERE approved = 1');

  let best = null;
  let bestDistance = Infinity;

  for (const ngo of ngos) {
    const acceptedTypes = ngo.accepted_types.split(',');
    if (!acceptedTypes.includes(donation.food_type)) continue;
    if (donation.quantity > ngo.capacity) continue;

    if (donation.latitude == null || donation.longitude == null) {
      if (!best) best = { ngo, distance: null };
      continue;
    }

    const distance = getDistanceKm(donation.latitude, donation.longitude, ngo.latitude, ngo.longitude);

    if (distance < bestDistance) {
      bestDistance = distance;
      best = { ngo, distance };
    }
  }

  return best;
}

// ─── CREATE DONATION ──────────────────────────────────────────────────────
router.post('/', authMiddleware, async (req, res) => {
  const {
    food_type, quantity, pickup_by, address,
    description, latitude, longitude,
    preferred_ngo_id,           // NEW — optional, sent from donate form
  } = req.body;

  if (!food_type || !quantity || !pickup_by || !address) {
    return res.status(400).json({ message: 'Food type, quantity, pickup time, and address are required.' });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO donations (user_id, food_type, quantity, pickup_by, address, description, latitude, longitude, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [req.user.id, food_type, quantity, pickup_by, address, description || '', latitude ?? null, longitude ?? null]
    );

    const donationId = result.insertId;
    const donation   = { food_type, quantity, latitude: latitude ?? null, longitude: longitude ?? null };

    let matchedNGO = null;
    let match      = null;

    // ── STEP 1: Try preferred NGO first (if donor chose one) ─────────────
    if (preferred_ngo_id) {
      const [preferredRows] = await pool.query(
        'SELECT * FROM ngos WHERE id = ? AND approved = 1',
        [preferred_ngo_id]
      );

      if (preferredRows.length > 0) {
        const pNgo = preferredRows[0];
        const acceptedTypes = pNgo.accepted_types.split(',');

        // Check if preferred NGO can accept this donation
        const canAccept = acceptedTypes.includes(food_type) && quantity <= pNgo.capacity;

        if (canAccept) {
          // ✅ Preferred NGO accepted — use it directly
          const dist = (latitude != null && longitude != null)
            ? getDistanceKm(latitude, longitude, pNgo.latitude, pNgo.longitude)
            : null;

          match = { ngo: pNgo, distance: dist };
        }
        // else: preferred NGO is full or wrong type → fall through to AI
      }
    }

    // ── STEP 2: AI matching fallback if no preferred or preferred was full ─
    if (!match) {
      match = await findBestNGO(donation);
    }

    // ── STEP 3: Save the match ────────────────────────────────────────────
    if (match) {
      await pool.query(
        `UPDATE donations SET status = 'matched', ngo_id = ?, ngo_name = ?, distance_km = ? WHERE id = ?`,
        [match.ngo.id, match.ngo.name, match.distance, donationId]
      );

      matchedNGO = {
        id:       match.ngo.id,
        name:     match.ngo.name,
        distance: match.distance != null ? `${match.distance.toFixed(1)} km` : 'Nearby',
        // Flag so frontend knows if it was preferred or AI-matched
        wasPreferred: preferred_ngo_id && match.ngo.id === parseInt(preferred_ngo_id),
      };
    }

    return res.status(201).json({
      message: 'Donation submitted successfully.',
      donationId,
      matchedNGO,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while submitting donation.' });
  }
});

// ─── GET MY DONATIONS (donor — supports ?status=&page=&limit=) ────────────
// IMPORTANT: must be defined BEFORE /:id to prevent Express from matching "my" as an :id
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const { status, page, limit } = req.query;

    const pageNum  = Math.max(parseInt(page)  || 1,   1);
    const pageSize = Math.min(Math.max(parseInt(limit) || 100, 1), 100);
    const offset = (pageNum - 1) * pageSize;

    let whereClause = 'WHERE user_id = ?';
    const params = [req.user.id];

    if (status && status !== 'all') {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM donations ${whereClause}`,
      params
    );

    const [donations] = await pool.query(
      `SELECT * FROM donations ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    return res.json({
      donations,
      pagination: {
        total,
        page: pageNum,
        limit: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while fetching donations.' });
  }
});

// ─── GET ALL DONATIONS (admin only) ─────────────────────────────────────────
// IMPORTANT: must be defined BEFORE /:id to prevent "all" being treated as an ID
router.get('/all', authMiddleware, adminOnly, async (req, res) => {
  try {
    const [donations] = await pool.query(
      `SELECT d.*, u.name AS donor_name, u.email AS donor_email
       FROM donations d
       JOIN users u ON d.user_id = u.id
       ORDER BY d.created_at DESC`
    );
    return res.json({ donations });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while fetching donations.' });
  }
});

// ─── GET DONATIONS FOR NGO DASHBOARD (matched/in_transit/completed for THIS NGO) ──
// IMPORTANT: must be defined BEFORE /:id
router.get('/ngo', authMiddleware, async (req, res) => {
  try {
    // Find the NGO record linked to this user
    // BUG FIX: also check approved = 1 so unapproved NGOs cannot pull donation data.
    const [ngoRows] = await pool.query(
      'SELECT id FROM ngos WHERE user_id = ? AND approved = 1',
      [req.user.id]
    );
    if (ngoRows.length === 0) {
      return res.status(404).json({ message: 'No approved NGO profile found for this account.' });
    }
    const ngoId = ngoRows[0].id;

    const [donations] = await pool.query(
      `SELECT d.*, u.name AS donor_name
       FROM donations d
       JOIN users u ON d.user_id = u.id
       WHERE d.ngo_id = ?
       ORDER BY d.created_at DESC`,
      [ngoId]
    );

    return res.json({ donations });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error while fetching NGO donations.' });
  }
});

// ─── GET ALL DONATIONS FOR NGO VIEW (pending + their matched/in_transit/completed) ─────
// Called by ngo-dashboard.html as GET /api/donations
router.get('/', authMiddleware, async (req, res) => {
  try {
    // If admin, return all
    if (req.user.role === 'admin') {
      const [donations] = await pool.query(
        `SELECT d.*, u.name AS donor_name FROM donations d
         JOIN users u ON d.user_id = u.id
         ORDER BY d.created_at DESC`
      );
      return res.json({ donations });
    }

    // If NGO: return pending (unmatched, for browsing) + donations matched/active for THIS NGO.
    // BUG FIX: previously returned all completed donations from every NGO because the
    // WHERE only checked ngo_id for non-pending rows — but that correctly scopes to this
    // NGO via ngo_id. The real issue was loadStats() and loadHistory() both calling this
    // endpoint and counting platform-wide. Those frontend functions now call /donations/ngo
    // for NGO-specific data. This endpoint is now only used for the "incoming" pending list.
    if (req.user.role === 'ngo') {
      const [ngoRows] = await pool.query('SELECT id FROM ngos WHERE user_id = ?', [req.user.id]);
      const ngoId = ngoRows.length > 0 ? ngoRows[0].id : null;

      const [donations] = await pool.query(
        `SELECT d.*, u.name AS donor_name FROM donations d
         JOIN users u ON d.user_id = u.id
         WHERE d.status = 'pending' OR d.ngo_id = ?
         ORDER BY d.created_at DESC`,
        [ngoId]
      );
      return res.json({ donations });
    }

    return res.status(403).json({ message: 'Access denied.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ─── GET SINGLE DONATION ────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM donations WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Donation not found.' });
    }

    return res.json({ donation: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ─── NGO ACCEPT DONATION ────────────────────────────────────────────────────
router.patch('/:id/accept', authMiddleware, async (req, res) => {
  try {
    const [ngoRows] = await pool.query('SELECT id, name FROM ngos WHERE user_id = ?', [req.user.id]);
    if (ngoRows.length === 0) {
      return res.status(403).json({ message: 'NGO profile not found.' });
    }
    const { id: ngoId, name: ngoName } = ngoRows[0];

    const [rows] = await pool.query('SELECT * FROM donations WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Donation not found.' });

    // Update status to matched AND set ngo_name so donor dashboard shows the correct NGO name
    await pool.query(
      `UPDATE donations SET status = 'matched', ngo_id = ?, ngo_name = ? WHERE id = ?`,
      [ngoId, ngoName, req.params.id]
    );
    return res.json({ message: 'Donation accepted successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ─── NGO COMPLETE DONATION ──────────────────────────────────────────────────
router.patch('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM donations WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ message: 'Donation not found.' });

    await pool.query(
      `UPDATE donations SET status = 'completed' WHERE id = ?`,
      [req.params.id]
    );
    return res.json({ message: 'Donation marked as completed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

// ─── UPDATE DONATION STATUS ─────────────────────────────────────────────────
router.patch('/:id/status', authMiddleware, async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'matched', 'in_transit', 'completed', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status value.' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM donations WHERE id = ? AND user_id = ?', [
      req.params.id,
      req.user.id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Donation not found.' });
    }

    await pool.query('UPDATE donations SET status = ? WHERE id = ?', [status, req.params.id]);

    return res.json({ message: 'Status updated successfully.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;