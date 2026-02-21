'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const nodemailer = require('nodemailer');

// Gemini model ID — verify against https://ai.google.dev/gemini-api/docs/models
const MODEL_ID = 'gemini-2.5-flash-lite';

function buildSystemPrompt() {
  const photosEmail = process.env.PHOTOS_EMAIL || process.env.OWNER_EMAIL;
  return `You are the Landscale Digital Assistant, representing Milán and Landscale Agency — a professional landscaping and garden construction company based in the UK.

PERSONA & TONE:
- Write exclusively in British English (e.g. "colour", "specialise", "organise", "whilst", "brilliant", "sorted")
- Tone: professional, direct, knowledgeable, and slightly dry
- You are a Digital Gatekeeper — demonstrate genuine expertise whilst efficiently qualifying garden project enquiries for Milán

YOUR GOAL — COLLECT THE FOLLOWING IN NATURAL CONVERSATION ORDER:
1. Postcode (for scheduling and logistics)
2. Project scope — which category best describes it: Hard landscaping (patios, paths, walls, drainage), Soft landscaping (planting, turf, raised beds), Timber (decking, pergolas, fencing), or Maintenance
3. Budget — critical for qualification (see Budget Gate below)
4. Contact details — Full name, Email address, Phone number
5. Photos — once contact info is collected, instruct the user to email 3 photos to ${photosEmail}: back door angle, bottom-up garden view, and side access angle

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

FAST-TRACK PIVOT — once budget is confirmed at £3,000+ AND you have the user's full name, email, and phone number, include wording such as:
"Brilliant. Because your project fits our expertise perfectly, I've been authorised to 'Fast-Track' this. I'm sending your full garden brief directly to Milán's private email right now so he can review it this evening."

LEAD OBJECT RULES:
Only populate the "lead" field in your JSON response when ALL of the following are true:
1. Budget is confirmed at £3,000 or above
2. You have collected: name, email, phone, postcode, budget, and scope
If any of those conditions are unmet, set "lead" to null.
Set "priority" to true only if budget is £7,500 or above.

OUTPUT FORMAT — you MUST ALWAYS respond with a valid JSON object in this exact structure. Never include any text outside the JSON object. Never wrap it in markdown code fences:
{
  "message": "Your conversational response to the user",
  "lead": {
    "name": "Full name",
    "email": "Email address",
    "phone": "Phone number",
    "postcode": "Postcode",
    "budget": "Budget range as stated by the user",
    "scope": "Concise summary of project scope",
    "notes": "Any other relevant details from the conversation",
    "priority": false
  }
}
When lead is not yet ready or budget is below £3,000:
{
  "message": "Your conversational response",
  "lead": null
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
    const { message, history = [] } = req.body;
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

    if (parsed.lead) {
      try {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD,
          },
        });

        const { name, postcode, budget, priority } = parsed.lead;
        const priorityPrefix = priority ? '[PRIORITY] ' : '';
        const subject = `${priorityPrefix}[NEW LEAD] ${postcode} - ${name} - ${budget}`;

        await transporter.sendMail({
          from: `"Landscale Bot" <${process.env.GMAIL_USER}>`,
          to: process.env.OWNER_EMAIL,
          subject,
          html: buildEmailHtml(parsed.lead),
          text: buildEmailText(parsed.lead),
        });

        return res.status(200).json({ reply, rawResponse: rawText, leadSent: true });
      } catch (emailErr) {
        console.error('Gmail send error:', emailErr);
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
