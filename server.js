'use strict';

const path = require('path');
const fs = require('fs');
const express = require('express');
const A = require('./public/assessment-core.js');

// ---------- Config (set these as Railway variables) ----------
const PORT = process.env.PORT || 3000;
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'Lovable Readiness Check <onboarding@resend.dev>';
const NOTIFY_TO = (process.env.NOTIFY_TO || 'huzaifa.murad@tekrevol.com').split(',').map((s) => s.trim()).filter(Boolean);
const SEND_PROSPECT_REPORT = String(process.env.SEND_PROSPECT_REPORT || 'false').toLowerCase() === 'true';
const BOOKING_URL = process.env.BOOKING_URL || '#';
const PRIVACY_URL = process.env.PRIVACY_URL || 'https://www.tekrevol.com/privacy-policy';
const TERMS_URL = process.env.TERMS_URL || '';

const FREE_DOMAINS = new Set(['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com', 'live.com', 'msn.com']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// ---------- Page (config values injected once at startup) ----------
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let pageSource = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
if (!TERMS_URL) {
  // No terms page configured: drop the footer link rather than show a dead one.
  pageSource = pageSource.replace(/<span style="margin: 0 10px">·<\/span><a href="__TERMS_URL__"[^>]*>Terms<\/a>/, '');
}
const pageHtml = pageSource
  .split('__BOOKING_URL__').join(esc(BOOKING_URL))
  .split('__PRIVACY_URL__').join(esc(PRIVACY_URL))
  .split('__TERMS_URL__').join(esc(TERMS_URL));

app.get(['/', '/index.html'], (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.type('html').send(pageHtml);
});
app.use(express.static(path.join(__dirname, 'public'), { index: false, maxAge: '1h' }));
app.get('/healthz', (req, res) => res.json({ ok: true }));

// ---------- Simple in-memory rate limit: 5 submissions per IP per 10 minutes ----------
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 5;
}

// ---------- Email ----------
async function sendEmail({ to, subject, html, text, replyTo }) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html, text, reply_to: replyTo }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend error ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

function row(label, value) {
  return `<tr><td style="padding:8px 12px;border-bottom:1px solid #EDEFF4;color:#525B70;font-size:13px;width:38%;vertical-align:top">${esc(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #EDEFF4;color:#0E1220;font-size:14px;vertical-align:top">${value}</td></tr>`;
}

