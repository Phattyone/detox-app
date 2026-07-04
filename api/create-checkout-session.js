/* ═══════════════════════════════════════════════════════════════════════════
   create-checkout-session.js  —  Vercel serverless function

   Creates a Stripe Checkout session for the requested price and returns the
   hosted checkout URL. Looks up or creates a Stripe customer keyed on the
   user's email so repeat purchases attach to a single customer record. The
   Stripe secret key is read from the server environment and never leaves the
   server.

   -- CONNECT: VERCEL ENV --
   Set in Vercel Dashboard, Project Settings, Environment Variables:
     STRIPE_SECRET_KEY  sk_test_... or sk_live_...
   ═══════════════════════════════════════════════════════════════════════════ */

const Stripe = require('stripe');

/* ── Recurring price IDs. Anything not listed here is a one time payment. ─── */
const RECURRING_PRICE_IDS = new Set([
  'price_1TiGwgFVIq4JLJVkXkxIkaHO', // Basic monthly
  'price_1TiGxuFVIq4JLJVkbhJdXGHp', // Premium monthly
  'price_1TiGxVFVIq4JLJVkOzQ8G7Pd', // Seasonal Reset annual
  'price_1TiGyNFVIq4JLJVk5zkbySPB', // Premium annual
]);

module.exports = async function handler(req, res) {

  /* ── CORS headers on every response ─────────────────────────────────────── */
  res.setHeader('Access-Control-Allow-Origin',  'https://organicdetoxcleanse.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  /* ── Preflight ──────────────────────────────────────────────────────────── */
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  /* ── Only allow POST ────────────────────────────────────────────────────── */
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ── Read config from server environment ────────────────────────────────── */
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error('create-checkout-session: STRIPE_SECRET_KEY not set');
    return res.status(500).json({ error: 'Internal server error' });
  }

  /* ── Parse and validate request body ────────────────────────────────────── */
  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON in request body.' });
  }

  const { priceId, userId, userEmail } = body;
  if (!priceId || !userId || !userEmail) {
    return res.status(400).json({ error: 'Missing required field. priceId, userId, and userEmail are all required.' });
  }

  const stripe = Stripe(stripeKey);

  try {
    /* ── Look up an existing Stripe customer by email, or create one ──────── */
    let customerId;
    const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (existing.data && existing.data.length > 0) {
      customerId = existing.data[0].id;
    } else {
      const created = await stripe.customers.create({
        email: userEmail,
        metadata: { supabase_user_id: userId },
      });
      customerId = created.id;
    }

    /* ── Recurring prices use subscription mode, everything else payment ──── */
    const mode = RECURRING_PRICE_IDS.has(priceId) ? 'subscription' : 'payment';

    /* ── Build the Checkout session ──────────────────────────────────────── */
    const params = {
      customer:    customerId,
      line_items:  [{ price: priceId, quantity: 1 }],
      mode:        mode,
      success_url: 'https://organicdetoxcleanse.com/thank-you.html?session_id={CHECKOUT_SESSION_ID}',
      cancel_url:  'https://organicdetoxcleanse.com',
      metadata:    { supabase_user_id: userId },
    };
    if (mode === 'subscription') {
      params.subscription_data = { metadata: { supabase_user_id: userId } };
    }

    const session = await stripe.checkout.sessions.create(params);

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('create-checkout-session: error creating checkout session:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
