'use strict';

// ── Chart instances (destroyed on re-render to avoid canvas reuse errors) ────
let chartBar    = null;
let chartDonut  = null;

// ── Routing ───────────────────────────────────────────────────────────────────

function router() {
  const hash  = location.hash || '#overview';
  const parts = hash.slice(1).split('/');
  const view  = parts[0] || 'overview';
  const id    = parts[1];

  document.querySelectorAll('.nav-link').forEach(a => {
    a.classList.toggle('active', a.dataset.view === view);
  });

  if      (view === 'overview')              renderOverview();
  else if (view === 'leads' && !id)          renderLeads();
  else if (view === 'lead'  && id)           renderLeadDetail(id);
  else                                       renderOverview();
}

window.addEventListener('hashchange', router);
window.addEventListener('load',       router);

// ── API helpers ───────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function cap(s)  { return s ? s[0].toUpperCase() + s.slice(1) : '—'; }
function fmt(s)  { return s || '—'; }
function fmtDate(iso) { return iso ? iso.slice(0, 10) : '—'; }
function fmtMoney(n) {
  if (n == null || n === '') return '—';
  return '£' + Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0 });
}

function tierBadge(tier, lg) {
  return `<span class="badge badge-${tier}${lg ? ' badge-lg' : ''}">${tier.toUpperCase()}</span>`;
}
function statusBadge(status, lg) {
  return `<span class="badge badge-status-${status}${lg ? ' badge-lg' : ''}">${cap(status)}</span>`;
}

// ── Overview ──────────────────────────────────────────────────────────────────

