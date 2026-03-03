'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini model ID — verify against https://ai.google.dev/gemini-api/docs/models
const MODEL_ID = 'gemini-2.5-flash';

function postcodeArea(postcode) {
  return (postcode || '').trim().split(' ')[0] || postcode || 'your area';
}

function buildSystemPrompt() {
  return `You are the Landscale Digital Assistant, representing Milán and Landscale Agency — a professional landscaping and garden construction company based in the UK.

PERSONA & TONE:
- Write exclusively in British English (e.g. "colour", "specialise", "organise", "whilst", "brilliant", "sorted")
- Tone: professional, direct, knowledgeable, and slightly dry
- You are a Digital Gatekeeper — demonstrate genuine expertise whilst efficiently qualifying garden project enquiries for Milán

BUSINESS INFORMATION — use this to answer customer questions accurately:
- Service area: High Wycombe and surrounding areas within 15 miles
- Experience: Established 10 years ago, trusted local company
- Team: 5 experienced landscapers
- Insurance: Fully insured with public liability coverage
- Materials: Premium suppliers — Indian sandstone, porcelain, natural stone for patios; composite and timber decking; quality turf and plants
- Services: Hard landscaping (patios, paths, walls, drainage), Soft landscaping (planting, turf, raised beds), Timber (decking, pergolas, fencing), Maintenance
- Lead time: Projects typically start within 3 weeks; free site visits available within 5 days
- Working hours: Monday–Friday, 8am–5pm
- Process: Free detailed quote after site visit; small deposit to secure booking, then staged payments

HOW TO RESPOND — follow this pattern on every message:
1. If the customer asks a question, answer it directly using the business information above.
2. After answering, smoothly transition back to the next qualification question you still need.
3. If the customer volunteers info alongside a question, capture it and move on.

QUALIFICATION — collect in this exact order, one at a time:
1. Postcode
2. Project scope — which category: Hard landscaping (patios, paths, walls, drainage), Soft landscaping (planting, turf, raised beds), Timber (decking, pergolas, fencing), or Maintenance
3. Timeline — ask: "When are you looking to start this project?" — when asking this, set "quickReplies" to the four options below
4. Budget — critical for tier determination
5. Then proceed per the budget tier rules below

BUDGET TIERS — strictly enforce:

TIER 1 — REJECT (under £2,000):
Say exactly: "Thanks for reaching out! We specialise in comprehensive garden projects starting from £3,000. For smaller tasks, a local gardener or handyman would likely be the better fit. Best of luck with your project!"
Set "tier": "reject", "rejected": true. Do NOT collect any contact details.

TIER 2 — BARELY QUALIFIED (£2,000–£2,999):
Say exactly: "We typically focus on projects £3,000 and above, as that's where we can deliver the full Landscale experience — proper materials, expert craftsmanship, and lasting results. That said, project scopes can evolve. Would you like me to send over some information on what's possible at different budget levels?"
Set "tier": "barelyQualified". Wait for their yes/no.
- If YES: Ask for full name, then email. Once both collected, populate lead and set "tier": "barelyQualified". Do NOT ask for phone or photos.
- If NO: Say something brief and polite. Set "tier": "barelyQualified", "lead": null.

TIER 3 — GOOD LEAD (£3,000–£7,499):
Say: "Brilliant — that budget works well for a quality [project type]. We've done dozens of similar projects around [postcode area]. Let me get you connected with Milán's team. What's the best email to send you our availability?"
Set "tier": "good". Collect in order: email, full name, phone.
Once all three collected, set lead, say: "Brilliant. Because your project fits our expertise perfectly, I've been authorised to fast-track this — I'm sending your details directly to Milán now so he can review it today." Set "tier": "good". Do NOT ask about photos.

TIER 4 — HOT LEAD (£7,500+):
Say: "Excellent — this sounds like an exciting project! With a budget like that, we can really create something special. Let's get you on Milán's calendar as a priority. What's the best email to reach you?"
Set "tier": "hot". Collect in order: email, full name, phone.
Once all three collected, set lead, set "showCalendar": true, say the same fast-track message as Tier 3. Set "tier": "hot", "priority": true. Do NOT ask about photos.

PRICING RULE: NEVER quote day rates, hourly rates, or cost per square metre. Redirect to Cost Estimator: https://landscaletemplate.framer.website/#quoter

EXPERTISE HOOKS — answer with genuine depth:
- Clay soil / drainage: French drains, land drainage systems, aggregate depths, correct fall
- Nesting birds: Wildlife & Countryside Act 1981 — work must pause for active nesting birds
- Decking substrates: Joist spacing, weed membrane, ventilation gaps to prevent rot
- Patio drainage: Minimum 1:80 gradient; SUDS compliance for larger impermeable areas
- Fencing: Party Wall Act, neighbour consent on boundary structures

LEAD OBJECT RULES:
Only populate "lead" when all required fields are collected:
- Barely Qualified: name, email (no phone required)
- Good/Hot: name, email, phone
All tiers also need: postcode, budget, scope collected earlier in conversation.
Include "timeline" in lead whenever it has been collected.
Set "priority": true only for hot tier.

OUTPUT FORMAT — ALWAYS respond with valid JSON only. Never include text outside the JSON. Never use markdown code fences.

When asking the timeline question:
{
  "message": "When are you looking to start this project?",
  "lead": null,
  "rejected": false,
  "tier": null,
  "quickReplies": ["ASAP (1-4 weeks)", "This season (1-3 months)", "Planning ahead (3-6 months)", "Just exploring ideas"],
  "showCalendar": false
}

Normal in-progress (qualification not yet complete):
{
  "message": "Your conversational response",
  "lead": null,
  "rejected": false,
  "tier": null,
  "quickReplies": null,
  "showCalendar": false
}

Good/Hot lead complete:
{
  "message": "Fast-track confirmation message",
  "lead": {
    "name": "Full name",
    "email": "email@example.com",
    "phone": "Phone number",
    "postcode": "Postcode",
    "budget": "Budget as stated",
    "scope": "Project scope summary",
    "timeline": "ASAP (1-4 weeks)",
    "notes": "Any other details",
    "priority": false
  },
  "rejected": false,
  "tier": "good",
  "quickReplies": null,
  "showCalendar": false
}

Barely qualified lead with name + email collected:
{
  "message": "Thanks [name], I'll send that over to you now.",
  "lead": {
    "name": "Full name",
    "email": "email@example.com",
    "phone": "",
    "postcode": "Postcode",
    "budget": "Budget as stated",
    "scope": "Project scope summary",
    "timeline": "Their timeline choice",
    "notes": "",
    "priority": false
  },
  "rejected": false,
  "tier": "barelyQualified",
  "quickReplies": null,
  "showCalendar": false
}

Rejection (under £2,000):
{
  "message": "Thanks for reaching out! We specialise in comprehensive garden projects...",
  "lead": null,
  "rejected": true,
  "tier": "reject",
  "quickReplies": null,
  "showCalendar": false
}`;
}

