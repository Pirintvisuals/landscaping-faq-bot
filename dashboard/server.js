'use strict';

const express = require('express');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const app      = express();
const DB_PATH  = path.join(process.env.DATA_DIR || __dirname, 'leads.json');
const API_KEY  = process.env.DASHBOARD_API_KEY || 'dev-key-change-me';
const PORT     = parseInt(process.env.PORT || '5000', 10);

// ─── JSON file storage ───────────────────────────────────────────────────────

function loadDB() {
  if (!fs.existsSync(DB_PATH)) {
    return { leads: [], conversions: [], nextLeadId: 1, nextConversionId: 1 };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch {
    return { leads: [], conversions: [], nextLeadId: 1, nextConversionId: 1 };
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Only POST /api/leads (called by the chatbot) requires the API key.
// All other endpoints are open since the dashboard runs on localhost.
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;
  if (key !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// ─── API — chatbot-facing ─────────────────────────────────────────────────────

// POST /api/leads — called by api/chat.js whenever a lead is qualified or rejected
app.post('/api/leads', requireApiKey, (req, res) => {
  const data = req.body || {};
  const db   = loadDB();

  let tier = data.tier || 'unqualified';
  if (!['unqualified', 'qualified', 'vip'].includes(tier)) tier = 'unqualified';

  const client_id = data.client_id || crypto.randomUUID();

  // Dedup — same conversation should not create two records
  const existing = db.leads.find(l => l.client_id === client_id);
  if (existing) {
    return res.json({ success: true, lead_id: existing.id, client_id });
  }

  const lead = {
    id:                 db.nextLeadId++,
    client_id,
    name:               data.name               || '',
    email:              data.email              || '',
    phone:              data.phone              || '',
    tier,
    project_type:       data.project_type       || '',
    estimated_value:    data.estimated_value    || '',
    source:             data.source             || 'chatbot',
    lead_source_detail: data.lead_source_detail || '',
    created_at:         new Date().toISOString(),
    status:             data.status || (tier === 'unqualified' ? 'rejected' : 'pending'),
  };

  db.leads.push(lead);
  saveDB(db);
  res.status(201).json({ success: true, lead_id: lead.id, client_id });
});

// ─── API — dashboard UI facing ────────────────────────────────────────────────

// GET /api/stats — overview numbers + 30-day chart data
app.get('/api/stats', (req, res) => {
  const db          = loadDB();
  const leads       = db.leads;
  const conversions = db.conversions;

  const stats = {
    total:     leads.length,
    qualified: leads.filter(l => l.tier === 'qualified').length,
    vip:       leads.filter(l => l.tier === 'vip').length,
    unqualified: leads.filter(l => l.tier === 'unqualified').length,
    won:       leads.filter(l => l.status === 'won').length,
    lost:      leads.filter(l => l.status === 'lost').length,
    pending:   leads.filter(l => l.status === 'pending').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    revenue:   conversions
      .filter(c => c.outcome === 'won' && c.revenue)
      .reduce((sum, c) => sum + c.revenue, 0),
  };

  // Build last-30-days series (fills in gaps with zeros)
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d   = new Date();
    d.setDate(d.getDate() - i);
    const day = d.toISOString().slice(0, 10);
    const dl  = leads.filter(l => l.created_at.slice(0, 10) === day);
    days.push({
      label:       day.slice(5),           // "MM-DD"
      unqualified: dl.filter(l => l.tier === 'unqualified').length,
      qualified:   dl.filter(l => l.tier === 'qualified').length,
      vip:         dl.filter(l => l.tier === 'vip').length,
    });
  }

  res.json({ stats, days });
});

// GET /api/leads — list, optionally filtered
app.get('/api/leads', (req, res) => {
  const db = loadDB();
  let leads = [...db.leads].reverse(); // newest first
  if (req.query.tier)   leads = leads.filter(l => l.tier   === req.query.tier);
  if (req.query.status) leads = leads.filter(l => l.status === req.query.status);
  res.json(leads);
});

// GET /api/leads/:id — single lead + its conversions
app.get('/api/leads/:id', (req, res) => {
  const db   = loadDB();
  const lead = db.leads.find(l => l.id === parseInt(req.params.id, 10));
  if (!lead) return res.status(404).json({ error: 'Not found' });
  const conversions = db.conversions
    .filter(c => c.lead_id === lead.id)
    .reverse();
  res.json({ lead, conversions });
});

// PUT /api/leads/:id — update fields (status, name, etc.)
app.put('/api/leads/:id', (req, res) => {
  const db   = loadDB();
  const lead = db.leads.find(l => l.id === parseInt(req.params.id, 10));
  if (!lead) return res.status(404).json({ error: 'Not found' });
  const allowed = ['status', 'name', 'email', 'phone', 'tier', 'project_type', 'estimated_value'];
  for (const key of allowed) {
    if (key in req.body) lead[key] = req.body[key];
  }
  saveDB(db);
  res.json({ success: true });
});

// POST /api/leads/:id/convert — log a won/lost conversion
app.post('/api/leads/:id/convert', (req, res) => {
  const db   = loadDB();
  const lead = db.leads.find(l => l.id === parseInt(req.params.id, 10));
  if (!lead) return res.status(404).json({ error: 'Not found' });

  const { outcome, revenue, close_date, notes } = req.body;
  if (!['won', 'lost'].includes(outcome)) {
    return res.status(400).json({ error: 'outcome must be "won" or "lost"' });
  }

  const conversion = {
    id:         db.nextConversionId++,
    lead_id:    lead.id,
    outcome,
    revenue:    revenue ? parseFloat(revenue) : null,
    close_date: close_date || null,
    notes:      notes || '',
    created_at: new Date().toISOString(),
  };

  db.conversions.push(conversion);
  lead.status = outcome;
  saveDB(db);
  res.status(201).json({ success: true });
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🌿 Landscale Dashboard → http://localhost:${PORT}\n`);
  console.log(`   API key in use: ${API_KEY === 'dev-key-change-me' ? '(default — set DASHBOARD_API_KEY to change)' : '(custom key set)'}`);
});
