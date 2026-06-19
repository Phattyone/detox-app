/* ═══════════════════════════════════════════════════════════════════════════
   photo-url.js  —  Vercel serverless function: get signed photo URL

   GET ?day=3  →  { url: "https://..." } or { url: null } if not found

   -- CONNECT: VERCEL ENV --
   SUPABASE_URL             — project URL
   SUPABASE_SERVICE_ROLE_KEY — service role key (server-side only)
   ═══════════════════════════════════════════════════════════════════════════ */

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {

  /* ── CORS preflight ─────────────────────────────────────────────────────── */
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ── Validate JWT ───────────────────────────────────────────────────────── */
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const supabaseUrl    = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('photo-url: missing Supabase env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  /* ── Validate day param ─────────────────────────────────────────────────── */
  const day = parseInt(req.query.day, 10);
  if (!day || day < 1 || day > 7) {
    return res.status(400).json({ error: 'day query param must be 1–7' });
  }

  const storagePath = `${user.id}/${day}.jpg`;

  /* ── Check the file exists ──────────────────────────────────────────────── */
  const { data: list, error: listErr } = await sb.storage
    .from('photos')
    .list(user.id, { search: `${day}.jpg` });

  if (listErr) {
    console.error('photo-url: list error:', listErr.message);
    return res.status(500).json({ error: 'Storage error' });
  }

  const exists = list && list.some(f => f.name === `${day}.jpg`);
  if (!exists) return res.status(200).json({ url: null });

  /* ── Return signed URL (1 hour) ─────────────────────────────────────────── */
  const { data: urlData, error: urlErr } = await sb.storage
    .from('photos')
    .createSignedUrl(storagePath, 3600);

  if (urlErr || !urlData?.signedUrl) {
    console.error('photo-url: signed URL error:', urlErr?.message);
    return res.status(500).json({ error: 'Could not generate URL' });
  }

  return res.status(200).json({ url: urlData.signedUrl });
};
