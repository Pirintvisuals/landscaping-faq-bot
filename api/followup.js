'use strict';

// ─── Email templates ──────────────────────────────────────────────────────────

function timelineContext(timeline) {
  const map = {
    'ASAP (1-4 weeks)':           'ASAP projects',
    'This season (1-3 months)':   'seasonal work',
    'Planning ahead (3-6 months)':'projects later this year',
    'Just exploring ideas':       'your project',
  };
  return map[timeline] || 'your project';
}

function buildEmail({ name, projectType, followupNumber, tier, timeline, estimatorLink, calendlyLink, ownerPhone, ownerWebsite, ownerName }) {
  const n   = name        || 'there';
  const pt  = projectType || 'garden project';
  const el  = estimatorLink;
  const cl  = calendlyLink;
  const ph  = ownerPhone;
  const ws  = ownerWebsite;
  const on  = ownerName || 'Milán';
  const tc  = timelineContext(timeline);

  // ── Follow-up Email #2 ────────────────────────────────────────────────────
  if (followupNumber === 2) return {
    subject: `Quick question about your ${pt}...`,
    text:
`${n},

Just following up — did you get a chance to look at the calendar?

I know choosing the right landscaper is a big decision. Here's the thing most people don't realise: the best times fill up fast, especially for ${tc}.

If you're serious about getting this done, I'd grab a slot this week before they're gone.

👉 ${cl || '[Calendar link]'}

Already sorted? Great — disregard this.

Not ready yet? No worries — just let me know when makes sense and we can circle back.

${ph || ''} | ${ws || ''}

Cheers,
${on}`,
  };

  // ── Follow-up Email #3 ────────────────────────────────────────────────────
  if (followupNumber === 3) return {
    subject: `Last call - ${pt} availability closing`,
    text:
`${n},

This is my last follow-up (promise — I won't spam you).

Milán's calendar for ${tc} is almost full.

If you want to get your ${pt} done right, now's the time to lock it in.

👉 Book here: ${cl || '[Calendar link]'}

Or call us directly: ${ph || ''}

Already booked or not the right time? No worries at all — we'll be here when you're ready.

Best of luck with the project,
${on}

${ws || ''}`,
  };

  // Fallback (should not be reached — Email #1 sent directly from chat.js)
  return {
    subject: `Your ${pt} with Landscale`,
    text: `Hi ${n},\n\nThanks for your interest in your ${pt} project. We'll be in touch soon.\n\n${on}`,
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};
  if (!process.env.FOLLOWUP_SECRET || body.secret !== process.env.FOLLOWUP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { email, followupNumber } = body;

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

    console.log(`Follow-up #${followupNumber} sent → ${email}`);

    // Update email status in dashboard (fire-and-forget)
    const dashboardUrl = process.env.DASHBOARD_URL;
    if (dashboardUrl) {
      fetch(`${dashboardUrl}/api/leads/email-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': process.env.DASHBOARD_API_KEY || 'dev-key-change-me',
        },
        body: JSON.stringify({ email, followupNumber }),
        signal: AbortSignal.timeout(5000),
      }).catch(err => console.error('Dashboard email-status update error:', err.message));
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Follow-up send error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