function extractJSON(text) {
  // Direct parse
  try { return JSON.parse(text); } catch {}
  // Strip markdown code fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) { try { return JSON.parse(fenced[1]); } catch {} }
  // Grab first {...} block
  const block = text.match(/\{[\s\S]*\}/);
  if (block) { try { return JSON.parse(block[0]); } catch {} }
  return null;
}

async function logLeadToDashboard(payload) {
  const dashboardUrl = process.env.DASHBOARD_URL;
  if (!dashboardUrl) return;
  try {
    await fetch(`${dashboardUrl}/api/leads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': process.env.DASHBOARD_API_KEY || 'dev-key-change-me',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    console.error('Dashboard log error:', err.message);
  }
}

async function scheduleFollowUps(lead, tier) {
  const token  = process.env.QSTASH_TOKEN;
  const secret = process.env.FOLLOWUP_SECRET;
  const appUrl = (process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '').replace(/\/$/, '');

  if (!token || !secret || !appUrl || !lead.email) return;

  const dest = encodeURIComponent(`${appUrl}/api/followup`);
  // Email #1 is sent directly — only schedule #2 (48h) and #3 (120h)
  const delays = ['172800s', '432000s'];

  const payload = {
    secret,
    name:          lead.name,
    email:         lead.email,
    projectType:   lead.scope,
    timeline:      lead.timeline || '',
    tier,
    estimatorLink: process.env.ESTIMATOR_LINK || 'https://landscaletemplate.framer.website/#quoter',
    calendlyLink:  process.env.CALENDLY_LINK  || '',
    ownerPhone:    process.env.OWNER_PHONE    || '',
    ownerWebsite:  process.env.OWNER_WEBSITE  || '',
    ownerName:     process.env.OWNER_NAME     || 'Milán',
  };

  await Promise.all(
    delays.map((delay, i) =>
      fetch(`https://qstash.upstash.io/v2/publish/${dest}`, {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type':  'application/json',
          'Upstash-Delay': delay,
        },
        body: JSON.stringify({ ...payload, followupNumber: i + 2 }),
      }).catch(err => console.error(`QStash schedule error (followup ${i + 2}):`, err.message))
    )
  );
}

