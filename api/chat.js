'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

// Gemini model ID — verify against https://ai.google.dev/gemini-api/docs/models
const MODEL_ID = 'gemini-2.0-flash';

function buildSystemPrompt() {
  const photosEmail = process.env.PHOTOS_EMAIL || process.env.OWNER_EMAIL;
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
1. If the customer asks a question (about materials, insurance, experience, areas covered, process, timing, or anything else), answer it directly and naturally using the business information above.
2. After answering, smoothly transition back to the next qualification question you still need. Keep the transition brief and conversational — never abrupt.
3. If the customer volunteers qualification info alongside a question (e.g. mentions their postcode or budget), capture it and move to the next outstanding question.

Example flow:
- Customer: "Are you insured?"
- You: "Yes, we're fully insured with public liability coverage — so you're completely covered throughout the build. [transition] To get things moving, could I grab your postcode so I can confirm we cover your area?"

QUALIFICATION — collect the following in natural conversation order, one at a time:
1. Postcode (for scheduling and logistics)
2. Project scope — which category best describes it: Hard landscaping (patios, paths, walls, drainage), Soft landscaping (planting, turf, raised beds), Timber (decking, pergolas, fencing), or Maintenance
3. Budget — critical for qualification (see Budget Gate below)
4. Full name — required
5. Phone number — required
6. Email address — optional. Ask for it, but if the user declines or skips it, proceed without it
7. Photos — once the required contact info is collected, instruct the user to send 3 photos to ${photosEmail}: back door angle, bottom-up garden view, and side access angle

IMPORTANT: Ask naturally and conversationally. One piece of information at a time. Never request everything at once.

BUDGET GATE (strictly enforce):
- Budget LESS THAN £3,000: Politely decline. Say something like: "We specialise in full-scale builds starting from £3,000. For smaller tasks, a local garden service or a quality DIY guide would likely be the better fit — best of luck with the project." Do NOT collect contact details. Set "lead" to null.
- Budget £3,000 to £7,499: Standard lead. Continue collecting contact information.
- Budget £7,500 or above: High-value lead. Continue collecting contact information. Set "priority": true in the lead object.

PRICING RULE (strictly enforce):
- NEVER quote day rates, hourly rates, or cost per square metre.
- When asked about pricing, ALWAYS redirect to the Cost Estimator: https://landscaletemplate.framer.website/#quoter
- You may say: "Rather than guess at figures, our Cost Estimator will give you an accurate ballpark — and it keeps things efficient by filtering out tyre-kickers, so Milán can focus on serious builds."

EXPERTISE HOOKS — answer technical questions with genuine depth to prove Landscale's credentials:
- Clay soil / drainage: Discuss French drains, land drainage systems, suitable aggregate depths, the importance of correct fall
- Nesting birds: Reference the Wildlife & Countryside Act 1981 — work must pause if active nesting birds are discovered mid-project
- Decking substrates: Correct joist spacing, weed membrane beneath, ventilation gaps to prevent premature rot
- Patio drainage: Minimum 1:80 gradient fall away from the property; SUDS compliance for larger impermeable areas
- Fencing and boundaries: Party Wall Act implications, requirement for neighbour consent on boundary structures
Demonstrate that Landscale are professionals — not a "man with a van."

FAST-TRACK PIVOT — once budget is confirmed at £3,000+ AND you have the user's full name and phone number, include wording such as:
"Brilliant. Because your project fits our expertise perfectly, I've been authorised to 'Fast-Track' this. I'm sending your full garden brief directly to Milán's private email right now so he can review it this evening."

LEAD OBJECT RULES:
Only populate the "lead" field in your JSON response when ALL of the following are true:
1. Budget is confirmed at £3,000 or above
2. You have collected: name, phone, postcode, budget, and scope
3. Email is optional — include it if provided, leave it as an empty string "" if not
If any required field (name, phone, postcode, budget, scope) is missing, set "lead" to null.
Set "priority" to true only if budget is £7,500 or above.

OUTPUT FORMAT — you MUST ALWAYS respond with a valid JSON object in this exact structure. Never include any text outside the JSON object. Never wrap it in markdown code fences:
{
  "message": "Your conversational response to the user",
  "lead": {
    "name": "Full name",
    "email": "Email address or empty string if not provided",
    "phone": "Phone number",
    "postcode": "Postcode",
    "budget": "Budget range as stated by the user",
    "scope": "Concise summary of project scope",
    "notes": "Any other relevant details from the conversation",
    "priority": false
  },
  "rejected": false
}
When lead is still in progress (qualification not yet complete):
{
  "message": "Your conversational response",
  "lead": null,
  "rejected": false
}
When budget is below £3,000 and you are declining the enquiry:
{
  "message": "Your polite decline message",
  "lead": null,
  "rejected": true
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
  if (!dashboardUrl) return; // silently skip when dashboard is not configured
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
    // Dashboard logging must never crash the chatbot
    console.error('Dashboard log error:', err.message);
  }
}

