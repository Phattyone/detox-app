/* ═══════════════════════════════════════════════════════════════════════════
   photo-upload.js  —  Vercel serverless function: progress photo storage

   POST  { file: "data:image/jpeg;base64,...", day: 3 }  → { url: signedUrl }
   DELETE { day: 3 }  → { success: true }

   Photos stored at: photos/{userId}/{day}.jpg in Supabase Storage bucket "photos"
   Bucket must exist and have RLS disabled (service role manages all access).

   -- CONNECT: VERCEL ENV --
   SUPABASE_URL             — project URL
   SUPABASE_SERVICE_ROLE_KEY — service role key (server-side only, never in browser)
   ═══════════════════════════════════════════════════════════════════════════ */

const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {

  /* ── CORS preflight ─────────────────────────────────────────────────────── */
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ── Validate JWT ───────────────────────────────────────────────────────── */
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const supabaseUrl     = process.env.SUPABASE_URL;
  const serviceRoleKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('photo-upload: missing Supabase env vars');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error: authErr } = await sb.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  const userId = user.id;

  /* ── Parse body ─────────────────────────────────────────────────────────── */
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch(e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const day = parseInt(body.day, 10);
  if (!day || day < 1 || day > 7) {
    return res.status(400).json({ error: 'day must be 1–7' });
  }

  const storagePath = `${userId}/${day}.jpg`;

  /* ── DELETE handler ─────────────────────────────────────────────────────── */
  if (req.method === 'DELETE') {
    const { error: removeErr } = await sb.storage.from('photos').remove([storagePath]);
    if (removeErr) {
      console.error('photo-upload: delete error:', removeErr.message);
      return res.status(500).json({ error: 'Failed to delete photo' });
    }
    return res.status(200).json({ success: true });
  }

  /* ── POST: validate base64 file ─────────────────────────────────────────── */
  const { file } = body;
  if (!file || typeof file !== 'string') {
    return res.status(400).json({ error: 'file (base64 data URL) is required' });
  }

  // Strip "data:image/...;base64," prefix
  const commaIdx = file.indexOf(',');
  if (commaIdx === -1) return res.status(400).json({ error: 'Invalid data URL format' });
  const base64Data = file.slice(commaIdx + 1);

  let buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch(e) {
    return res.status(400).json({ error: 'Could not decode base64 data' });
  }

  if (buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'File exceeds 5 MB limit' });
  }

  /* ── Upload to Supabase Storage ─────────────────────────────────────────── */
  const { error: uploadErr } = await sb.storage
    .from('photos')
    .upload(storagePath, buffer, {
      contentType: 'image/jpeg',
      upsert:      true,
    });

  if (uploadErr) {
    console.error('photo-upload: upload error:', uploadErr.message);
    return res.status(500).json({ error: 'Failed to upload photo' });
  }

  /* ── Return a signed URL (1 hour) ───────────────────────────────────────── */
  const { data: urlData, error: urlErr } = await sb.storage
    .from('photos')
    .createSignedUrl(storagePath, 3600);

  if (urlErr || !urlData?.signedUrl) {
    console.error('photo-upload: signed URL error:', urlErr?.message);
    return res.status(500).json({ error: 'Photo uploaded but could not generate URL' });
  }

  return res.status(200).json({ url: urlData.signedUrl });
};