// ── Owner notification email ───────────────────────────────────────────────────

function buildOwnerEmailHtml(lead) {
  const { name, email, phone, postcode, budget, scope, timeline, notes, priority } = lead;
  const priorityBanner = priority
    ? `<div style="background:#c0392b;color:#fff;padding:16px;font-size:18px;font-weight:bold;text-align:center;border-radius:6px;margin-bottom:24px;">&#x1F6A8; HIGH-VALUE PRIORITY LEAD &#x1F6A8;</div>`
    : '';
  const row = (label, value, href) =>
    `<tr>
      <td style="padding:10px 14px;font-weight:600;background:#f4f7f4;color:#1a2e1a;width:120px;border-bottom:1px solid #e0e8e0;">${label}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e0e8e0;">${href ? `<a href="${href}" style="color:#1e4620;">${value}</a>` : value}</td>
    </tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>New Landscale Lead</title></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f4f0;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#1e4620;padding:20px 24px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">&#x1F33F; New Landscale Lead</h1>
    </div>
    <div style="padding:24px;">
      ${priorityBanner}
      <table style="width:100%;border-collapse:collapse;border:1px solid #e0e8e0;border-radius:6px;overflow:hidden;">
        ${row('Client', name)}
        ${row('Email', email, `mailto:${email}`)}
        ${row('Phone', phone, `tel:${phone}`)}
        ${row('Location', postcode)}
        ${row('Budget', budget)}
        ${timeline ? row('Timeline', timeline) : ''}
        ${row('Scope', scope)}
        ${notes ? row('Notes', notes) : ''}
      </table>
    </div>
  </div>
</body>
</html>`;
}

function buildOwnerEmailText(lead) {
  const { name, email, phone, postcode, budget, scope, timeline, notes, priority } = lead;
  const banner = priority ? '*** HIGH-VALUE PRIORITY LEAD ***\n\n' : '';
  return `${banner}New Landscale Lead\n${'='.repeat(40)}\n\nClient:   ${name}\nEmail:    ${email}\nPhone:    ${phone}\nLocation: ${postcode}\nBudget:   ${budget}${timeline ? `\nTimeline: ${timeline}` : ''}\nScope:    ${scope}${notes ? `\nNotes:    ${notes}` : ''}`;
}

// ── Lead Email #1 (sent directly to the lead) ─────────────────────────────────

