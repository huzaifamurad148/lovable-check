# TekRevol Lovable Readiness Check

Landing page with the 9-question assessment. Every submission is emailed to
`huzaifa.murad@tekrevol.com` with the lead's details, score, answers and UTM source.

## What's inside

| File | What it does |
|---|---|
| `public/index.html` | The landing page |
| `public/app.js` | The click-through assessment, score screen and form |
| `public/assessment-core.js` | Questions and scoring rules, shared by the page and the server |
| `server.js` | Serves the page and handles `POST /api/submit` (validates, emails, logs) |
| `.env.example` | Every setting, with notes |

## Why Resend, not normal email (SMTP)

Railway blocks outbound SMTP on the Free, Trial and Hobby plans and recommends an
email service with an HTTPS API. Resend is one of those, and it has a free tier.

## Deploy in 4 steps

### 1. Get a Resend API key (5 minutes)
1. Sign up at resend.com **using huzaifa.murad@tekrevol.com**.
2. Go to API Keys > Create API Key (permission: Sending access). Copy it.

Until a domain is verified, Resend's test sender (`onboarding@resend.dev`) only
delivers to the email you signed up with. That's enough for the lead notifications.

### 2. Put the code on Railway
Pick one:
- **GitHub (recommended):** push this folder to a GitHub repo, then in Railway:
  New Project > Deploy from GitHub repo > pick the repo.
- **Railway CLI:** install the CLI, then from this folder run `railway login`,
  `railway init`, `railway up`.

Railway detects Node automatically and runs `npm start`.

### 3. Add variables
In Railway: your service > Variables. Add:

```
RESEND_API_KEY=re_...            (from step 1)
NOTIFY_TO=huzaifa.murad@tekrevol.com
FROM_EMAIL=Lovable Readiness Check <onboarding@resend.dev>
SEND_PROSPECT_REPORT=false
BOOKING_URL=https://...          (your Calendly or HubSpot meetings link)
PRIVACY_URL=https://www.tekrevol.com/privacy-policy
```

### 4. Get a public URL and test
1. Service > Settings > Networking > Generate Domain (or add a custom domain
   like `check.tekrevol.com`).
2. Open the URL, complete the assessment with a work email and submit.
3. You should get "New Lovable check lead: ..." in your inbox within seconds.
   If not, check Railway > Deployments > Logs for a `notify_failed` line.

## Turning on the automatic report for prospects

Right now (`SEND_PROSPECT_REPORT=false`) the thank-you screen says your team will
send the report within 6 hours, and the lead email reminds you to send it.

To send it automatically:
1. In Resend > Domains, add `tekrevol.com` (or a subdomain like `mail.tekrevol.com`)
   and add the DNS records it shows. Your IT or whoever manages DNS can do this.
2. Once verified, set `FROM_EMAIL=TekRevol <check@tekrevol.com>` and
   `SEND_PROSPECT_REPORT=true`. Railway redeploys automatically.

The prospect then gets a full report with every fix, why it matters and how to fix it.

## Built-in protection
- Hidden spam trap field (bots fill it, people don't)
- 5 submissions per visitor per 10 minutes
- Work email required (Gmail, Yahoo and similar are rejected)
- Score recalculated on the server, so it can't be faked
- Every lead also written to Railway logs as a backup record
- If the notification email fails, the visitor is asked to retry, so no lead is lost silently

## Tracking A/B arms
Add parameters to the links in your emails, for example:
`https://your-url/?utm_source=email&utm_campaign=lovable_check&utm_content=e2&arm=A`
They appear in the "Source" section of each lead email.

## Run locally
```
npm install
RESEND_API_KEY=re_... npm start
```
Then open http://localhost:3000
