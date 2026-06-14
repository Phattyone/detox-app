/* ═══════════════════════════════════════════════════════════════════════════
   stripe-checkout.js  —  Vercel serverless function: create Stripe Checkout session

   Validates the requesting user's JWT, then creates a Stripe Checkout session
   for the requested price. Returns a redirect URL to the Stripe hosted page.
   The Stripe secret key never leaves the server.

   -- CONNECT: VERCEL ENV --
   Set these in Vercel Dashboard → Project Settings → Environment Variables:
     SUPABASE_URL              — your project URL (Settings → API)
     SUPABASE_SERVICE_ROLE_KEY — service role secret (Settings → API)
     STRIPE_SECRET_KEY         — sk_test_... or sk_live_...

   Local development:
   - Add all vars to .env.local in the detox-app/ directory
   - Run `vercel dev` — it reads .env.local automatically
   ═══════════════════════════════════════════════════════════════════════════ */

const Stripe        = require('stripe');
const { createClient } = require('@supabase/supabase-js');

/* ── Price ID → plan name mapping (for success_url plan param) ──────────── */
const PRICE_TO_PLAN = {
  'price_1TiGwgFVIq4JLJVkXkxIkaHO': 'basic',
  'price_1TiGxVFVIq4JLJVkOzQ8G7Pd': 'seasonal',
  'price_1TiGxuFVIq4JLJVkbhJdXGHp': 'premium',
  'price_1TiGyNFVIq4JLJVk5zkbySPB': 'premium',
  'price_1TiHP1FVIq4JLJVkfx3WizFV': 'lifetime',
  'price_1TiH0sFVIq4JLJVkQimq6F7h': 'bundle',
  'price_1TiH7yFVIq4JLJVkxeKtC00D': 'guide',
  'price_1TiHCtFVIq4JLJVkVZLwKxQD': 'guide',
  'price_1TiHDHFVIq4JLJVklAq7dWKX': 'spreadsheet',
};

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

  const { priceId, mode } = body;
  if (!priceId) {
    return res.status(400).json({ error: 'Missing required field: priceId.' });
  }
  if (mode !== 'payment' && mode !== 'subscription') {
    return res.status(400).json({ error: 'Invalid mode. Must be "payment" or "subscription".' });
  }

  /* ── Read config from server environment ────────────────────────────────── */
  const supabaseUrl    = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey      = process.env.STRIPE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    return res.status(500).json({ error: 'Service not configured.' });
  }
  if (!stripeKey) {
    console.error('STRIPE_SECRET_KEY not set');
    return res.status(500).json({ error: 'Payment service not configured.' });
  }

  /* ── Validate the user JWT and get user info ────────────────────────────── */
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }

  const userId = user.id;
  const email  = user.email;

  /* ── Create Stripe Checkout session ─────────────────────────────────────── */
  const stripe  = Stripe(stripeKey);
  const plan    = PRICE_TO_PLAN[priceId] || 'premium';
  const baseUrl = 'https://organicdetoxcleanse.com';

  try {
    const session = await stripe.checkout.sessions.create({
      mode,
      customer_email: email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}?checkout=success&plan=${plan}`,
      cancel_url:  `${baseUrl}?checkout=cancelled`,
      metadata: { userId, priceId },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('stripe-checkout: Stripe error:', err);
    return res.status(500).json({ error: 'Failed to create checkout session. Please try again.' });
  }
};
