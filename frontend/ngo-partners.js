/**
 * FoodLink AI — NGO Partners Page
 * ─────────────────────────────────────────────────────────────────
 * Displays real NGO data from the backend (schema.sql fields):
 *   name, address, city, district, org_type, capacity,
 *   accepted_types, darpan_id, phone, email, distance_km
 *
 * Features:
 *   • Skeleton loading state
 *   • District + City + Org-type triple filter
 *   • Live name search
 *   • "Sort by Distance" geolocation sort
 *   • Result count badge
 *   • Notification badge + list
 *
 * Depends on script.js (provides apiCall)
 */

'use strict';

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
let allNgos    = [];
let userCoords = null;
let searchTerm = '';

/* ═══════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════ */
const ORG_TYPE_LABELS = {
  food_bank:         'Food Bank',
  orphanage:         'Orphanage',
  old_age_home:      'Old Age Home',
  shelter:           'Shelter',
  community_kitchen: 'Community Kitchen',
  rural_development: 'Rural Development',
};

const ORG_TYPE_ICONS = {
  food_bank:         'fa-store',
  orphanage:         'fa-child',
  old_age_home:      'fa-person-cane',
  shelter:           'fa-house-chimney-user',
  community_kitchen: 'fa-utensils',
  rural_development: 'fa-tractor',
};

const FOOD_TYPE_LABELS = {
  cooked:   'Cooked Meals',
  produce:  'Fresh Produce',
  packaged: 'Packaged Goods',
  bakery:   'Bakery / Bread',
};

function orgIcon(type)  { return ORG_TYPE_ICONS[type]  || 'fa-building-ngo'; }
function orgLabel(type) { return ORG_TYPE_LABELS[type] || (type || 'NGO').replace(/_/g, ' '); }

function foodTypeChips(accepted_types) {
  if (!accepted_types) return '';
  return accepted_types
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => `<span class="type-chip">${FOOD_TYPE_LABELS[t] || t}</span>`)
    .join('');
}

function escHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ═══════════════════════════════════════════
   LOAD FROM API
═══════════════════════════════════════════ */
async function loadNgoPartners() {
  const grid = document.getElementById('ngoCardsGrid');
  if (!grid) return;

  grid.innerHTML = buildSkeletons(6);

  try {
    const query = userCoords
      ? `?lat=${userCoords.lat}&lng=${userCoords.lng}`
      : '';

    const data = await apiCall(`/ngos${query}`);
    allNgos    = data.ngos || [];

    if (allNgos.length === 0) {
      grid.innerHTML = `
        <div class="state-box">
          <i class="fa-solid fa-building-ngo"></i>
          <strong>No NGOs found</strong>
          <p>There are no approved NGO partners yet. Check back soon or ask the admin to approve one.</p>
        </div>`;
      return;
    }

    populateFilters(allNgos);
    renderNgoCards(allNgos);

  } catch (err) {
    console.error('Failed to load NGOs:', err);
    grid.innerHTML = `
      <div class="state-box">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <strong>Could not load NGOs</strong>
        <p>Please make sure you are logged in and the backend server is running.</p>
      </div>`;
  }
}

/* ═══════════════════════════════════════════
   POPULATE FILTER DROPDOWNS
═══════════════════════════════════════════ */
function populateFilters(ngos) {
  const districts = [...new Set(ngos.map(n => n.district).filter(Boolean))].sort();
  const distSel   = document.getElementById('districtFilter');
  if (distSel) {
    const prev = distSel.value;
    distSel.innerHTML = '<option value="all">All Districts</option>' +
      districts.map(d => `<option value="${d}">${d}</option>`).join('');
    if (prev) distSel.value = prev;
  }

  refreshCityFilter(ngos);
}

function refreshCityFilter(ngos) {
  const distVal  = document.getElementById('districtFilter')?.value || 'all';
  const filtered = distVal === 'all' ? ngos : ngos.filter(n => n.district === distVal);
  const cities   = [...new Set(filtered.map(n => n.city).filter(Boolean))].sort();

  const citySel = document.getElementById('cityFilter');
  if (!citySel) return;
  const prev = citySel.value;
  citySel.innerHTML = '<option value="all">All Cities</option>' +
    cities.map(c => `<option value="${c}">${c}</option>`).join('');
  if (cities.includes(prev)) citySel.value = prev;
}

