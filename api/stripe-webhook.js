/* ═══════════════════════════════════════════════════════════════════════════
   stripe-webhook.js  —  Vercel serverless function: Stripe webhook handler

   Verifies Stripe webhook signatures and handles post-payment events.
   Upgrades user plans in Supabase after successful checkout, and downgrades
   on subscription cancellation.

   -- CONNECT: VERCEL ENV --
   Set these in Vercel Dashboard → Project Settings → Environment Variables:
     SUPABASE_URL              — your project URL (Settings → API)
     SUPABASE_SERVICE_ROLE_KEY — service role secret (Settings → API)
     STRIPE_SECRET_KEY         — sk_test_... or sk_live_...
     STRIPE_WEBHOOK_SECRET     — whsec_... from Stripe Dashboard → Webhooks

   -- STRIPE DASHBOARD SETUP --
   1. Go to Stripe Dashboard → Developers → Webhooks
   2. Add endpoint: https://organicdetoxcleanse.com/api/stripe-webhook
   3. Select events: checkout.session.completed, customer.subscription.deleted
   4. Copy the signing secret (whsec_...) to STRIPE_WEBHOOK_SECRET env var

   -- SUPABASE SQL --
   Run in Supabase SQL Editor:
     ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

   Local development:
   - Use Stripe CLI: stripe listen --forward-to localhost:3000/api/stripe-webhook
   - The CLI prints a webhook secret to use as STRIPE_WEBHOOK_SECRET locally
   ═══════════════════════════════════════════════════════════════════════════ */

const Stripe        = require('stripe');
const { createClient } = require('@supabase/supabase-js');

/* ── Price ID → plan name mapping ───────────────────────────────────────── */
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

/* ── Plans that grant subscription-level access ─────────────────────────── */
const SUBSCRIPTION_PLANS = new Set(['basic', 'seasonal', 'premium', 'lifetime']);

/* ── Add-on flags written to user_metadata ──────────────────────────────── */
const ADDON_FLAGS = {
  guide:       { has_guide:        true },
  spreadsheet: { has_spreadsheet:  true },
  bundle:      { has_guide:        true, has_spreadsheet: true },
};

/* ── Read raw request body (required for Stripe signature verification) ─── */
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => { raw += chunk.toString('utf8'); });
    req.on('end',  () => resolve(raw));
    req.on('error', reject);
  });
}