function buildNotification(lead, result, meta) {
  const when = new Date();
  const karachi = when.toLocaleString('en-US', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' });
  const answerRows = Object.keys(A.QUESTIONS).map((k) => row(A.QUESTIONS[k].t, esc(A.label(k, lead.answers[k])))).join('');
  const areaRows = result.areas.map((a) => row(a.label, `${a.pct}/100 · ${A.tone(a.pct)}`)).join('');
  const fixList = result.fixes.map((f, i) => `<li style="margin:0 0 6px">${i + 1}. ${esc(f.title)} <span style="color:#525B70">(${f.priority})</span></li>`).join('');
  const trackRows = Object.keys(meta.tracking).length
    ? Object.entries(meta.tracking).map(([k, v]) => row(k, esc(v))).join('')
    : row('Tracking', 'None (direct visit)');

  const html = `<!doctype html><html><body style="margin:0;background:#F6F7FA;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:24px">
<div style="background:#040B18;color:#fff;border-radius:12px 12px 0 0;padding:20px 24px">
<div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#F7934A">New Lovable readiness lead</div>
<div style="font-size:22px;font-weight:bold;margin-top:6px">${esc(lead.name)}${lead.company ? ' · ' + esc(lead.company) : ''}</div>
<div style="font-size:15px;margin-top:4px;color:#C3CAD9">Score ${result.score}/100 · ${esc(result.band.title)}</div>
</div>
<div style="background:#fff;border-radius:0 0 12px 12px;padding:8px 12px 20px">
<h3 style="font-size:14px;margin:16px 12px 6px;color:#0E1220">Contact</h3>
<table style="width:100%;border-collapse:collapse">
${row('Name', esc(lead.name))}
${row('Work email', `<a href="mailto:${esc(lead.email)}">${esc(lead.email)}</a>`)}
${row('Company', esc(lead.company || 'Not given'))}
${row('Submitted', esc(karachi) + ' (Karachi time)')}
</table>
<h3 style="font-size:14px;margin:20px 12px 6px;color:#0E1220">Scores</h3>
<table style="width:100%;border-collapse:collapse">${row('Overall', `<strong>${result.score}/100</strong> · ${esc(result.band.title)}`)}${areaRows}</table>
<h3 style="font-size:14px;margin:20px 12px 6px;color:#0E1220">Fixes shown to the lead</h3>
<ul style="list-style:none;padding:0 12px;margin:0;font-size:14px;color:#0E1220">${fixList}</ul>
<h3 style="font-size:14px;margin:20px 12px 6px;color:#0E1220">Answers</h3>
<table style="width:100%;border-collapse:collapse">${answerRows}</table>
<h3 style="font-size:14px;margin:20px 12px 6px;color:#0E1220">Source</h3>
<table style="width:100%;border-collapse:collapse">
${trackRows}
${row('Page', esc(meta.page || ''))}
${row('Referrer', esc(meta.referrer || 'None'))}
${row('Time on page', esc(meta.secondsOnPage != null ? meta.secondsOnPage + ' seconds' : 'Unknown'))}
${row('Report emailed to lead', SEND_PROSPECT_REPORT ? 'Yes (automatic)' : '<strong>No, send it manually within 6 hours</strong>')}
</table>
<p style="font-size:13px;color:#525B70;margin:20px 12px 0">Reply to this email to answer ${esc(lead.name)} directly.</p>
</div></div></body></html>`;

  const text = [
    `New Lovable readiness lead`,
    `${lead.name} · ${lead.company || 'No company'} · ${lead.email}`,
    `Score: ${result.score}/100 (${result.band.title})`,
    ...result.areas.map((a) => `${a.label}: ${a.pct}/100`),
    '',
    'Fixes:',
    ...result.fixes.map((f, i) => `${i + 1}. ${f.title} (${f.priority})`),
    '',
    'Answers:',
    ...Object.keys(A.QUESTIONS).map((k) => `- ${A.QUESTIONS[k].t} ${A.label(k, lead.answers[k])}`),
    '',
    `Tracking: ${JSON.stringify(meta.tracking)}`,
    `Submitted: ${karachi} (Karachi time)`,
  ].join('\n');

  const subject = `New Lovable check lead: ${lead.company || lead.name} scored ${result.score} (${result.band.title})`;
  return { subject, html, text };
}

function buildProspectReport(lead, result) {
  const areaRows = result.areas.map((a) => row(a.label, `${a.pct}/100 · ${A.tone(a.pct)}`)).join('');
  const fixes = result.fixes.map((f, i) => `
<div style="border:1px solid #E4E7EE;border-radius:10px;padding:16px 18px;margin:0 0 12px">
<div style="font-size:12px;color:#525B70;text-transform:uppercase;letter-spacing:.05em">Fix ${i + 1} · ${f.priority} priority</div>
<div style="font-size:16px;font-weight:bold;color:#0E1220;margin-top:4px">${esc(f.title)}</div>
<p style="font-size:14px;line-height:1.55;color:#3A4256;margin:8px 0 0"><strong>Why it matters:</strong> ${esc(f.why)}</p>
<p style="font-size:14px;line-height:1.55;color:#3A4256;margin:6px 0 0"><strong>How to fix it:</strong> ${esc(f.how)}</p>
</div>`).join('');
  const booking = BOOKING_URL && BOOKING_URL !== '#'
    ? `<p style="margin:20px 0 0"><a href="${esc(BOOKING_URL)}" style="display:inline-block;background:#F47A1F;color:#0B0F1A;text-decoration:none;font-weight:bold;padding:12px 20px;border-radius:8px">Book a 30-minute review</a></p>`
    : '';
  const html = `<!doctype html><html><body style="margin:0;background:#F6F7FA;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:24px">
<div style="background:#040B18;color:#fff;border-radius:12px 12px 0 0;padding:22px 24px">
<div style="font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#F7934A">Your Lovable readiness report</div>
<div style="font-size:30px;font-weight:bold;margin-top:8px">${result.score}/100 · ${esc(result.band.title)}</div>
<div style="font-size:15px;margin-top:6px;color:#C3CAD9">${esc(result.band.line)}</div>
</div>
<div style="background:#fff;border-radius:0 0 12px 12px;padding:20px 24px">
<p style="font-size:15px;color:#0E1220;margin:0 0 16px">Hi ${esc(lead.name)}, here is the full report from your readiness check.</p>
<table style="width:100%;border-collapse:collapse;margin-bottom:20px">${areaRows}</table>
<h3 style="font-size:16px;color:#0E1220;margin:0 0 12px">Your fixes, in priority order</h3>
${fixes}
<p style="font-size:14px;line-height:1.55;color:#3A4256;margin:16px 0 0">Want a second opinion? Reply to this email or book a short call with a TekRevol engineer. We sign an NDA before you share project details, and a call is always optional.</p>
${booking}
<p style="font-size:12px;color:#8A93A8;margin:24px 0 0">This report is based only on your answers. We did not scan or test your app.</p>
</div></div></body></html>`;
  const text = [
    `Your Lovable readiness report: ${result.score}/100 (${result.band.title})`,
    result.band.line,
    '',
    ...result.areas.map((a) => `${a.label}: ${a.pct}/100`),
    '',
    ...result.fixes.flatMap((f, i) => [`${i + 1}. ${f.title} (${f.priority})`, `Why: ${f.why}`, `How: ${f.how}`, '']),
    'This report is based only on your answers. We did not scan or test your app.',
  ].join('\n');
  return { subject: `Your Lovable readiness report: ${result.score}/100`, html, text };
}

// ---------- Submission endpoint ----------
app.post('/api/submit', express.json({ limit: '20kb' }), async (req, res) => {
  const ip = req.ip || 'unknown';
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many submissions. Please try again in a few minutes.' });

  const b = req.body || {};
  // Honeypot: real visitors never fill this hidden field.
  if (b.website) return res.json({ ok: true, prospectEmailed: false });

  const name = String(b.name || '').trim().slice(0, 80);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 160);
  const company = String(b.company || '').trim().slice(0, 120);
  if (!name) return res.status(400).json({ error: 'Add your first name so we can address the report.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'That email does not look right. Check it and try again.' });
  if (FREE_DOMAINS.has(email.split('@')[1])) return res.status(400).json({ error: 'Please use your work email so the report reaches your team.' });

  const answers = {};
  for (const k of Object.keys(A.QUESTIONS)) {
    const v = b.answers && typeof b.answers[k] === 'string' ? b.answers[k] : '';
    if (!A.label(k, v)) return res.status(400).json({ error: 'Some answers are missing. Please go back and complete every step.' });
    answers[k] = v;
  }

  const tracking = {};
  if (b.tracking && typeof b.tracking === 'object') {
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'arm', 'cid']) {
      if (typeof b.tracking[k] === 'string' && b.tracking[k]) tracking[k] = b.tracking[k].slice(0, 200);
    }
  }
  const meta = {
    tracking,
    page: String(b.page || '').slice(0, 500),
    referrer: String(b.referrer || '').slice(0, 500),
    secondsOnPage: Number.isFinite(b.secondsOnPage) ? Math.max(0, Math.min(86400, Math.round(b.secondsOnPage))) : null,
  };

  const lead = { name, email, company, answers };
  const result = A.compute(answers);

  // Backup record in Railway logs, in case an email ever fails.
  console.log(JSON.stringify({ event: 'lead', at: new Date().toISOString(), name, email, company, score: result.score, band: result.band.key, answers, tracking }));

  try {
    const n = buildNotification(lead, result, meta);
    await sendEmail({ to: NOTIFY_TO, subject: n.subject, html: n.html, text: n.text, replyTo: email });
  } catch (err) {
    console.error(JSON.stringify({ event: 'notify_failed', email, error: String(err.message || err) }));
    return res.status(502).json({ error: 'We could not send your report right now. Please try again in a minute.' });
  }

  let prospectEmailed = false;
  if (SEND_PROSPECT_REPORT) {
    try {
      const r = buildProspectReport(lead, result);
      await sendEmail({ to: [email], subject: r.subject, html: r.html, text: r.text, replyTo: NOTIFY_TO[0] });
      prospectEmailed = true;
    } catch (err) {
      console.error(JSON.stringify({ event: 'prospect_report_failed', email, error: String(err.message || err) }));
    }
  }

  res.json({ ok: true, prospectEmailed });
});

app.use((req, res) => res.status(404).send('Not found'));

app.listen(PORT, () => {
  console.log(`Lovable readiness check running on port ${PORT}`);
  if (!RESEND_API_KEY) console.warn('Warning: RESEND_API_KEY is not set, so submissions will fail until it is added.');
});
