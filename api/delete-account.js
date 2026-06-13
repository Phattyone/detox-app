/* ═══════════════════════════════════════════════════════════════════════════
   delete-account.js  —  Vercel serverless function: permanent account deletion

   Validates the requesting user's JWT, then uses the Supabase service role
   key to delete all user data from every table and remove the auth.users
   record. Must run server-side — deleteUser() requires the service role key
   which must never be exposed to the browser.

   -- CONNECT: VERCEL ENV --
   Set these in Vercel Dashboard → Project Settings → Environment Variables:
     SUPABASE_URL              — your project URL (Settings → API)
     SUPABASE_SERVICE_ROLE_KEY — service role secret (Settings → API)

   Local development:
   - Add both vars to .env.local in the detox-app/ directory
   - Run `vercel dev` — it reads .env.local automatically
   ═══════════════════════════════════════════════════════════════════════════ */

const { createClient } = require('@supabase/supabase-js');

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

  /* ── Read Supabase config from server environment ───────────────────────── */
  const supabaseUrl    = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set in environment');
    return res.status(500).json({ error: 'Deletion service not configured.' });
  }

  /* ── Create service-role Supabase client (server-side only) ─────────────── */
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  /* ── Validate the user JWT and get user ID ──────────────────────────────── */
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }

  const userId = user.id;

  /* ── Delete all user table rows before deleting auth.users ─────────────── */
  // Order: child tables first to avoid any FK constraint issues.
  // profiles has ON DELETE CASCADE from auth.users but we delete it explicitly.
  const tables = [
    'daily_progress',
    'body_metrics',
    'gamification',
    'companion_state',
    'past_cleanses',
    'profiles',
  ];

  for (const table of tables) {
    const col = table === 'profiles' ? 'id' : 'user_id';
    const { error } = await supabase.from(table).delete().eq(col, userId);
    if (error) {
      console.error(`delete-account: failed to delete from ${table}:`, error);
      return res.status(500).json({ error: `Failed to delete user data from ${table}.` });
    }
  }

  /* ── Delete the auth.users record ──────────────────────────────────────── */
  const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    console.error('delete-account: auth.admin.deleteUser failed:', deleteUserError);
    return res.status(500).json({ error: 'Failed to delete account. Please try again.' });
  }

  return res.status(200).json({ success: true });
};