const handler = async function (req, res) {

  /* ── Only allow POST ────────────────────────────────────────────────────── */
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ── Read config from server environment ────────────────────────────────── */
  const supabaseUrl    = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const stripeKey      = process.env.STRIPE_SECRET_KEY;
  const webhookSecret  = process.env.STRIPE_WEBHOOK_SECRET;

  if (!supabaseUrl || !serviceRoleKey || !stripeKey || !webhookSecret) {
    console.error('stripe-webhook: missing environment variables');
    return res.status(500).json({ error: 'Webhook service not configured.' });
  }

  const stripe   = Stripe(stripeKey);
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  /* ── Verify Stripe webhook signature ────────────────────────────────────── */
  const rawBody   = await getRawBody(req);
  const signature = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('stripe-webhook: signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook signature verification failed: ${err.message}` });
  }

  /* ── Handle events ──────────────────────────────────────────────────────── */

  if (event.type === 'checkout.session.completed') {
    // Retrieve the full session with line_items so the price ID is available
    // even for checkouts created by create-checkout-session.js, which does not
    // copy the price ID into session metadata.
    let session = event.data.object;
    try {
      session = await stripe.checkout.sessions.retrieve(event.data.object.id, { expand: ['line_items'] });
    } catch (retrieveErr) {
      console.error('stripe-webhook: failed to retrieve full session, falling back to event payload:', retrieveErr);
    }

    // Accept both metadata shapes: supabase_user_id (create-checkout-session.js)
    // and userId (stripe-checkout.js). The price ID may come from line_items
    // (new path) or metadata.priceId (old path).
    const userId     = session.metadata?.supabase_user_id || session.metadata?.userId;
    const priceId    = session.line_items?.data?.[0]?.price?.id || session.metadata?.priceId;
    const customerId = session.customer;

    if (!userId || !priceId) {
      console.error('stripe-webhook: checkout.session.completed missing metadata', session.metadata);
      return res.status(400).json({ error: 'Missing session metadata.' });
    }

    const plan = PRICE_TO_PLAN[priceId];
    if (!plan) {
      console.error('stripe-webhook: unknown priceId:', priceId);
      return res.status(400).json({ error: `Unknown priceId: ${priceId}` });
    }

    // Store stripe_customer_id so subscription.deleted can find the user.
    // Also record the price ID for every completed checkout, and the
    // subscription ID when this checkout created a subscription.
    if (customerId) {
      const idUpdate = { stripe_customer_id: customerId, stripe_price_id: priceId };
      if (session.subscription) idUpdate.stripe_subscription_id = session.subscription;
      const { error: idErr } = await supabase
        .from('profiles')
        .update(idUpdate)
        .eq('id', userId);
      if (idErr) console.error('stripe-webhook: profiles customer/price update failed:', idErr);
      else console.log(`stripe-webhook: recorded stripe ids for userId=${userId}, priceId=${priceId}`);
    }

    if (SUBSCRIPTION_PLANS.has(plan)) {
      // Upgrade the user's subscription plan
      await supabase.auth.admin.updateUserById(userId, {
        user_metadata: { plan },
      });
      const { error } = await supabase
        .from('profiles')
        .update({ plan })
        .eq('id', userId);
      if (error) console.error('stripe-webhook: profiles plan update failed:', error);
    } else if (ADDON_FLAGS[plan]) {
      // Write add-on flags to user_metadata (preserve existing metadata)
      const { data: { user }, error: fetchErr } = await supabase.auth.admin.getUserById(userId);
      if (!fetchErr && user) {
        const updatedMeta = { ...(user.user_metadata || {}), ...ADDON_FLAGS[plan] };
        await supabase.auth.admin.updateUserById(userId, { user_metadata: updatedMeta });
      }
      // Mirror flags to profiles for fast server-side reads
      const { error } = await supabase
        .from('profiles')
        .update(ADDON_FLAGS[plan])
        .eq('id', userId);
      if (error) console.error('stripe-webhook: profiles addon update failed:', error);
    }

    console.log(`stripe-webhook: checkout.session.completed — userId=${userId}, plan=${plan}`);
  }

  else if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const customerId   = subscription.customer;

    // Prefer supabase_user_id from the subscription metadata, set by
    // create-checkout-session.js. Fall back to the stored stripe_customer_id
    // lookup for subscriptions created by the older checkout path.
    let userId = subscription.metadata?.supabase_user_id;

    if (!userId) {
      // Find the user by stored Stripe customer ID
      const { data: profile, error: lookupErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (lookupErr || !profile) {
        console.warn('stripe-webhook: customer.subscription.deleted — user not found for customerId:', customerId);
        return res.status(200).json({ received: true }); // return 200 so Stripe doesn't retry
      }

      userId = profile.id;
    }

    // Downgrade to free plan and clear the subscription references
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: { plan: 'free' },
    });
    const { error } = await supabase
      .from('profiles')
      .update({ plan: 'free', stripe_subscription_id: null, stripe_price_id: null })
      .eq('id', userId);
    if (error) console.error('stripe-webhook: profiles downgrade failed:', error);

    console.log(`stripe-webhook: customer.subscription.deleted — userId=${userId} downgraded to free`);
  }

  return res.status(200).json({ received: true });
};

// Tell Vercel not to parse the body so we can verify the Stripe signature
handler.config = { api: { bodyParser: false } };

module.exports = handler;
