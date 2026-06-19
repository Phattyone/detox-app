/* ═══════════════════════════════════════════════════════════════════════════
   ai-proxy.js  —  Vercel serverless function: Groq API proxy
   ═══════════════════════════════════════════════════════════════════════════

   This function runs SERVER-SIDE. The API key is NEVER sent to the browser.

   -- CONNECT: VERCEL ENV --
   Set GROQ_API_KEY in Vercel Dashboard:
   Project Settings → Environment Variables → GROQ_API_KEY

   ANTHROPIC_API_KEY remains set in Vercel but is no longer used here.

   Local development:
   - Run `vercel dev` from the detox-app/ directory
   - Vercel Dev reads .env.local and makes GROQ_API_KEY available here
   - Browser calls /api/ai-proxy → this function handles it
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ── Read API key from server environment ───────────────────────────────── */
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY not set in environment');
    return res.status(500).json({
      error: 'AI service not configured. Set GROQ_API_KEY in Vercel environment variables.',
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
  const messages   = body.messages || [];
  const systemText = body.system   || '';
  const maxTokens  = Math.min(body.max_tokens || 1000, 1000);  // cap at 1000

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  // Groq uses OpenAI format: system prompt is the first message in the array
  const groqMessages = systemText
    ? [{ role: 'system', content: systemText }, ...messages]
    : messages;

  /* ── Forward to Groq ────────────────────────────────────────────────────── */
  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        messages:    groqMessages,
        max_tokens:  maxTokens,
        temperature: 0.7,
      }),
    });

    const data = await upstream.json();
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;

    if (!text) {
      console.error('Groq API unexpected response:', JSON.stringify(data));
      return res.status(502).json({ error: 'No response from AI service. Please try again.' });
    }

    // Return in Anthropic-compatible shape so the client needs no changes
    return res.status(200).json({ content: [{ text }] });

  } catch(err) {
    console.error('Groq API error:', err);
    return res.status(502).json({ error: 'Failed to reach AI service. Please try again.' });
  }
}
