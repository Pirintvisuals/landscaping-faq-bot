'use strict';

// ─── Email templates ──────────────────────────────────────────────────────────

function buildEmail({ name, projectType, followupNumber, tier, estimatorLink, calendlyLink, ownerPhone, ownerName }) {
  const n  = name        || 'there';
  const pt = projectType || 'garden project';
  const el = estimatorLink;
  const cl = calendlyLink;
  const op = ownerPhone;
  const on = ownerName || 'Milán';

  if (tier === 'vip') {
    if (followupNumber === 1) return {
      subject: 'Reserved your priority slot',
      text:
`Hi ${n},

I've reserved a priority consultation slot for your ${pt} project. ${on} reviewed your inquiry personally and is excited to discuss your vision.

Your exclusive booking link: ${cl}

These slots fill up fast — grab yours while available.

${on}`,
    };

    if (followupNumber === 2) return {
      subject: 'Your personalized project estimate',
      text:
`Hi ${n},

I know you're considering a premium ${pt} project. Want to see exact numbers before our call?

Get your personalised estimate here: ${el}

Then we can use your consultation to discuss design details instead of pricing.

Book your priority slot: ${cl}

${on}`,
    };

    // VIP day 5
    return {
      subject: 'Can I ask you something?',
      text:
`Hi ${n},

${on} here. I noticed you haven't booked yet and I'm curious — is there something holding you back? Budget? Timeline? Something else?

I'd rather know honestly so we can figure it out together.

Here's my direct line: ${op}. Or if you prefer, grab a time here: ${cl}

${on}`,
    };
  }

  // ── Qualified ──────────────────────────────────────────────────────────────

  if (followupNumber === 1) return {
    subject: `Quick question about your ${pt}`,
    text:
`Hi ${n},

I was just thinking about your ${pt} project. Have you had a chance to consider timing?

Most of our clients start seeing results within 2–3 weeks of booking. Any questions I can answer?

${on}`,
  };

  if (followupNumber === 2) return {
    subject: "Thought you'd want to see this",
    text:
`Hi ${n},

I just finished a ${pt} project that reminded me of what you described.

Want to see how it turned out? Reply to this email and I'll send over some photos. Does something like this match your vision?

${on}`,
  };

  // Qualified day 5
  return {
    subject: 'Get your instant estimate here',
    text:
`Hi ${n},

Not sure about budget yet? Get an instant estimate for your ${pt} project here:

${el}

No commitment, just helps you plan. Takes 2 minutes. Once you see the numbers, we can chat about next steps!

${on}`,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify shared secret — prevents random POSTs from triggering emails
  const body = req.body || {};
  if (!process.env.FOLLOWUP_SECRET || body.secret !== process.env.FOLLOWUP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, email, projectType, tier, followupNumber } = body;

  if (!email || !followupNumber) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { subject, text } = buildEmail(body);

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    process.env.RESEND_FROM || 'Landscale Bot <onboarding@resend.dev>',
        to:      [email],
        subject,
        text,
      }),
    });

    if (!resendRes.ok) throw new Error(`Resend ${resendRes.status}`);

    console.log(`Follow-up #${followupNumber} (${tier}) sent → ${email}`);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Follow-up send error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