async function renderOverview() {
  setContent('<div class="loading">Loading…</div>');

  const [{ stats, days }, recentLeads] = await Promise.all([
    api('GET', '/api/stats'),
    api('GET', '/api/leads'),
  ]);
  const recent = recentLeads.slice(0, 10);

  setContent(`
    <div class="page-header">
      <h1>Overview</h1>
      <p class="text-muted">Lead tracking and conversion performance</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Leads</div>
        <div class="stat-value">${stats.total}</div>
      </div>
      <div class="stat-card stat-card--vip">
        <div class="stat-label">VIP (£7,500+)</div>
        <div class="stat-value">${stats.vip}</div>
      </div>
      <div class="stat-card stat-card--qualified">
        <div class="stat-label">Qualified</div>
        <div class="stat-value">${stats.qualified}</div>
      </div>
      <div class="stat-card stat-card--unqualified">
        <div class="stat-label">Unqualified</div>
        <div class="stat-value">${stats.unqualified}</div>
      </div>
      <div class="stat-card stat-card--won">
        <div class="stat-label">Won</div>
        <div class="stat-value">${stats.won}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Revenue</div>
        <div class="stat-value">${fmtMoney(stats.revenue)}</div>
      </div>
    </div>

    <div class="charts-row">
      <div class="chart-card">
        <h3>Leads — Last 30 Days</h3>
        <div class="chart-wrap"><canvas id="leadsChart"></canvas></div>
      </div>
      <div class="chart-card">
        <h3>Tier Breakdown</h3>
        <div class="chart-wrap chart-wrap--donut"><canvas id="tierChart"></canvas></div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h3>Recent Leads</h3>
        <a href="#leads" class="btn btn-sm">View All →</a>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Date</th><th>Name</th><th>Tier</th>
            <th>Project</th><th>Budget</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${recent.length === 0
            ? '<tr><td colspan="6" class="empty-state">No leads yet — they\'ll appear here once the chatbot starts capturing them.</td></tr>'
            : recent.map(l => `
              <tr class="clickable-row" onclick="location.hash='#lead/${l.id}'">
                <td class="text-muted">${fmtDate(l.created_at)}</td>
                <td>${fmt(l.name)}</td>
                <td>${tierBadge(l.tier)}</td>
                <td>${fmt(l.project_type)}</td>
                <td>${fmt(l.estimated_value)}</td>
                <td>${statusBadge(l.status)}</td>
              </tr>
            `).join('')
          }
        </tbody>
      </table>
    </div>
  `);

  // Destroy old chart instances before creating new ones
  if (chartBar)   { chartBar.destroy();   chartBar   = null; }
  if (chartDonut) { chartDonut.destroy(); chartDonut = null; }

  chartBar = new Chart(document.getElementById('leadsChart'), {
    type: 'bar',
    data: {
      labels: days.map(d => d.label),
      datasets: [
        { label: 'Unqualified', data: days.map(d => d.unqualified), backgroundColor: '#bdbdbd', stack: 's' },
        { label: 'Qualified',   data: days.map(d => d.qualified),   backgroundColor: '#1565c0', stack: 's' },
        { label: 'VIP',         data: days.map(d => d.vip),         backgroundColor: '#e65100', stack: 's' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'top' } },
      scales: {
        x: { stacked: true, grid: { display: false } },
        y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, precision: 0 } },
      },
    },
  });

  chartDonut = new Chart(document.getElementById('tierChart'), {
    type: 'doughnut',
    data: {
      labels: ['Unqualified', 'Qualified', 'VIP'],
      datasets: [{
        data: [stats.unqualified, stats.qualified, stats.vip],
        backgroundColor: ['#bdbdbd', '#1565c0', '#e65100'],
        borderWidth: 2,
        borderColor: '#fff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: { legend: { position: 'bottom', labels: { padding: 16 } } },
    },
  });
}

// ── Leads list ────────────────────────────────────────────────────────────────

let leadsFilter = { tier: '', status: '' };

async function renderLeads() {
  setContent('<div class="loading">Loading…</div>');

  const params = new URLSearchParams();
  if (leadsFilter.tier)   params.set('tier',   leadsFilter.tier);
  if (leadsFilter.status) params.set('status', leadsFilter.status);

  const leads = await api('GET', '/api/leads' + (params.toString() ? '?' + params : ''));

  setContent(`
    <div class="page-header"><h1>All Leads</h1></div>

    <div class="filter-bar">
      <select class="filter-select" id="filterTier" onchange="applyFilter()">
        <option value="">All Tiers</option>
        <option value="unqualified" ${leadsFilter.tier === 'unqualified' ? 'selected' : ''}>Unqualified</option>
        <option value="qualified"   ${leadsFilter.tier === 'qualified'   ? 'selected' : ''}>Qualified</option>
        <option value="vip"         ${leadsFilter.tier === 'vip'         ? 'selected' : ''}>VIP</option>
      </select>
      <select class="filter-select" id="filterStatus" onchange="applyFilter()">
        <option value="">All Statuses</option>
        <option value="pending"   ${leadsFilter.status === 'pending'   ? 'selected' : ''}>Pending</option>
        <option value="contacted" ${leadsFilter.status === 'contacted' ? 'selected' : ''}>Contacted</option>
        <option value="won"       ${leadsFilter.status === 'won'       ? 'selected' : ''}>Won</option>
        <option value="lost"      ${leadsFilter.status === 'lost'      ? 'selected' : ''}>Lost</option>
        <option value="rejected"  ${leadsFilter.status === 'rejected'  ? 'selected' : ''}>Rejected</option>
      </select>
      ${(leadsFilter.tier || leadsFilter.status)
        ? '<button class="btn btn-secondary" onclick="clearFilter()">Clear</button>' : ''}
      <span class="text-muted filter-count">
        ${leads.length} lead${leads.length !== 1 ? 's' : ''}
      </span>
    </div>

    <div class="card">
      <table class="table">
        <thead>
          <tr>
            <th>#</th><th>Date</th><th>Name</th><th>Phone</th>
            <th>Email</th><th>Tier</th><th>Project</th><th>Budget</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${leads.length === 0
            ? '<tr><td colspan="9" class="empty-state">No leads match the current filter.</td></tr>'
            : leads.map(l => `
              <tr class="clickable-row" onclick="location.hash='#lead/${l.id}'">
                <td class="text-muted">${l.id}</td>
                <td class="text-muted">${fmtDate(l.created_at)}</td>
                <td>${fmt(l.name)}</td>
                <td>${fmt(l.phone)}</td>
                <td>${fmt(l.email)}</td>
                <td>${tierBadge(l.tier)}</td>
                <td>${fmt(l.project_type)}</td>
                <td>${fmt(l.estimated_value)}</td>
                <td>${statusBadge(l.status)}</td>
              </tr>
            `).join('')
          }
        </tbody>
      </table>
    </div>
  `);
}

function applyFilter() {
  leadsFilter.tier   = document.getElementById('filterTier').value;
  leadsFilter.status = document.getElementById('filterStatus').value;
  renderLeads();
}

function clearFilter() {
  leadsFilter = { tier: '', status: '' };
  renderLeads();
}

// ── Lead detail ───────────────────────────────────────────────────────────────

async function renderLeadDetail(id) {
  setContent('<div class="loading">Loading…</div>');

  const { lead, conversions } = await api('GET', `/api/leads/${id}`);

  setContent(`
    <div class="page-header">
      <a href="#leads" class="back-link">← All Leads</a>
      <div class="page-header-row">
        <h1>Lead #${lead.id}</h1>
        ${tierBadge(lead.tier, true)}
        ${statusBadge(lead.status, true)}
      </div>
      <p class="text-muted">Added ${lead.created_at.slice(0, 16).replace('T', ' ')}</p>
    </div>

    <div class="detail-grid">

      <div class="card">
        <div class="card-header"><h3>Contact Details</h3></div>
        <dl class="detail-list">
          <dt>Name</dt>         <dd>${fmt(lead.name)}</dd>
          <dt>Phone</dt>        <dd>${lead.phone  ? `<a href="tel:${lead.phone}">${lead.phone}</a>` : '—'}</dd>
          <dt>Email</dt>        <dd>${lead.email  ? `<a href="mailto:${lead.email}">${lead.email}</a>` : '—'}</dd>
          <dt>Project Type</dt> <dd>${fmt(lead.project_type)}</dd>
          <dt>Budget</dt>       <dd>${fmt(lead.estimated_value)}</dd>
          <dt>Source</dt>       <dd>${fmt(lead.source)}${lead.lead_source_detail ? ` — <span class="text-muted">${lead.lead_source_detail}</span>` : ''}</dd>
        </dl>
        <div class="status-update-form">
          <h4>Update Status</h4>
          <div class="inline-form">
            <select class="filter-select" id="statusSelect">
              ${['pending','contacted','won','lost','rejected']
                .map(s => `<option value="${s}" ${lead.status === s ? 'selected' : ''}>${cap(s)}</option>`)
                .join('')}
            </select>
            <button class="btn" onclick="updateStatus(${lead.id})">Save</button>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3>Log Conversion</h3></div>
        <div class="conversion-form">
          <div class="form-group">
            <label>Outcome</label>
            <select class="filter-select" id="convOutcome">
              <option value="">Select outcome…</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>
          <div class="form-group">
            <label>Revenue (£)</label>
            <input type="number" id="convRevenue" class="form-input" placeholder="e.g. 8500" step="0.01" min="0">
          </div>
          <div class="form-group">
            <label>Close Date</label>
            <input type="date" id="convDate" class="form-input">
          </div>
          <div class="form-group">
            <label>Notes</label>
            <textarea id="convNotes" class="form-input" rows="3" placeholder="Reason won/lost, any follow-up notes…"></textarea>
          </div>
          <button class="btn" onclick="logConversion(${lead.id})">Log Conversion</button>
        </div>

        ${conversions.length > 0 ? `
          <div class="conversion-history">
            <h4>Conversion History</h4>
            ${conversions.map(c => `
              <div class="conversion-entry">
                <div class="conversion-entry-top">
                  ${statusBadge(c.outcome)}
                  ${c.revenue != null ? `<strong>${fmtMoney(c.revenue)}</strong>` : ''}
                  ${c.close_date ? `<span class="text-muted">${c.close_date}</span>` : ''}
                </div>
                ${c.notes ? `<p class="text-muted conversion-notes">${c.notes}</p>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>

    </div>
  `);
}

async function updateStatus(id) {
  const status = document.getElementById('statusSelect').value;
  await api('PUT', `/api/leads/${id}`, { status });
  renderLeadDetail(id);
}

async function logConversion(id) {
  const outcome    = document.getElementById('convOutcome').value;
  if (!outcome) { alert('Please select an outcome (Won or Lost).'); return; }
  const revenue    = document.getElementById('convRevenue').value;
  const close_date = document.getElementById('convDate').value;
  const notes      = document.getElementById('convNotes').value;
  await api('POST', `/api/leads/${id}/convert`, {
    outcome,
    revenue:    revenue    || null,
    close_date: close_date || null,
    notes,
  });
  renderLeadDetail(id);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setContent(html) {
  document.getElementById('app').innerHTML = html;
}
