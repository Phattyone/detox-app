/* ═══════════════════════════════════════════════════════════════════════════
   ai-proxy.js  —  Netlify serverless function: Anthropic API proxy
   ═══════════════════════════════════════════════════════════════════════════

   This function runs SERVER-SIDE. The API key is NEVER sent to the browser.

   -- CONNECT: NETLIFY ENV --
   Set ANTHROPIC_API_KEY in Netlify Dashboard:
   Site Settings → Environment Variables → ANTHROPIC_API_KEY

   Local development:
   - Run `netlify dev` from the detox-app/ directory
   - Netlify Dev reads .env.local and makes ANTHROPIC_API_KEY available here
   - Browser calls /.netlify/functions/ai-proxy → this function handles it
   ═══════════════════════════════════════════════════════════════════════════ */

exports.handler = async function(event) {

  /* ── CORS preflight ─────────────────────────────────────────────────────── */
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  /* ── Only allow POST ────────────────────────────────────────────────────── */
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  /* ── Read API key from server environment ───────────────────────────────── */
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set in environment');
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: 'AI service not configured. Set ANTHROPIC_API_KEY in Netlify environment variables.',
      }),
    };
  }

  /* ── Parse and validate request body ───────────────────────────────────── */
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch(e) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Invalid JSON in request body' }),
    };
  }

  // Whitelist only the fields we need — never proxy arbitrary payloads
  const safePayload = {
    model:      body.model      || 'claude-haiku-4-5',
    max_tokens: Math.min(body.max_tokens || 300, 500),  // cap at 500
    messages:   body.messages   || [],
    system:     body.system     || '',
  };

  if (!Array.isArray(safePayload.messages) || safePayload.messages.length === 0) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'messages array is required' }),
    };
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

    return {
      statusCode: upstream.status,
      headers:    corsHeaders(),
      body:       JSON.stringify(data),
    };
  } catch(err) {
    console.error('Anthropic API error:', err);
    return {
      statusCode: 502,
      headers:    corsHeaders(),
      body:       JSON.stringify({ error: 'Failed to reach AI service. Please try again.' }),
    };
  }
};

function corsHeaders() {
  return {
    'Content-Type':                'application/json',
    'Access-Control-Allow-Origin': '*',
  };
}