function buildLeadEmail1(lead) {
  const { name, email, scope, budget, timeline, postcode } = lead;
  const n  = name || 'there';
  const pt = scope || 'garden project';
  const cl = process.env.CALENDLY_LINK || '';
  const ph = process.env.OWNER_PHONE   || '';
  const ws = process.env.OWNER_WEBSITE || '';
  const area = postcodeArea(postcode);

  const subject = `Your ${pt} in ${area} - Next Steps`;

  const text =
`Hi ${n},

Thanks for chatting with our Digital Assistant about your ${pt}!

Just to recap what you're after:
- Project: ${pt}
- Budget: ${budget}${timeline ? `\n- Timeline: ${timeline}` : ''}
- Location: ${postcode}

This is exactly the kind of work we love doing.

Here's what happens next: pick a time for a free site visit so Milán can see the space, talk through your vision, and give you an accurate quote.

👉 Book your site visit: ${cl || '[Calendar link coming soon]'}

Already booked? Perfect — ignore this and we'll see you soon.

Or if you'd prefer, just reply to this email or call us on ${ph || 'our office number'}.

You can see more of our work at ${ws || 'our website'}.

Speak soon,
Landscale Digital Assistant`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Your ${pt} - Next Steps</title></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f4f0;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#1e4620;padding:20px 24px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">&#x1F33F; Your ${pt} in ${area} — Next Steps</h1>
    </div>
    <div style="padding:24px;color:#1a2a1a;line-height:1.6;">
      <p>Hi ${n},</p>
      <p>Thanks for chatting with our Digital Assistant about your ${pt}!</p>
      <p><strong>Just to recap what you're after:</strong></p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e0e8e0;border-radius:6px;overflow:hidden;margin-bottom:20px;">
        <tr><td style="padding:9px 14px;font-weight:600;background:#f4f7f4;width:110px;border-bottom:1px solid #e0e8e0;">Project</td><td style="padding:9px 14px;border-bottom:1px solid #e0e8e0;">${pt}</td></tr>
        <tr><td style="padding:9px 14px;font-weight:600;background:#f4f7f4;border-bottom:1px solid #e0e8e0;">Budget</td><td style="padding:9px 14px;border-bottom:1px solid #e0e8e0;">${budget}</td></tr>
        ${timeline ? `<tr><td style="padding:9px 14px;font-weight:600;background:#f4f7f4;border-bottom:1px solid #e0e8e0;">Timeline</td><td style="padding:9px 14px;border-bottom:1px solid #e0e8e0;">${timeline}</td></tr>` : ''}
        <tr><td style="padding:9px 14px;font-weight:600;background:#f4f7f4;">Location</td><td style="padding:9px 14px;">${postcode}</td></tr>
      </table>
      <p>This is exactly the kind of work we love doing.</p>
      <p>Here's what happens next: pick a time for a free site visit so Milán can see the space, talk through your vision, and give you an accurate quote.</p>
      ${cl ? `<p style="text-align:center;margin:24px 0;"><a href="${cl}" style="background:#1e4620;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">&#x1F4C5; Book your free site visit</a></p>` : ''}
      <p style="font-size:13px;color:#666;">Already booked? Perfect — ignore this and we'll see you soon.<br>Or call us on <strong>${ph || 'our office number'}</strong> if you'd prefer to chat.</p>
      ${ws ? `<p style="font-size:13px;color:#666;">See more of our work at <a href="${ws}" style="color:#1e4620;">${ws}</a></p>` : ''}
      <p>Speak soon,<br><strong>Landscale Digital Assistant</strong></p>
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

// ── Barely Qualified email ─────────────────────────────────────────────────────

function buildBarelyQualifiedEmail(lead) {
  const { name, budget, scope } = lead;
  const n  = name || 'there';
  const pt = scope || 'garden project';
  const ph = process.env.OWNER_PHONE   || '';
  const ws = process.env.OWNER_WEBSITE || '';

  const subject = `What £3k+ actually gets you (and why it matters)`;

  const text =
`Hi ${n},

You mentioned a budget around ${budget} for your ${pt}.

I get it — you're trying to figure out what's realistic. Here's the honest breakdown:

Why we start at £3k: Our projects include quality materials that last (not the cheap stuff that cracks in 2 years), proper groundwork (the part you don't see but makes all the difference), and expert installation by trained professionals.

What's possible at different budgets:
- £2k–£3k: Usually only covers very small areas or basic fixes
- £3k–£5k: Small-to-medium patio, simple decking, quality fencing
- £5k–£10k: Larger patios, composite decking, full garden sections
- £10k+: Complete garden transformations

If your project scope or budget changes, we'd love to help.${ws ? ` You can see examples of our work at ${ws}` : ''}${ph ? ` or give us a call on ${ph}` : ''}.

Good luck with the project,
Landscale`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>What £3k+ gets you</title></head>
<body style="margin:0;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f0f4f0;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#1e4620;padding:20px 24px;">
      <h1 style="color:#fff;margin:0;font-size:20px;">&#x1F33F; What £3k+ actually gets you</h1>
    </div>
    <div style="padding:24px;color:#1a2a1a;line-height:1.6;">
      <p>Hi ${n},</p>
      <p>You mentioned a budget around <strong>${budget}</strong> for your ${pt}. I get it — you're trying to figure out what's realistic. Here's the honest breakdown:</p>
      <p><strong>Why we start at £3k:</strong> Our projects include quality materials that last (not the cheap stuff that cracks in 2 years), proper groundwork (the part you don't see but makes all the difference), and expert installation by trained professionals.</p>
      <p><strong>What's possible at different budgets:</strong></p>
      <ul style="padding-left:20px;">
        <li><strong>£2k–£3k:</strong> Usually only covers very small areas or basic fixes</li>
        <li><strong>£3k–£5k:</strong> Small-to-medium patio, simple decking, quality fencing</li>
        <li><strong>£5k–£10k:</strong> Larger patios, composite decking, full garden sections</li>
        <li><strong>£10k+:</strong> Complete garden transformations</li>
      </ul>
      <p>If your project scope or budget changes, we'd love to help.${ws ? ` See examples of our work at <a href="${ws}" style="color:#1e4620;">${ws}</a>` : ''}${ph ? ` or call us on <strong>${ph}</strong>` : ''}.</p>
      <p>Good luck with the project,<br><strong>Landscale</strong></p>
    </div>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const {
      message,
      history = [],
      leadAlreadySent    = false,
      rejectedLogSent    = false,
      barelyQualifiedSent = false,
    } = req.body;
    if (!message) return res.status(400).json({ error: 'message is required' });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: MODEL_ID,
      systemInstruction: buildSystemPrompt(),
      generationConfig: { responseMimeType: 'application/json' },
    });

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(message);
    const rawText = result.response.text();

    const parsed = extractJSON(rawText);
    if (!parsed) {
      return res.status(200).json({
        reply: "Apologies — I've hit a snag. Could you try rephrasing that?",
        rawResponse: rawText,
      });
    }

    const reply = parsed.message || "Apologies, something went wrong. Please try again.";
    const tier  = parsed.tier || null;

    // ── Hard reject (under £2k) ────────────────────────────────────────────────
    if (parsed.rejected === true && !rejectedLogSent) {
      logLeadToDashboard({ tier: 'unqualified', source: 'chatbot', status: 'rejected' }).catch(() => {});
      return res.status(200).json({ reply, rawResponse: rawText, rejectionLogged: true, conversationEnded: true });
    }

    // ── Barely qualified — send info email ────────────────────────────────────
    const lead = parsed.lead;
    const barelyQualifiedComplete = lead &&
      tier === 'barelyQualified' &&
      lead.name?.trim() && lead.email?.trim();

    if (barelyQualifiedComplete && !barelyQualifiedSent) {
      logLeadToDashboard({
        tier: 'barely_qualified',
        name: lead.name,
        email: lead.email,
        project_type: lead.scope,
        estimated_value: lead.budget,
        timeline: lead.timeline || '',
        source: 'chatbot',
        lead_source_detail: lead.postcode ? `postcode:${lead.postcode}` : '',
        status: 'rejected',
      }).catch(() => {});

      try {
        const { subject, text, html } = buildBarelyQualifiedEmail(lead);
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || 'Landscale Bot <onboarding@resend.dev>',
            to: [lead.email],
            subject,
            html,
            text,
          }),
        });
        if (!resendRes.ok) throw new Error(`Resend ${resendRes.status}`);
      } catch (err) {
        console.error('Barely qualified email error:', err.message);
      }

      return res.status(200).json({ reply, rawResponse: rawText, barelyQualifiedSent: true, conversationEnded: true });
    }

    // ── Good / Hot lead — send emails + schedule follow-ups ───────────────────
    const leadIsComplete = lead &&
      lead.name?.trim()     && lead.email?.trim() && lead.phone?.trim() &&
      lead.postcode?.trim() && lead.budget?.trim();

    if (leadIsComplete && !leadAlreadySent) {
      const isHot = tier === 'hot' || lead.priority === true;
      const dashboardTier = isHot ? 'hot' : 'good';
      const now = new Date().toISOString();

      // Log to dashboard
      logLeadToDashboard({
        tier: dashboardTier,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        project_type: lead.scope,
        estimated_value: lead.budget,
        timeline: lead.timeline || '',
        source: 'chatbot',
        lead_source_detail: lead.postcode ? `postcode:${lead.postcode}` : '',
        status: 'pending',
        email_1_sent: true,
        email_1_sent_date: now,
        email_2_sent: false,
        email_3_sent: false,
      }).catch(() => {});

      // Send Email #1 to lead
      try {
        const { subject: s1, text: t1, html: h1 } = buildLeadEmail1(lead);
        const r1 = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || 'Landscale Bot <onboarding@resend.dev>',
            to: [lead.email],
            subject: s1,
            html: h1,
            text: t1,
          }),
        });
        if (!r1.ok) throw new Error(`Resend ${r1.status}`);
      } catch (err) {
        console.error('Lead email #1 error:', err.message);
      }

      // Send owner notification
      try {
        const priorityPrefix = isHot ? '[PRIORITY] ' : '';
        const { name, postcode, budget } = lead;
        const ownerSubject = `${priorityPrefix}[NEW LEAD] ${postcode} - ${name} - ${budget}`;
        const rOwner = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || 'Landscale Bot <onboarding@resend.dev>',
            to: [process.env.OWNER_EMAIL],
            subject: ownerSubject,
            html: buildOwnerEmailHtml(lead),
            text: buildOwnerEmailText(lead),
          }),
        });
        if (!rOwner.ok) throw new Error(`Resend owner ${rOwner.status}`);
      } catch (err) {
        console.error('Owner notification error:', err.message);
      }

      // Schedule follow-ups #2 and #3 via QStash
      await scheduleFollowUps(lead, dashboardTier);

      // Pass Calendly URL to widget if hot lead
      const showCalendar = (parsed.showCalendar || isHot)
        ? (process.env.CALENDLY_LINK || null)
        : null;

      return res.status(200).json({ reply, rawResponse: rawText, leadSent: true, conversationEnded: true, showCalendar });
    }

    return res.status(200).json({ reply, rawResponse: rawText, quickReplies: parsed.quickReplies || null });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
