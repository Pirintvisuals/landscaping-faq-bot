# Landscale FAQ Bot

AI-powered lead qualification chatbot + lead tracking dashboard.

---

## Running locally

You need **two terminals** open at the same time.

### Terminal 1 — Dashboard (port 5000)

```bash
cd dashboard
node server.js
```

To enable the API key (required for the chatbot to post leads):

**PowerShell:**
```powershell
$env:DASHBOARD_API_KEY="your-secret-key"; node server.js
```

**Git Bash / WSL:**
```bash
DASHBOARD_API_KEY=your-secret-key node server.js
```

Open the dashboard at: **http://localhost:5000**

---

### Terminal 2 — Chatbot API (port 3000)

Stay in the project root:

```bash
npx vercel dev
```

This reads your `.env` file and serves the API locally at `http://localhost:3000`.

---

## Environment variables

Copy `.env.example` to `.env` and fill in your values:

| Variable            | Description                                      |
|---------------------|--------------------------------------------------|
| `GEMINI_API_KEY`    | Google AI Studio API key                         |
| `GMAIL_USER`        | Gmail address used to send lead emails           |
| `GMAIL_APP_PASSWORD`| Gmail App Password (not your regular password)   |
| `OWNER_EMAIL`       | Where lead summary emails are sent               |
| `PHOTOS_EMAIL`      | Where clients are told to send garden photos     |
| `DASHBOARD_URL`     | Dashboard URL (ngrok or deployed) for production |
| `DASHBOARD_API_KEY` | Secret key — must match what dashboard uses      |

---

## Lead tiers

| Budget       | Tier        | Priority email |
|--------------|-------------|----------------|
| Under £3k    | Unqualified | No             |
| £3k – £7.5k  | Qualified   | No             |
| £7.5k+       | VIP         | Yes            |

---

## Project structure

```
/
├── api/
│   └── chat.js          # Vercel serverless function — AI + email + dashboard logging
├── public/
│   └── widget.js        # Chat widget embedded on Framer site
├── dashboard/
│   ├── server.js        # Express server — lead storage + dashboard UI
│   ├── leads.json       # Local database (auto-created on first lead)
│   └── public/          # Dashboard frontend (HTML/CSS/JS)
├── .env                 # Local secrets (never commit this)
└── .env.example         # Template — safe to commit
```

---

## Deployment

The chatbot (`api/`) deploys to **Vercel** automatically on push to `main`.

Set all env vars in the Vercel dashboard under **Settings → Environment Variables**, including `DASHBOARD_URL` pointing to your ngrok or deployed dashboard URL.