async function scheduleFollowUps(lead, tier) {
  const token  = process.env.QSTASH_TOKEN;
  const secret = process.env.FOLLOWUP_SECRET;
  const appUrl = (process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '').replace(/\/$/, '');

  // Silently skip if not configured — chatbot never breaks
  if (!token || !secret || !appUrl || !lead.email) return;

  const dest    = encodeURIComponent(`${appUrl}/api/followup`);
  const delays  = ['86400s', '259200s', '432000s']; // 24 h, 3 d, 5 d

  const payload = {
    secret,
    name:          lead.name,
    email:         lead.email,
    projectType:   lead.scope,
    tier,
    estimatorLink: process.env.ESTIMATOR_LINK || 'https://landscaletemplate.framer.website/#quoter',
    calendlyLink:  process.env.CALENDLY_LINK  || '',
    ownerPhone:    process.env.OWNER_PHONE    || '',
    ownerName:     process.env.OWNER_NAME     || 'Milán',
  };

  await Promise.all(
    delays.map((delay, i) =>
      fetch(`https://qstash.upstash.io/v2/publish/${dest}`, {
        method:  'POST',
        headers: {
          'Authorization':  `Bearer ${token}`,
          'Content-Type':   'application/json',
          'Upstash-Delay':  delay,
        },
        body: JSON.stringify({ ...payload, followupNumber: i + 1 }),
      }).catch(err => console.error(`QStash schedule error (followup ${i + 1}):`, err.message))
    )
  );
}

function buildEmailHtml(lead) {
  const { name, email, phone, postcode, budget, scope, notes, priority } = lead;
  const priorityBanner = priority
    ? `<div style="background:#c0392b;color:#fff;padding:16px;font-size:18px;font-weight:bold;text-align:center;border-radius:6px;margin-bottom:24px;">&#x1F6A8; HIGH-VALUE PRIORITY LEAD &#x1F6A8;</div>`
    : '';
  const row = (label, value, href) =>
    `<tr>
      <td style="padding:10px 14px;font-weight:600;background:#f4f7f4;color:#1a2e1a;width:120px;border-bottom:1px solid #e0e8e0;">${label}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e0e8e0;">${href ? `<a href="${href}" style="color:#1e4620;">${value}</a>` : value}</td>
    </tr>`;
  const photosEmail = process.env.PHOTOS_EMAIL || process.env.OWNER_EMAIL;

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
        ${row('Scope', scope)}
        ${notes ? row('Notes', notes) : ''}
      </table>
      <p style="margin-top:20px;padding:14px;background:#f4f7f4;border-radius:6px;font-size:13px;color:#4a6a4a;">
        &#x1F4F7; Client has been asked to email 3 garden photos (back door, bottom-up, side access) to
        <a href="mailto:${photosEmail}" style="color:#1e4620;font-weight:600;">${photosEmail}</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildEmailText(lead) {
  const { name, email, phone, postcode, budget, scope, notes, priority } = lead;
  const photosEmail = process.env.PHOTOS_EMAIL || process.env.OWNER_EMAIL;
  const banner = priority ? '*** HIGH-VALUE PRIORITY LEAD ***\n\n' : '';
  return `${banner}New Landscale Lead\n${'='.repeat(40)}\n\nClient:   ${name}\nEmail:    ${email}\nPhone:    ${phone}\nLocation: ${postcode}\nBudget:   ${budget}\nScope:    ${scope}${notes ? `\nNotes:    ${notes}` : ''}\n\n----\nClient asked to email 3 photos (back door, bottom-up, side access) to ${photosEmail}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, history = [], leadAlreadySent = false, rejectedLogSent = false } = req.body;
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

    // Hard server-side gate: all 4 fields must be non-empty strings before an email is sent.
    // This prevents Gemini from triggering a lead email with partial data.
    const lead = parsed.lead;
    const leadIsComplete = lead &&
      lead.name  && lead.name.trim()  !== '' &&
      lead.phone && lead.phone.trim() !== '' &&
      lead.postcode && lead.postcode.trim() !== '' &&
      lead.budget && lead.budget.trim() !== '';

    // ── Log unqualified (rejected) lead to dashboard ─────────────────────────
    if (parsed.rejected === true && !rejectedLogSent) {
      logLeadToDashboard({
        tier: 'unqualified',
        source: 'chatbot',
        status: 'rejected',
      }).catch(() => {});
      return res.status(200).json({ reply, rawResponse: rawText, rejectionLogged: true });
    }

    // ── Qualified / VIP lead: send email + log to dashboard ──────────────────
    if (leadIsComplete && !leadAlreadySent) {
      const tier = lead.priority ? 'vip' : 'qualified';

      // Log to dashboard (fire-and-forget — never blocks the response)
      logLeadToDashboard({
        tier,
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        project_type: lead.scope,
        estimated_value: lead.budget,
        source: 'chatbot',
        lead_source_detail: lead.postcode ? `postcode:${lead.postcode}` : '',
        status: 'pending',
      }).catch(() => {});

      try {
        const { name, postcode, budget, priority } = lead;
        const priorityPrefix = priority ? '[PRIORITY] ' : '';
        const subject = `${priorityPrefix}[NEW LEAD] ${postcode} - ${name} - ${budget}`;

        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.RESEND_FROM || 'Landscale Bot <onboarding@resend.dev>',
            to: [process.env.OWNER_EMAIL],
            subject,
            html: buildEmailHtml(lead),
            text: buildEmailText(lead),
          }),
        });

        if (!resendRes.ok) throw new Error(`Resend error: ${resendRes.status}`);

        // Schedule 3 follow-up emails via QStash (24 h, 3 d, 5 d)
        await scheduleFollowUps(lead, tier);

        return res.status(200).json({ reply, rawResponse: rawText, leadSent: true });
      } catch (emailErr) {
        console.error('Resend error:', emailErr);
        // Still return the reply even if email fails
        return res.status(200).json({ reply, rawResponse: rawText, leadSent: false });
      }
    }

    return res.status(200).json({ reply, rawResponse: rawText });
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