/* ═══════════════════════════════════════════
   RENDER CARDS
═══════════════════════════════════════════ */
function renderNgoCards(ngos) {
  const grid    = document.getElementById('ngoCardsGrid');
  const countEl = document.getElementById('resultCount');
  if (!grid) return;

  const distVal = document.getElementById('districtFilter')?.value || 'all';
  const cityVal = document.getElementById('cityFilter')?.value     || 'all';
  const typeVal = document.getElementById('typeFilter')?.value     || 'all';
  const query   = searchTerm.trim().toLowerCase();

  const filtered = ngos.filter(n => {
    if (distVal !== 'all' && n.district !== distVal)               return false;
    if (cityVal !== 'all' && n.city     !== cityVal)               return false;
    if (typeVal !== 'all' && n.org_type !== typeVal)               return false;
    if (query && !n.name.toLowerCase().includes(query))            return false;
    return true;
  });

  if (countEl) {
    countEl.textContent = filtered.length === ngos.length
      ? `${filtered.length} organisations`
      : `${filtered.length} of ${ngos.length} organisations`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="state-box">
        <i class="fa-solid fa-filter-circle-xmark"></i>
        <strong>No results</strong>
        <p>No NGOs match your current filters. Try changing or clearing the filters.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(ngo => buildNgoCard(ngo)).join('');
}

/* ═══════════════════════════════════════════
   BUILD A SINGLE NGO CARD
═══════════════════════════════════════════ */
function buildNgoCard(ngo) {
  const orgType  = ngo.org_type || 'food_bank';
  const icon     = orgIcon(orgType);
  const typeText = orgLabel(orgType);

  const addressHtml = ngo.address
    ? `<div class="ngo-meta-row">
         <i class="fa-solid fa-location-dot ngo-meta-icon"></i>
         <span>${escHtml(ngo.address)}</span>
       </div>`
    : (ngo.city
        ? `<div class="ngo-meta-row">
             <i class="fa-solid fa-location-dot ngo-meta-icon"></i>
             <span>${escHtml(ngo.city)}${ngo.district ? ', ' + escHtml(ngo.district) : ''}</span>
           </div>`
        : '');

  const phoneHtml = ngo.phone
    ? `<div class="ngo-meta-row">
         <i class="fa-solid fa-phone ngo-meta-icon"></i>
         <a href="tel:${escHtml(ngo.phone)}">${escHtml(ngo.phone)}</a>
       </div>`
    : '';

  const emailHtml = ngo.email
    ? `<div class="ngo-meta-row">
         <i class="fa-solid fa-envelope ngo-meta-icon"></i>
         <a href="mailto:${escHtml(ngo.email)}">${escHtml(ngo.email)}</a>
       </div>`
    : '';

  const darpanHtml = ngo.darpan_id
    ? `<span class="darpan-badge" title="NGO Darpan Registration ID">
         <i class="fa-solid fa-certificate"></i>${escHtml(ngo.darpan_id)}
       </span>`
    : '';

  const distHtml = ngo.distance_km != null
    ? `<span class="distance-badge">
         <i class="fa-solid fa-route"></i>
         ${Number(ngo.distance_km).toFixed(1)} km
       </span>`
    : '';

  const chipsHtml = foodTypeChips(ngo.accepted_types);

  return `
    <div class="ngo-card">
      <div class="ngo-card-top">
        <div class="ngo-avatar ${escHtml(orgType)}">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="ngo-name">${escHtml(ngo.name)}</div>
          <div>
            <span class="ngo-org-type">
              <i class="fa-solid ${icon}" style="font-size:0.65rem;"></i>
              ${typeText}
            </span>
            ${ngo.district
              ? `<span style="font-size:0.72rem;color:var(--text-muted);margin-left:0.4rem;">
                   · ${escHtml(ngo.district)} District
                 </span>`
              : ''}
          </div>
        </div>
        ${distHtml}
      </div>

      <div class="ngo-card-body">
        ${addressHtml}
        ${phoneHtml}
        ${emailHtml}
        ${darpanHtml}
      </div>

      <div class="ngo-card-footer">
        <div class="ngo-types">${chipsHtml}</div>
        <div class="ngo-capacity">
          ${ngo.capacity} <span>meals/day</span>
        </div>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════════
   SKELETON LOADER
═══════════════════════════════════════════ */
function buildSkeletons(count) {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card">
      <div style="display:flex;gap:.75rem;align-items:center;margin-bottom:.5rem;">
        <div class="skel" style="width:46px;height:46px;border-radius:10px;flex-shrink:0;"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:.4rem;">
          <div class="skel skel-title"></div>
          <div class="skel skel-sub"></div>
        </div>
      </div>
      <div class="skel skel-line"></div>
      <div class="skel skel-line-s"></div>
      <div class="skel skel-line" style="width:80%"></div>
      <div style="margin-top:.5rem;display:flex;gap:.4rem;">
        <div class="skel" style="height:20px;width:80px;border-radius:20px;"></div>
        <div class="skel" style="height:20px;width:70px;border-radius:20px;"></div>
      </div>
    </div>`).join('');
}

