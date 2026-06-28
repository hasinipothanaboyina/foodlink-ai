/**
 * FoodLink AI - Admin Panel Logic
 * Loads real platform stats, pending NGO approvals, and recent activity
 * from the backend admin API. Requires an admin-role JWT token.
 *
 * BUG FIX: ADMIN_API_BASE was hardcoded to 'http://localhost:5000/api'.
 * It now reads window.FOODLINK_API_BASE (set by script.js) so there is
 * one place to update the URL when deploying.
 */

// Falls back to localhost only if script.js hasn't run yet (shouldn't happen
// since script.js is loaded first in admin.html).
const ADMIN_API_BASE = window.FOODLINK_API_BASE || 'http://localhost:5000/api';

function getAdminToken() {
  return localStorage.getItem('foodlink_token');
}

async function adminApiCall(endpoint, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAdminToken()}`,
    },
  };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${ADMIN_API_BASE}${endpoint}`, options);
  return res.json();
}

// ─── LOAD STATS ─────────────────────────────────────────────────────────────
async function loadAdminStats() {
  try {
    const stats = await adminApiCall('/admin/stats');

    if (stats.message) {
      // auth error (e.g. token expired, not admin)
      document.getElementById('adminSubtitle').textContent = stats.message;
      return;
    }

    document.getElementById('statMeals').textContent = stats.totalMealsDonated.toLocaleString();
    document.getElementById('statUsers').textContent = stats.totalUsers.toLocaleString();
    document.getElementById('statNgos').textContent = stats.approvedNgos.toLocaleString();
    document.getElementById('statPendingNgos').textContent = stats.pendingNgos.toLocaleString();
    document.getElementById('statFailed').textContent = stats.failedMatches.toLocaleString();

    document.getElementById('adminSubtitle').textContent =
      `Live data — ${stats.totalDonations.toLocaleString()} total donations processed.`;
  } catch (err) {
    document.getElementById('adminSubtitle').textContent = 'Cannot connect to server. Is the backend running?';
  }
}

// ─── LOAD PENDING NGO APPROVALS ────────────────────────────────────────────
async function loadPendingNGOs() {
  const tbody = document.getElementById('pendingNgosBody');
  if (!tbody) return;

  try {
    const data = await adminApiCall('/admin/ngos/pending');

    if (!data.ngos || data.ngos.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#94a3b8;">No pending approvals.</td></tr>';
      return;
    }

    tbody.innerHTML = data.ngos.map((ngo) => `
      <tr style="border-color: #334155;">
        <td>${ngo.name}</td>
        <td>${ngo.registered_by || 'Unknown'}</td>
        <td>${ngo.capacity} meals</td>
        <td>${ngo.accepted_types}</td>
        <td>
          <button class="btn btn-primary approve-ngo-btn" data-id="${ngo.id}" style="padding: 0.4rem 1rem; font-size: 0.85rem;">
            <i class="fa-solid fa-check"></i> Approve
          </button>
        </td>
      </tr>
    `).join('');

    // Attach approve handlers
    document.querySelectorAll('.approve-ngo-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ngoId = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = 'Approving...';

        try {
          const result = await adminApiCall(`/ngos/${ngoId}/approve`, 'PATCH');
          if (result.message && result.message.includes('approved')) {
            await loadPendingNGOs();
            await loadAdminStats();
          } else {
            alert(result.message || 'Failed to approve NGO.');
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Approve';
          }
        } catch (err) {
          alert('Cannot connect to server.');
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-check"></i> Approve';
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#f43f5e;">Failed to load pending NGOs.</td></tr>';
  }
}

// ─── LOAD RECENT LOGS ───────────────────────────────────────────────────────
async function loadSystemLogs() {
  const tbody = document.getElementById('systemLogsBody');
  if (!tbody) return;

  try {
    const data = await adminApiCall('/admin/logs');

    const rows = [];

    (data.donationLogs || []).forEach((d) => {
      const time = new Date(d.created_at).toLocaleTimeString();
      const statusColor = d.status === 'cancelled' ? '#f43f5e' : d.status === 'pending' ? '#f59e0b' : '#10b981';
      rows.push(`
        <tr style="border-color: #334155;">
          <td>${time}</td>
          <td>Donation Submitted</td>
          <td>#FL-${d.id}: ${d.quantity}x ${d.food_type} ${d.ngo_name ? '→ ' + d.ngo_name : ''}</td>
          <td><span style="color: ${statusColor};">${d.status.toUpperCase()}</span></td>
        </tr>
      `);
    });

    (data.ngoLogs || []).forEach((n) => {
      const time = new Date(n.created_at).toLocaleTimeString();
      rows.push(`
        <tr style="border-color: #334155;">
          <td>${time}</td>
          <td>NGO Registration</td>
          <td>"${n.name}"</td>
          <td><span style="color: ${n.approved ? '#10b981' : '#f59e0b'};">${n.approved ? 'APPROVED' : 'PENDING'}</span></td>
        </tr>
      `);
    });

    tbody.innerHTML = rows.length
      ? rows.join('')
      : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;">No recent activity.</td></tr>';
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#f43f5e;">Failed to load logs.</td></tr>';
  }
}

// ─── LOGOUT ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('adminLogoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('foodlink_token');
      localStorage.removeItem('foodlink_user');
      window.location.href = 'auth.html';
    });
  }

  loadAdminStats();
  loadPendingNGOs();
  loadSystemLogs();
});