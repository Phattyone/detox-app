/* ═══════════════════════════════════════════════════════════════════════════
   ai-proxy.js  —  Vercel serverless function: Anthropic API proxy
   ═══════════════════════════════════════════════════════════════════════════

   This function runs SERVER-SIDE. The API key is NEVER sent to the browser.

   -- CONNECT: VERCEL ENV --
   Set ANTHROPIC_API_KEY in Vercel Dashboard:
   Project Settings → Environment Variables → ANTHROPIC_API_KEY

   Local development:
   - Run `vercel dev` from the detox-app/ directory
   - Vercel Dev reads .env.local and makes ANTHROPIC_API_KEY available here
   - Browser calls /api/ai-proxy → this function handles it
   ═══════════════════════════════════════════════════════════════════════════ */

export default async function handler(req, res) {

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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ── Read API key from server environment ───────────────────────────────── */
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set in environment');
    return res.status(500).json({
      error: 'AI service not configured. Set ANTHROPIC_API_KEY in Vercel environment variables.',
    });
  }

  /* ── Parse and validate request body ───────────────────────────────────── */
  // Vercel's default bodyParser auto-parses JSON; handle both parsed and raw forms.
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch(e) {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  // Whitelist only the fields we need — never proxy arbitrary payloads
  const safePayload = {
    model:      body.model      || 'claude-haiku-4-5',
    max_tokens: Math.min(body.max_tokens || 300, 500),  // cap at 500
    messages:   body.messages   || [],
    system:     body.system     || '',
  };

  if (!Array.isArray(safePayload.messages) || safePayload.messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  /* ── Forward to Anthropic ───────────────────────────────────────────────── */
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(safePayload),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch(err) {
    console.error('Anthropic API error:', err);
    return res.status(502).json({ error: 'Failed to reach AI service. Please try again.' });
  }
}