/* ═══════════════════════════════════════════
   NOTIFICATIONS (badge + list)
═══════════════════════════════════════════ */
async function loadNotificationsList() {
  const listEl = document.getElementById('notificationsList');
  const badge  = document.getElementById('notifCountBadge');
  if (!listEl) return;

  try {
    const data      = await apiCall('/donations/my');
    const donations = data.donations || [];
    const relevant  = donations.filter(d => d.status !== 'pending').slice(0, 8);
    const count     = relevant.length;

    if (badge) {
      badge.style.display = count > 0 ? 'inline-block' : 'none';
      badge.textContent   = count;
    }

    if (count === 0) {
      listEl.innerHTML = '<p style="padding:1rem;color:var(--text-muted);text-align:center;">No notifications yet.</p>';
      return;
    }

    const statusText = {
      matched:    'Matched with',
      in_transit: 'Picked up by',
      completed:  'Delivered via',
      cancelled:  'Cancelled —',
    };

    listEl.innerHTML = relevant.map(d => `
      <div style="padding:0.75rem 1rem;border-bottom:1px solid var(--border);">
        <strong>#FL-${d.id}: ${statusText[d.status] || d.status} ${escHtml(d.ngo_name || '')}</strong><br>
        <span style="font-size:0.82rem;color:var(--text-muted);">${d.quantity}× ${escHtml(d.food_type)} — ${new Date(d.created_at).toLocaleDateString()}</span>
      </div>`).join('');

  } catch {
    listEl.innerHTML = '<p style="padding:1rem;color:var(--text-muted);text-align:center;">Could not load notifications.</p>';
  }
}

/* ═══════════════════════════════════════════
   INIT — runs after DOM is ready
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  /* ── User info in navbar ── */
  const _user = JSON.parse(localStorage.getItem('foodlink_user') || '{}');
  if (_user.name) {
    const ini = _user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const avatarEl = document.getElementById('userAvatar');
    const nameEl   = document.getElementById('userNameNav');
    if (avatarEl) avatarEl.textContent = ini;
    if (nameEl)   nameEl.textContent   = _user.name;
  }

  /* ── Logout ── */
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', e => {
      e.preventDefault();
      localStorage.removeItem('foodlink_token');
      localStorage.removeItem('foodlink_user');
      window.location.href = 'auth.html';
    });
  }

  /* ── Search input ── */
  const searchInput = document.getElementById('ngoSearchInput');
  const clearBtn    = document.getElementById('clearSearchBtn');

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchTerm = searchInput.value;
      if (clearBtn) clearBtn.style.display = searchTerm.length > 0 ? 'block' : 'none';
      renderNgoCards(allNgos);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchTerm = '';
      clearBtn.style.display = 'none';
      if (searchInput) searchInput.focus();
      renderNgoCards(allNgos);
    });
  }

  /* ── Filter dropdowns ── */
  const distSel = document.getElementById('districtFilter');
  if (distSel) {
    distSel.addEventListener('change', () => {
      refreshCityFilter(allNgos);
      renderNgoCards(allNgos);
    });
  }

  const citySel = document.getElementById('cityFilter');
  if (citySel) citySel.addEventListener('change', () => renderNgoCards(allNgos));

  const typeSel = document.getElementById('typeFilter');
  if (typeSel) typeSel.addEventListener('change', () => renderNgoCards(allNgos));

  /* ── Sort by Distance button ── */
  const nearBtn = document.getElementById('findNearMeBtn');
  if (nearBtn) {
    nearBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
      }

      nearBtn.disabled  = true;
      nearBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating…';

      navigator.geolocation.getCurrentPosition(
        position => {
          userCoords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          nearBtn.innerHTML = '<i class="fa-solid fa-check"></i> Sorted by Distance';

          const subtitle = document.getElementById('ngoSubtitle');
          if (subtitle) subtitle.textContent = 'NGOs sorted by distance from your current location.';

          loadNgoPartners();
        },
        () => {
          alert('Unable to get your location. Please allow location access and try again.');
          nearBtn.disabled  = false;
          nearBtn.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Sort by Distance';
        }
      );
    });
  }

  /* ── Notifications sidebar link ── */
  const sidebarNotif = document.getElementById('notificationsLink');
  if (sidebarNotif) {
    sidebarNotif.addEventListener('click', e => e.preventDefault());
  }

  /* ── Initial data load ── */
  loadNgoPartners();
  loadNotificationsList();
});