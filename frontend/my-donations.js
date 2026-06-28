/**
 * FoodLink AI - My Donations Page Logic
 * Paginated, filterable donation history.
 * Depends on script.js being loaded first (provides apiCall, getToken, openDonationModal).
 */

let currentPage = 1;
let currentStatus = 'all';
const PAGE_SIZE = 10;

async function loadDonationsPage(page = 1, status = 'all') {
  const tbody = document.getElementById('allDonationsTableBody');
  const summary = document.getElementById('resultsSummary');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">Loading...</td></tr>';

  try {
    const query = `?page=${page}&limit=${PAGE_SIZE}&status=${status}`;
    const data = await apiCall(`/donations/my${query}`);
    window.latestDonations = data.donations || [];

    if (!data.donations || data.donations.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);">No donations found for this filter. <a href="donate.html" style="color:var(--primary)">Make a donation!</a></td></tr>';
      renderPagination(data.pagination);
      if (summary) summary.textContent = '';
      return;
    }

    const statusBadge = {
      pending: 'badge-pending',
      matched: 'badge-matched',
      in_transit: 'badge-matched',
      completed: 'badge-completed',
      cancelled: 'badge-pending',
    };

    tbody.innerHTML = data.donations.map((d) => `
      <tr>
        <td>#FL-${d.id}</td>
        <td>${d.quantity}x ${d.food_type}</td>
        <td><strong>${d.ngo_name || 'Finding match...'}</strong></td>
        <td>${d.distance_km != null ? Number(d.distance_km).toFixed(1) + ' km' : '—'}</td>
        <td><span class="badge ${statusBadge[d.status] || 'badge-pending'}">${d.status.replace('_', ' ')}</span></td>
        <td>${new Date(d.created_at).toLocaleDateString()}</td>
        <td><a href="#" class="view-donation-btn" data-id="${d.id}" style="color:var(--primary);font-weight:500;">View</a></td>
      </tr>
    `).join('');

    document.querySelectorAll('.view-donation-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openDonationModal(parseInt(btn.dataset.id));
      });
    });

    if (summary && data.pagination) {
      const { total, page: p, limit } = data.pagination;
      const start = (p - 1) * limit + 1;
      const end = Math.min(p * limit, total);
      summary.textContent = `Showing ${start}-${end} of ${total}`;
    }

    renderPagination(data.pagination);
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:red;">Failed to load donations. Please login.</td></tr>';
  }
}

function renderPagination(pagination) {
  const container = document.getElementById('paginationControls');
  if (!container || !pagination) return;

  const { page, totalPages } = pagination;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <button id="prevPageBtn" class="btn btn-outline" ${page <= 1 ? 'disabled' : ''} style="padding: 0.5rem 1rem;">
      <i class="fa-solid fa-chevron-left"></i> Prev
    </button>
    <span style="color: var(--text-muted);">Page ${page} of ${totalPages}</span>
    <button id="nextPageBtn" class="btn btn-outline" ${page >= totalPages ? 'disabled' : ''} style="padding: 0.5rem 1rem;">
      Next <i class="fa-solid fa-chevron-right"></i>
    </button>
  `;

  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  if (prevBtn) prevBtn.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadDonationsPage(currentPage, currentStatus);
    }
  });

  if (nextBtn) nextBtn.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      loadDonationsPage(currentPage, currentStatus);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadDonationsPage(currentPage, currentStatus);

  const statusFilter = document.getElementById('statusFilter');
  if (statusFilter) {
    statusFilter.addEventListener('change', () => {
      currentStatus = statusFilter.value;
      currentPage = 1;
      loadDonationsPage(currentPage, currentStatus);
    });
  }

  const modalOverlay = document.getElementById('donationModalOverlay');
  const closeModalBtn = document.getElementById('closeDonationModal');
  if (modalOverlay && closeModalBtn) {
    closeModalBtn.addEventListener('click', () => { modalOverlay.style.display = 'none'; });
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) modalOverlay.style.display = 'none';
    });
  }
});
