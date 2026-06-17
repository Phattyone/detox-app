/* ═══════════════════════════════════════════════════════════════════════════
   mailerlite.js  —  Vercel serverless function: MailerLite subscriber upsert

   Adds or updates a subscriber in MailerLite. Called fire-and-forget from
   the frontend — never blocks the UI.

   -- CONNECT: VERCEL ENV --
   Set this in Vercel Dashboard → Project Settings → Environment Variables:
     MAILERLITE_API_KEY — from MailerLite → Integrations → API

   Local development:
   - Add MAILERLITE_API_KEY to .env.local in the detox-app/ directory
   - Run `vercel dev` — it reads .env.local automatically
   ═══════════════════════════════════════════════════════════════════════════ */

module.exports = async function handler(req, res) {

  /* ── CORS preflight ─────────────────────────────────────────────────────── */
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  /* ── CORS on all responses ──────────────────────────────────────────────── */
  res.setHeader('Access-Control-Allow-Origin', '*');

  /* ── Only allow POST ────────────────────────────────────────────────────── */
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  /* ── Parse request body ─────────────────────────────────────────────────── */
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ success: false, error: 'Invalid JSON in request body.' });
  }

  const { email, name } = body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'Valid email required.' });
  }

  /* ── Read API key from server environment ───────────────────────────────── */
  const apiKey = process.env.MAILERLITE_API_KEY;
  if (!apiKey) {
    console.error('mailerlite: MAILERLITE_API_KEY not set');
    return res.status(500).json({ success: false, error: 'Email service not configured.' });
  }

  /* ── Upsert subscriber via MailerLite API v2 ────────────────────────────── */
  try {
    const response = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        email,
        fields: { name: name || '' },
        groups: ['190491594072261672'],
      }),
    });

    if (response.status === 200 || response.status === 201) {
      return res.status(200).json({ success: true });
    }

    const errBody = await response.json().catch(() => ({}));
    console.error('mailerlite: API error:', response.status, errBody);
    return res.status(200).json({ success: false, error: 'MailerLite API error.' });

  } catch (err) {
    console.error('mailerlite: fetch failed:', err);
    return res.status(200).json({ success: false, error: 'Email capture unavailable.' });
  }
};
