/* ═══════════════════════════════════════════════════════════════════════════
   get-download-url.js  —  Vercel serverless function: Supabase signed URL
   ═══════════════════════════════════════════════════════════════════════════

   Validates the requesting user's JWT, then uses the Supabase service role
   key to generate a short-lived signed URL for a file in private Storage.
   The browser never receives the service role key — it only gets the
   time-limited signed URL.

   -- CONNECT: VERCEL ENV --
   Set these in Vercel Dashboard → Project Settings → Environment Variables:
     SUPABASE_URL              — your project URL (Settings → API)
     SUPABASE_SERVICE_ROLE_KEY — service role secret (Settings → API)

   -- SUPABASE STORAGE SETUP --
   1. Create a bucket named "downloads" — set it to PRIVATE (not public)
   2. Upload files at:
        guides/Detox-Cleanse-Guide.pdf
        spreadsheets/detox-cleanse-v8.xlsx

   Local development:
   - Add both vars to .env.local in the detox-app/ directory
   - Run `vercel dev` — it reads .env.local automatically
   ═══════════════════════════════════════════════════════════════════════════ */

const { createClient } = require('@supabase/supabase-js');

/* ── File path map (bucket: "downloads") ────────────────────────────────── */
const FILE_PATHS = {
  'guide-preview':  'guides/detox-cleanse-preview.pdf',
  'shopping-list':  'shopping-list/shopping-list.pdf',
  'daily-plan':     'daily-plan/daily-plan.pdf',
};

/* ── Signed URL expiry: 1 hour ──────────────────────────────────────────── */
const SIGNED_URL_EXPIRY_SECONDS = 3600;

module.exports = async function handler(req, res) {

  /* ── CORS preflight ─────────────────────────────────────────────────────── */
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  /* ── CORS on all responses ──────────────────────────────────────────────── */
  res.setHeader('Access-Control-Allow-Origin', '*');

  /* ── Only allow POST ────────────────────────────────────────────────────── */
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ── Validate Authorization header ─────────────────────────────────────── */
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Authorization required. Please sign in and try again.' });
  }

  /* ── Parse and validate request body ───────────────────────────────────── */
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }

  const fileKey = body.file;
  if (!fileKey || !FILE_PATHS[fileKey]) {
    return res.status(400).json({
      error: `Invalid or missing "file" param. Accepted values: ${Object.keys(FILE_PATHS).join(', ')}.`,
    });
  }

  /* ── Read Supabase config from server environment ───────────────────────── */
  const supabaseUrl    = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in environment');
    return res.status(500).json({ error: 'Storage service not configured.' });
  }

  /* ── Create service-role Supabase client (server-side only) ─────────────── */
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  /* ── Validate the user JWT ──────────────────────────────────────────────── */
  // getUser() validates the JWT signature against Supabase auth.
  // Returns 401 if the token is missing, malformed, or expired.
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }

  /* ── Generate signed URL ────────────────────────────────────────────────── */
  const { data, error: storageError } = await supabase.storage
    .from('downloads')
    .createSignedUrl(FILE_PATHS[fileKey], SIGNED_URL_EXPIRY_SECONDS);

  if (storageError || !data?.signedUrl) {
    console.error('Supabase Storage signed URL error:', storageError);
    return res.status(500).json({ error: 'Failed to generate download link. Please try again.' });
  }

  /* ── Return signed URL ──────────────────────────────────────────────────── */
  return res.status(200).json({ url: data.signedUrl });
};
