/* ═══════════════════════════════════════════════════════════════════════════
   AUTH.JS  -  Authentication, Membership, and Payment Logic
   ═══════════════════════════════════════════════════════════════════════════

   DEVELOPER INTEGRATION NOTES:
   ─────────────────────────────
   This file contains all the frontend logic for auth and payments.
   Two backend services need to be connected:

   1. SUPABASE (auth + database)
      - Sign up at https://supabase.com (free tier available)
      - Create a project, get your URL and anon key
      - Replace SUPABASE_URL and SUPABASE_ANON_KEY below
      - Run the SQL schema at the bottom of this file in Supabase SQL editor

   2. STRIPE (payments)
      - Sign up at https://stripe.com
      - Create products for each membership tier
      - Get your publishable key, replace STRIPE_PUBLISHABLE_KEY below
      - Set up a backend endpoint (Supabase Edge Function recommended)
        to create Stripe Checkout sessions and handle webhooks
      - Replace STRIPE_ENDPOINT below with your Edge Function URL

   All integration points are marked with: // ── CONNECT: [SERVICE] ──
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── CONFIGURATION ────────────────────────────────────────────────────────── */

// ── CONNECT: SUPABASE ──
// Values are injected at runtime from window.ENV (set in index.html).
// The anon key is safe to expose in the browser — Row Level Security protects data.
const SUPABASE_URL      = (window.ENV && window.ENV.SUPABASE_URL)      || '';
const SUPABASE_ANON_KEY = (window.ENV && window.ENV.SUPABASE_ANON_KEY) || '';

// ── CONNECT: STRIPE ──
// Replace with your Stripe publishable key (starts with pk_live_ or pk_test_)
const STRIPE_PUBLISHABLE_KEY = 'YOUR_STRIPE_PUBLISHABLE_KEY';

// ── CONNECT: STRIPE CHECKOUT ENDPOINT ──
// Your Supabase Edge Function URL that creates Stripe Checkout sessions
const STRIPE_ENDPOINT = 'YOUR_SUPABASE_EDGE_FUNCTION_URL/create-checkout';

/* ── SUPABASE CLIENT ─────────────────────────────────────────────────────── */
// Initialized when credentials are set in window.ENV.
// window.supabase is provided by the CDN script loaded in index.html before auth.js.
const sbClient = (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Export to window so app.js sync functions can reach the client.
window.sbClient = sbClient;

/* ── MEMBERSHIP TIERS ─────────────────────────────────────────────────────── */
const PLANS = {
  free: {
    id:          'free',
    name:        'Free',
    price:       0,
    period:      '',
    priceLabel:  '$0',
    ctaLabel:    'Get Started Free',
    description: 'Start exploring before you commit.',
    color:       'var(--mid-gray)',
    features: [
      { text: 'Morning routine',               included: true  },
      { text: 'Night-before checklist',        included: true  },
      { text: 'Recipe browsing with swap UI',  included: true  },
      { text: 'Shop browsing',                 included: true  },
      { text: 'Full 7-day meal plan',          included: false },
      { text: 'Complete recipe instructions',  included: false },
      { text: 'Progress tracker & journal',    included: false },
      { text: 'Meal generator',                included: false },
    ],
    // ── CONNECT: STRIPE ── No price ID needed for free plan
    stripePriceId: null,
  },

  basic: {
    id:          'basic',
    name:        'Basic',
    price:       7.99,
    period:      'month',
    priceLabel:  '$7.99',
    ctaLabel:    'Start Basic',
    description: 'Full program access. Everything you need for all 7 days.',
    color:       'var(--teal)',
    features: [
      { text: 'Everything in Free',            included: true  },
      { text: 'Full 7-day meal plan',          included: true  },
      { text: 'Complete recipes & instructions',included: true  },
      { text: 'Progress tracker & journal',    included: true  },
      { text: 'Water tracker',                 included: true  },
      { text: 'Meal generator',                included: true  },
      { text: 'Shopping list email',           included: true  },
      { text: 'Advanced Cleanse program',      included: false },
    ],
    // ── CONNECT: STRIPE ── Replace with your Stripe Price ID
    stripePriceId: 'price_BASIC_MONTHLY_799',
  },

  seasonal: {
    id:          'seasonal',
    name:        'Seasonal Reset',
    price:       34.99,
    period:      'year',
    priceLabel:  '$34.99',
    ctaLabel:    'Go Seasonal',
    description: 'Do the cleanse up to 3 times per year — the way it was designed.',
    color:       'var(--md-green)',
    badge:       'Best Value',
    badgeClass:  'plan-badge-seasonal',
    features: [
      { text: 'Everything in Basic',                   included: true  },
      { text: '3 guided seasonal resets per year',     included: true  },
      { text: 'Reset history across cleanses',         included: true  },
      { text: 'Seasonal reminder notifications',       included: true  },
      { text: 'Early access to new content',           included: true  },
      { text: 'Advanced Cleanse program',              included: false },
    ],
    // ── CONNECT: STRIPE ── Replace with your Stripe Price ID
    stripePriceId: 'price_SEASONAL_ANNUAL_3499',
  },

  premium: {
    id:          'premium',
    name:        'Premium',
    price:       59.99,
    period:      'year',
    priceLabel:  '$59.99',
    priceAlt:    'or $12.99/mo',
    ctaLabel:    'Go Premium',
    description: 'The complete program plus the Advanced Cleanse.',
    color:       'var(--amber)',
    badge:       'Full Access',
    badgeClass:  'plan-badge-premium',
    features: [
      { text: 'Everything in Seasonal',               included: true  },
      { text: 'Advanced Cleanse program',             included: true  },
      { text: 'Digital guide (PDF viewer in app)',    included: true  },
      { text: 'Interactive spreadsheet download',     included: true  },
      { text: 'All future content included',          included: true  },
    ],
    // ── CONNECT: STRIPE ── Replace with your Stripe Price IDs
    stripePriceId:          'price_PREMIUM_ANNUAL_5999',
    stripePriceIdMonthly:   'price_PREMIUM_MONTHLY_1299',
  },

  lifetime: {
    id:          'lifetime',
    name:        'Lifetime',
    price:       169.99,
    period:      'once',
    priceLabel:  '$169.99',
    ctaLabel:    'Get Lifetime Access',
    description: 'Pay once, own it forever. All future updates included.',
    color:       'var(--dk-green)',
    badge:       'Own It Forever',
    badgeClass:  'plan-badge-lifetime',
    features: [
      { text: 'Everything in Premium',        included: true  },
      { text: 'Pay once, never again',        included: true  },
      { text: 'All future updates',           included: true  },
      { text: 'Founding Member badge',        included: true  },
    ],
    // ── CONNECT: STRIPE ── Replace with your Stripe Price ID
    stripePriceId: 'price_LIFETIME_ONETIME_16999',
  },
};

/* ── CONTENT ACCESS RULES ─────────────────────────────────────────────────── */
// Granular feature keys:
//   morning          = Day 1 morning routine (free)
//   checklist-2      = First 2 checklist items (free)
//   checklist-full   = All 6 checklist items (paid)
//   day1-full        = Day 1 breakfast through evening (paid)
//   days2to7         = Days 2-7 full plan (paid)
//   recipes-swap-ui  = Dropdown UI visible (free - creates desire)
//   recipes-full     = Recipe instructions unlocked (paid)
//   shop-browse      = See item names and notes (free)
//   shop-links       = Shop Now links clickable (paid)
//   tracker          = Full tracker and journal (paid)
//   generator        = Random meal generator (paid)
//   advanced         = Advanced Cleanse content (premium+)
//   seasonal         = Seasonal reset features (seasonal+)
//   admin            = Admin dashboard access
//   tester           = All paid features, feedback tools

const ALL_PAID = ['morning','checklist-2','checklist-full','day1-full','days2to7',
  'recipes-swap-ui','recipes-full','shop-browse','shop-links','tracker','generator',
  'photos',          // Task 3: progress photo upload (Basic+)
  'downloads-basic', // Task 7: shopping list + cleansing plan download (Basic+)
];

// ── Premium-exclusive feature keys (Fix 7 + Round 2) ───────────────────────
// -- BUILD: cleanse-history     -- Round 3: persist + surface cross-cleanse data
// -- BUILD: trend-charts        -- Round 3: chart weekly/monthly progress trends
// -- BUILD: custom-notifications-- Round 3: full notification schedule editor
// -- BUILD: progress-pdf        -- Round 3: generate downloadable PDF summary
// -- BUILD: priority-support    -- Round 3: priority support badge + contact form
// -- BUILD: founding-badge      -- Round 3: Lifetime founding member badge display
const ALL_PREMIUM_EXCLUSIVE = [
  'cleanse-history', 'trend-charts', 'custom-notifications',
  'progress-pdf', 'priority-support',
];

const ALL_FEATURES = [
  ...ALL_PAID, 'advanced','seasonal','admin','tester',
  ...ALL_PREMIUM_EXCLUSIVE, 'founding-badge',
  'ai-coach',        // Task 2: AI Cleanse Coach chat (Seasonal+)
  'guide-pdf',       // Task 6: in-app PDF guide viewer (Premium+)
  'downloads-premium',// Task 7: spreadsheet + guide PDF download (Premium+)
];

const ACCESS = {
  free:     ['morning','checklist-2','recipes-swap-ui','shop-browse'],
  basic:    [...ALL_PAID],
  premium:  [...ALL_PAID, 'advanced', 'seasonal', ...ALL_PREMIUM_EXCLUSIVE,
             'ai-coach', 'guide-pdf', 'downloads-premium'],
  seasonal: [...ALL_PAID, 'advanced','seasonal',
             'ai-coach'],
  lifetime: [...ALL_PAID, 'advanced','seasonal', ...ALL_PREMIUM_EXCLUSIVE, 'founding-badge',
             'ai-coach', 'guide-pdf', 'downloads-premium'],
  admin:    [...ALL_FEATURES],
  tester:   [...ALL_PAID, 'advanced','tester',
             'ai-coach', 'guide-pdf', 'downloads-premium'],
};

/* ── AUTH STATE ───────────────────────────────────────────────────────────── */
const AUTH = {
  user:    null,   // { id, email, name, role }
  userId:  null,   // Supabase UUID — flat alias for AUTH.user.id, used by sync functions
  plan:    'free', // current plan id: free|basic|premium|seasonal|lifetime|admin|tester
  role:    'user', // user | admin | tester
  loading: false,
};

function getUserPlan()    { return AUTH.plan; }
function isLoggedIn()     { return AUTH.user !== null; }
function isAdmin()        { return AUTH.role === 'admin'; }
function isTester()       { return AUTH.role === 'tester' || AUTH.role === 'admin'; }
function canAccess(feat)  { return ACCESS[getUserPlan()]?.includes(feat) ?? false; }

/* ── ADMIN / TESTER REFERENCE ───────────────────────────────────────────────
   Admin and tester accounts are managed in the Supabase dashboard.
   Set user_metadata.role = 'admin' or 'tester' for each account there.
   ADMIN_EMAIL is also used as a role-detection fallback in _applySession().
   TESTER_ACCOUNTS is kept for the admin dashboard display list only —
   passwords are managed in Supabase, not here.
   ─────────────────────────────────────────────────────────────────────────── */
const ADMIN_EMAIL = 'phatwil@gmail.com';   // Admin email — manage in Supabase dashboard

// Tester account reference list (admin dashboard display only).
// Passwords are set in Supabase. Add or remove entries to update the display list.
const TESTER_ACCOUNTS = [
  { email: 'daasmith1981@yahoo.com',     name: 'Tester 1'  },
  { email: 'k5udy54s@gmail.com',         name: 'Tester 2'  },
  { email: 'giovahni@mtzins.com',        name: 'Tester 3'  },
  { email: 'sandrahyacinth74@yahoo.com', name: 'Tester 4'  },
  { email: 'faradehunicorns@gmail.com',  name: 'Tester 5'  },
  { email: 'tester6@example.com',        name: 'Tester 6'  },
  { email: 'tester7@example.com',        name: 'Tester 7'  },
  { email: 'tester8@example.com',        name: 'Tester 8'  },
  { email: 'tester9@example.com',        name: 'Tester 9'  },
  { email: 'tester10@example.com',       name: 'Tester 10' },
];

/* ── SESSION HELPERS ─────────────────────────────────────────────────────── */

// Populate AUTH from a Supabase session object.
function _applySession(session) {
  if (!session || !session.user) return;
  const u    = session.user;
  const meta = u.user_metadata || {};
  const name = meta.full_name || meta.name || u.email;

  AUTH.user         = { id: u.id, email: u.email, name, access_token: session.access_token };
  AUTH.userId       = u.id;   // flat alias — safe to reference without nested access
  AUTH.access_token = session.access_token;

  _validateCleanseOwner();

  // Role: prefer metadata, fall back to email-match for admin
  const role = meta.role || (u.email === ADMIN_EMAIL ? 'admin' : 'user');
  AUTH.role  = role;

  // Plan: role-based overrides take priority
  if      (role === 'admin')  AUTH.plan = 'admin';
  else if (role === 'tester') AUTH.plan = 'tester';
  else                        AUTH.plan = meta.plan || 'free';
}

// Reset AUTH to signed-out state.
function _clearSession() {
  AUTH.user         = null;
  AUTH.userId       = null;
  AUTH.plan         = 'free';
  AUTH.role         = 'user';
  AUTH.access_token = null;
}

// Clear cleanseStartDate if it was written by a different user.
// healthScreeningComplete is now stored per user ID so it is not touched here.
// Called after AUTH.userId is set so the comparison is valid.
// Returns false when a mismatch is detected, true otherwise.
function _validateCleanseOwner() {
  const storedUserId = localStorage.getItem('cleanseUserId');
  if (storedUserId && storedUserId !== AUTH.userId) {
    localStorage.removeItem('cleanseStartDate');
    localStorage.removeItem('cleanseUserId');
    return false;
  }
  return true;
}

// Fast synchronous restore from Supabase's own localStorage cache.
// Prevents a flash of unauthenticated content on page refresh before
// the async getSession() call completes.
function _syncLoadSession() {
  if (!sbClient || !SUPABASE_URL) return;
  try {
    const projectRef = SUPABASE_URL.replace(/https?:\/\//, '').split('.')[0];
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return;
    const stored  = JSON.parse(raw);
    const session = stored.currentSession || stored;
    if (session && session.access_token && session.user) {
      // Only apply if the token hasn't expired (expires_at is Unix seconds)
      if (!session.expires_at || Date.now() / 1000 < session.expires_at - 60) {
        _applySession(session);
      }
    }
  } catch(e) { /* ignore malformed cache */ }
}

// No-op stubs — kept so any surviving call sites don't throw.
function saveDemoUser() {}
function loadDemoUser()  {}

/* ── AUTH FUNCTIONS ───────────────────────────────────────────────────────── */

async function signUp(name, email, password) {
  if (!sbClient) throw new Error('Authentication service not configured. Please contact support.');
  if (!name || !email || !password) throw new Error('Please fill in all fields.');
  if (password.length < 8) throw new Error('Password must be at least 8 characters.');

  const { data, error } = await sbClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: 'https://organicdetoxcleanse.com',
      data: { full_name: name, plan: 'free' },
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('already exists') || msg.includes('user already')) {
      throw new Error('An account with this email already exists. Please sign in.');
    }
    throw new Error(error.message);
  }

  // data.session is null when email confirmation is required (Supabase default).
  // data.session is set when email confirmation is disabled in the Supabase dashboard.
  if (data.session) _applySession(data.session);
  return { needsVerification: !data.session, session: data.session };
}

async function signIn(email, password) {
  if (!sbClient) throw new Error('Authentication service not configured. Please contact support.');
  if (!email || !password) throw new Error('Please enter your email and password.');

  const { data, error } = await sbClient.auth.signInWithPassword({ email, password });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
      throw new Error('Please verify your email before signing in. Check your inbox for a confirmation link.');
    }
    throw new Error('Incorrect email or password. Please try again.');
  }

  _applySession(data.session);
  return AUTH.user;
}

async function signOut() {
  // 1. Sign out from Supabase (invalidates server-side session + clears sb-* keys)
  if (sbClient) await sbClient.auth.signOut();

  // 2. Clear session-specific localStorage data (progress, state, badges).
  //
  //    Intentionally PRESERVED across sign-out (survive to next login):
  //      detox_email_list        — marketing capture data, not session data
  //      healthScreeningComplete — shows only once; cleared by "Reset My Cleanse"
  //      cleanseStartDate        — user set this; should not re-prompt on every login
  //      cleanseUserId           — paired with cleanseStartDate; _applySession() uses it
  //                                to detect a different user logging in and clear the date
  //      cleanseSchedule         — user-configured reminder schedule
  //      scheduleCollapsed       — UI preference (scheduler panel open/closed)
  //      avoidListCollapsed      — UI preference (avoid list open/closed)
  Object.keys(localStorage).forEach(k => {
    if (
      (k.startsWith('detox_')        && k !== 'detox_email_list') ||
      k.startsWith('sb-')            ||  // Supabase session keys (belt-and-suspenders)
      k.startsWith('photos_day_')    ||  // daily progress photos
      k.startsWith('firedReminders_')||  // reminder fire-tracking (firedReminders_YYYY-MM-DD)
      k.startsWith('challengeComplete_') || // daily challenges (challengeComplete_YYYY-MM-DD)
      k === 'completedCleanse'       ||
      k === 'planBannerDismissed'    ||
      k === 'surveyDismissed'        ||
      k === 'surveyCompleted'        ||
      k === 'cleanseCompanion'       ||
      k === 'thrivingStreak'         ||
      k === 'thrivingStreakDate'
    ) {
      localStorage.removeItem(k);
    }
  });

  // 3. Reset in-memory AUTH state
  _clearSession();

  // 4. Reset active day so Day 1 is selected on next load (belt-and-suspenders
  //    alongside the reload below — guards any path that skips the reload).
  if (typeof STATE !== 'undefined') STATE.activeDay = 1;

  // 5. Full page reload — the most reliable cross-browser way to reset all
  //    in-memory state (STATE, companion, water tracker, streak, day selection).
  location.reload();
}

async function forgotPassword(email) {
  if (!sbClient) throw new Error('Authentication service not configured. Please contact support.');
  if (!email || !email.includes('@')) throw new Error('Please enter a valid email address.');

  const { error } = await sbClient.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://organicdetoxcleanse.com',
  });

  if (error) throw new Error(error.message);
  return true; // Always show success — don't reveal whether the email exists
}

async function startCheckout(planId) {
  // ── CONNECT: STRIPE ──
  // Replace with a call to your Supabase Edge Function:
  //   const res = await fetch(STRIPE_ENDPOINT, {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${AUTH.access_token}` },
  //     body: JSON.stringify({ priceId: PLANS[planId].stripePriceId, userId: AUTH.user.id })
  //   });
  //   const { url } = await res.json();
  //   window.location.href = url; // Redirect to Stripe Checkout
  //
  // Until Stripe is wired: store plan in Supabase user metadata (demo upgrade).
  if (sbClient && AUTH.user) {
    try { await sbClient.auth.updateUser({ data: { plan: planId } }); }
    catch(e) { console.warn('Could not sync plan to Supabase:', e); }
  }
  AUTH.plan = planId;
  showPaymentSuccess(planId);
}

/* ── HELPER ───────────────────────────────────────────────────────────────── */
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── AUTH UI RENDERING ────────────────────────────────────────────────────── */

function navigateAuth(screen) {
  // screens: login | signup | forgot | pricing | payment | account
  document.querySelectorAll('.auth-screen').forEach(s => s.classList.remove('active'));
  const screen_el = document.getElementById(`auth-${screen}`);
  if (screen_el) screen_el.classList.add('active');

  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('active');
  clearAuthErrors();
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.remove('active');
}

function clearAuthErrors() {
  document.querySelectorAll('.auth-error').forEach(e => { e.textContent = ''; e.style.display = 'none'; });
}

function showAuthError(screenId, message) {
  const el = document.getElementById(`error-${screenId}`);
  if (el) { el.textContent = message; el.style.display = 'block'; }
}

function setAuthLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.originalText = btn.dataset.originalText || btn.textContent;
  btn.textContent = loading ? 'Please wait...' : btn.dataset.originalText;
}

/* ── FORM HANDLERS ────────────────────────────────────────────────────────── */

async function handleSignUp() {
  const name     = document.getElementById('signup-name')?.value?.trim();
  const email    = document.getElementById('signup-email')?.value?.trim();
  const password = document.getElementById('signup-password')?.value;
  const confirm  = document.getElementById('signup-confirm')?.value;

  clearAuthErrors();
  if (password !== confirm) { showAuthError('signup', 'Passwords do not match.'); return; }

  setAuthLoading('btn-signup', true);
  try {
    const result = await signUp(name, email, password);
    if (result && result.needsVerification) {
      // Supabase requires email confirmation before the account is active.
      const inner = document.querySelector('#auth-signup .auth-screen-inner');
      if (inner) {
        inner.innerHTML = `
          <div style="font-size:40px;margin-bottom:12px;text-align:center">✉️</div>
          <h2 class="auth-title">Check your inbox</h2>
          <p class="auth-sub">We sent a confirmation link to <strong>${email}</strong>.<br>
          Click the link to verify your account, then sign in.</p>
          <button class="auth-btn mt-16" onclick="navigateAuth('login')">Go to Sign In</button>`;
      }
    } else {
      // Email confirmation disabled in Supabase — user is immediately active.
      updateAuthUI();
      closeAuthModal();
      setTimeout(startOnboardingFlow, 350);
    }
  } catch(err) {
    showAuthError('signup', err.message);
  } finally {
    setAuthLoading('btn-signup', false);
  }
}

async function handleSignIn() {
  const email    = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;

  clearAuthErrors();
  setAuthLoading('btn-login', true);
  try {
    await signIn(email, password);
    _validateCleanseOwner();
    // Supabase persists the session to localStorage automatically.
    // Re-render pages immediately so newly unlocked content appears without a reload.
    updateAuthUI();
    closeAuthModal();
    if (typeof renderRecipesPage  === 'function') renderRecipesPage();
    if (typeof renderTracker      === 'function') renderTracker();
    if (typeof renderShop         === 'function') renderShop('all');
    if (typeof renderGuide        === 'function') renderGuide();
    if (typeof applyContentGating === 'function') applyContentGating();
    if (typeof renderTesterBadge  === 'function') renderTesterBadge();
    // Fetch cloud data then re-render home so water, companion, tracker state,
    // and challenge completion reflect the user's actual saved progress.
    if (typeof loadCloudData === 'function') {
      loadCloudData().then(() => {
        if (typeof loadState    === 'function') loadState();
        if (typeof renderHome   === 'function') renderHome();
      }).catch(() => {
        if (typeof renderHome   === 'function') renderHome();
      });
    } else {
      if (typeof renderHome === 'function') renderHome();
    }
  } catch(err) {
    showAuthError('login', err.message);
  } finally {
    setAuthLoading('btn-login', false);
  }
}

async function handleForgotPassword() {
  const email = document.getElementById('forgot-email')?.value?.trim();
  clearAuthErrors();
  setAuthLoading('btn-forgot', true);
  try {
    await forgotPassword(email);
    const form = document.getElementById('forgot-form');
    const success = document.getElementById('forgot-success');
    if (form) form.style.display = 'none';
    if (success) success.style.display = 'block';
  } catch(err) {
    showAuthError('forgot', err.message);
  } finally {
    setAuthLoading('btn-forgot', false);
  }
}

async function handleSelectPlan(planId) {
  if (planId === 'free') {
    AUTH.plan = 'free';
    if (sbClient && AUTH.user) {
      sbClient.auth.updateUser({ data: { plan: 'free' } }).catch(() => {});
    }
    updateAuthUI();
    closeAuthModal();
    if (typeof startOnboardingFlow === 'function') setTimeout(startOnboardingFlow, 350);
    return;
  }
  if (!isLoggedIn()) {
    navigateAuth('signup');
    return;
  }
  navigateAuth('payment');
  renderPaymentScreen(planId);
}

async function handlePayment(planId) {
  clearAuthErrors();
  const cardNum = document.getElementById('card-number')?.value?.replace(/\s/g, '');
  const expiry  = document.getElementById('card-expiry')?.value;
  const cvc     = document.getElementById('card-cvc')?.value;
  const name    = document.getElementById('card-name')?.value?.trim();

  if (!cardNum || cardNum.length < 15) { showAuthError('payment', 'Please enter a valid card number.'); return; }
  if (!expiry || expiry.length < 5)    { showAuthError('payment', 'Please enter a valid expiry date.'); return; }
  if (!cvc || cvc.length < 3)          { showAuthError('payment', 'Please enter a valid CVC.'); return; }
  if (!name)                            { showAuthError('payment', 'Please enter the name on your card.'); return; }

  setAuthLoading('btn-pay', true);
  try {
    await startCheckout(planId);
  } catch(err) {
    showAuthError('payment', err.message);
  } finally {
    setAuthLoading('btn-pay', false);
  }
}

/* ── PAYMENT SCREEN RENDERER ─────────────────────────────────────────────── */
function renderPaymentScreen(planId) {
  const plan = PLANS[planId];
  if (!plan) return;

  const summary = document.getElementById('payment-summary');
  if (summary) {
    summary.innerHTML = `
      <div class="payment-plan-name">${plan.name}</div>
      <div class="payment-plan-price">${plan.priceLabel}</div>
      <div class="payment-plan-desc">${plan.description}</div>`;
  }

  // Wire up pay button
  const btn = document.getElementById('btn-pay');
  if (btn) {
    btn.dataset.originalText = `Pay ${plan.priceLabel}`;
    btn.textContent = `Pay ${plan.priceLabel}`;
    btn.onclick = () => handlePayment(planId);
  }
}

/* ── PAYMENT SUCCESS ──────────────────────────────────────────────────────── */
function showPaymentSuccess(planId) {
  const plan = PLANS[planId];
  const screen = document.getElementById('auth-payment');
  if (screen) {
    screen.innerHTML = `
      <div class="auth-screen-inner">
        <div class="auth-success-icon">&#x2713;</div>
        <h2 class="auth-title">Welcome to ${plan.name}!</h2>
        <p class="auth-sub">Your account has been upgraded. You now have access to ${planId === 'premium' || planId === 'seasonal' || planId === 'lifetime' ? 'all features including the Advanced Cleanse' : 'the full program'}.</p>

        <div class="upsell-banner">
          <div class="upsell-icon">&#x1F4D6;</div>
          <div class="upsell-text">
            <div class="upsell-title">Add the Complete Guide + Spreadsheet</div>
            <div class="upsell-desc">The interactive spreadsheet and full program guide as a PDF. The guide and spreadsheet work best together with the app. One-time add-on.</div>
          </div>
          <div class="upsell-actions">
            <button class="upsell-btn-yes" onclick="markBundlePurchased(); this.closest('.upsell-banner').innerHTML='<div class=upsell-confirmed>Bundle added!</div>';">Add for $19.99</button>
            <button class="upsell-btn-no" onclick="this.closest('.upsell-banner').remove();">No thanks</button>
          </div>
        </div>

        <button class="auth-btn mt-12" onclick="closeAuthModal(); updateAuthUI(); setTimeout(startOnboardingFlow, 350);">Start Your Cleanse</button>
      </div>`;
  }
  updateAuthUI();
}

/* ── ACCOUNT SCREEN ───────────────────────────────────────────────────────── */

// Human-readable labels for core feature keys shown in account screen
const ACCOUNT_FEATURE_LABELS = {
  'morning':          'Morning routine',
  'checklist-2':      'Night-before checklist (2 items)',
  'checklist-full':   'Night-before checklist (all 6 items)',
  'day1-full':        'Full Day 1 meal plan',
  'days2to7':         'Days 2–7 full meal plan',
  'recipes-swap-ui':  'Recipe swap UI',
  'recipes-full':     'Complete recipe instructions',
  'shop-browse':      'Shop browsing',
  'shop-links':       'Direct shopping links',
  'tracker':          'Progress tracker & journal',
  'generator':        'Random meal generator',
  'advanced':         'Advanced Cleanse program',
  'seasonal':         'Seasonal reset reminders',
};

// Premium-exclusive feature display definitions
const PREMIUM_FEATURE_DEFS = [
  { key: 'cleanse-history',      label: 'Cross-cleanse history & comparison' },
  { key: 'trend-charts',         label: 'Progress trend charts'             },
  { key: 'custom-notifications', label: 'Custom notification schedule'      },
  { key: 'progress-pdf',         label: 'Downloadable end-of-cleanse PDF'  },
  { key: 'priority-support',     label: 'Priority support'                  },
];

function renderAccountScreen() {
  const screen = document.getElementById('auth-account');
  if (!screen || !AUTH.user) return;

  // ── FIX 1: Admin account view ─────────────────────────────────────────────
  if (isAdmin()) {
    const allAdminFeatures = [
      'Morning routine & full meal plan',
      'Complete recipes with ingredient swaps',
      'Progress tracker & journal (all 7 days)',
      'Direct shopping links',
      'Random meal generator',
      'Advanced Cleanse program',
      'Seasonal reset tracking',
      ...PREMIUM_FEATURE_DEFS.map(f => f.label),
      'Admin dashboard access',
    ];
    screen.querySelector('.auth-screen-inner').innerHTML = `
      <div class="account-avatar" style="background:var(--amber)">${AUTH.user.name?.charAt(0)?.toUpperCase() || 'A'}</div>
      <h2 class="auth-title">${AUTH.user.name}</h2>
      <p class="auth-sub">${AUTH.user.email}</p>
      <div class="account-plan-card" style="border-color:var(--amber)">
        <div class="account-plan-label">Account Type</div>
        <div class="account-plan-name" style="color:var(--amber)">Admin — Full Access</div>
        <div class="account-plan-price">All features unlocked</div>
      </div>
      <div class="account-features">
        ${allAdminFeatures.map(f => `<div class="account-feature">✓ ${f}</div>`).join('')}
      </div>
      <button class="auth-btn mt-12" onclick="renderAdminDashboard()">
        View Admin Dashboard
      </button>
      <button class="auth-btn auth-btn-outline mt-12" onclick="signOut()">Sign Out</button>`;
    return;
  }

  // ── Regular / tester user account view ────────────────────────────────────
  // Testers have no PLANS entry — display as Premium-equivalent
  const plan       = PLANS[AUTH.plan] || PLANS.premium;
  const isLifetime = AUTH.plan === 'lifetime';

  // Core features visible for current plan
  const coreFeatures = (ACCESS[AUTH.plan] || [])
    .filter(f => ACCOUNT_FEATURE_LABELS[f])
    .map(f => `<div class="account-feature">✓ ${ACCOUNT_FEATURE_LABELS[f]}</div>`)
    .join('');

  // Premium-exclusive features: unlocked or locked with upgrade CTA
  const premiumFeaturesHtml = PREMIUM_FEATURE_DEFS.map(f => {
    if (canAccess(f.key)) {
      return `<div class="account-feature">✓ ${f.label}</div>`;
    }
    return `<div class="account-feature" style="color:var(--mid-gray)">
      🔒 ${f.label}
      <span class="account-upgrade-inline" onclick="navigateAuth('pricing')">Upgrade to Premium</span>
    </div>`;
  }).join('');

  // Founding Member badge for lifetime only (Fix 7)
  const foundingBadge = isLifetime ? `
    <div class="founding-badge">⭐ Founding Member</div>` : '';

  const showUpgrade = ['free','basic','seasonal'].includes(AUTH.plan);
  const periodStr   = plan.period && plan.period !== 'once' ? `/${plan.period}` : '';

  screen.querySelector('.auth-screen-inner').innerHTML = `
    <div class="account-avatar">${AUTH.user.name?.charAt(0)?.toUpperCase() || '?'}</div>
    ${foundingBadge}
    <h2 class="auth-title">${AUTH.user.name}</h2>
    <p class="auth-sub">${AUTH.user.email}</p>

    <div class="account-plan-card" style="border-color:${plan.color}">
      <div class="account-plan-label">Current Plan</div>
      <div class="account-plan-name" style="color:${plan.color}">${plan.name}</div>
      <div class="account-plan-price">${plan.priceLabel}${periodStr}</div>
    </div>

    <div class="account-features">
      ${coreFeatures}
      <div style="font-family:var(--font-ui);font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:var(--text-muted);margin:12px 0 6px;">Premium Features</div>
      ${premiumFeaturesHtml}
    </div>

    ${showUpgrade ? `
    <button class="auth-btn mt-12" onclick="navigateAuth('pricing')">Upgrade Plan</button>` : ''}
    <button class="account-action-btn mt-12"
      onclick="closeAuthModal(); setTimeout(openSchedulerSettings, 300)">
      🔔 Reminders &amp; Schedule
    </button>

    <div class="account-settings-group">
      <button class="account-settings-btn" onclick="showChangePasswordForm()">🔑 Change Password</button>
      <button class="account-settings-btn" onclick="showChangeEmailForm()">✉️ Change Email</button>
    </div>

    <button class="auth-btn auth-btn-outline mt-12" onclick="signOut()">Sign Out</button>
    <button class="auth-btn mt-8" style="background:transparent;color:var(--amber-dk);border:1px solid var(--amber);font-size:12px;padding:8px" onclick="handleResetCleanse()">
      🔄 Reset My Cleanse
    </button>
    <button class="delete-account-link" onclick="showDeleteConfirmation()">Delete my account</button>`;
}

/* ── CHANGE PASSWORD (Fix 4A) ─────────────────────────────────────────────── */
function showChangePasswordForm() {
  const inner = document.querySelector('#auth-account .auth-screen-inner');
  if (!inner) return;
  inner.innerHTML = `
    <h2 class="auth-title">Change Password</h2>
    <p class="auth-sub">Enter your current password and choose a new one.</p>
    <div id="error-change-pw" class="auth-error"></div>
    <div class="auth-field">
      <label class="auth-label">Current Password</label>
      <div class="password-wrap">
        <input class="auth-input" id="cpw-current" type="password" placeholder="Current password" autocomplete="current-password" />
        <button type="button" class="pw-toggle" onclick="togglePwVisibility(this)" aria-label="Show password">👁</button>
      </div>
    </div>
    <div class="auth-field">
      <label class="auth-label">New Password</label>
      <div class="password-wrap">
        <input class="auth-input" id="cpw-new" type="password" placeholder="At least 8 characters" autocomplete="new-password" />
        <button type="button" class="pw-toggle" onclick="togglePwVisibility(this)" aria-label="Show password">👁</button>
      </div>
    </div>
    <div class="auth-field">
      <label class="auth-label">Confirm New Password</label>
      <div class="password-wrap">
        <input class="auth-input" id="cpw-confirm" type="password" placeholder="Repeat new password" autocomplete="new-password" />
        <button type="button" class="pw-toggle" onclick="togglePwVisibility(this)" aria-label="Show password">👁</button>
      </div>
    </div>
    <button class="auth-btn mt-12" id="btn-change-pw" onclick="submitChangePassword()">Update Password</button>
    <div class="auth-switch mt-12">
      <span class="auth-link" onclick="navigateAuth('account'); renderAccountScreen()">Cancel</span>
    </div>`;
}

async function submitChangePassword() {
  const newPw   = document.getElementById('cpw-new')?.value;
  const confirm = document.getElementById('cpw-confirm')?.value;
  const errorEl = document.getElementById('error-change-pw');

  const showErr = msg => { if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; } };
  if (errorEl) errorEl.style.display = 'none';

  if (!newPw || newPw.length < 8) { showErr('New password must be at least 8 characters.'); return; }
  if (newPw !== confirm) { showErr('New passwords do not match.'); return; }

  if (sbClient) {
    const { error } = await sbClient.auth.updateUser({ password: newPw });
    if (error) { showErr(error.message); return; }
  }

  const btn = document.getElementById('btn-change-pw');
  if (btn) { btn.textContent = '✓ Password updated!'; btn.disabled = true; }
  await delay(1200);
  renderAccountScreen();
}

/* ── CHANGE EMAIL (Fix 4B) ────────────────────────────────────────────────── */
function showChangeEmailForm() {
  const inner = document.querySelector('#auth-account .auth-screen-inner');
  if (!inner) return;
  inner.innerHTML = `
    <h2 class="auth-title">Change Email</h2>
    <p class="auth-sub">Enter your new email address and current password to confirm.</p>
    <div id="error-change-email" class="auth-error"></div>
    <div class="auth-field">
      <label class="auth-label">New Email Address</label>
      <input class="auth-input" id="cemail-new" type="email" placeholder="new@email.com" autocomplete="email" />
    </div>
    <div class="auth-field">
      <label class="auth-label">Current Password</label>
      <div class="password-wrap">
        <input class="auth-input" id="cemail-pw" type="password" placeholder="Your password" autocomplete="current-password" />
        <button type="button" class="pw-toggle" onclick="togglePwVisibility(this)" aria-label="Show password">👁</button>
      </div>
    </div>
    <button class="auth-btn mt-12" id="btn-change-email" onclick="submitChangeEmail()">Update Email</button>
    <div class="auth-switch mt-12">
      <span class="auth-link" onclick="navigateAuth('account'); renderAccountScreen()">Cancel</span>
    </div>`;
}

async function submitChangeEmail() {
  const newEmail = document.getElementById('cemail-new')?.value?.trim();
  const errorEl  = document.getElementById('error-change-email');

  const showErr = msg => { if (errorEl) { errorEl.textContent = msg; errorEl.style.display = 'block'; } };
  if (errorEl) errorEl.style.display = 'none';

  if (!newEmail || !newEmail.includes('@')) { showErr('Please enter a valid email address.'); return; }

  if (sbClient) {
    const { error } = await sbClient.auth.updateUser({ email: newEmail });
    if (error) { showErr(error.message); return; }
    // Supabase sends a confirmation email to the new address before switching.
    if (AUTH.user) AUTH.user.email = newEmail;
  }

  const btn = document.getElementById('btn-change-email');
  if (btn) { btn.textContent = '✓ Check your email to confirm'; btn.disabled = true; }
  await delay(1200);
  renderAccountScreen();
}

/* ── DELETE ACCOUNT (Fix 4C) ─────────────────────────────────────────────── */
function showDeleteConfirmation() {
  const inner = document.querySelector('#auth-account .auth-screen-inner');
  if (!inner) return;
  inner.innerHTML = `
    <h2 class="auth-title" style="color:#DC2626">Delete Account</h2>
    <div class="delete-confirm-box">
      <div class="delete-confirm-warning">
        This will permanently delete your account and all your data. This cannot be undone.
      </div>
      <input class="delete-confirm-input" id="delete-confirm-input"
        type="text" placeholder='Type DELETE to confirm'
        oninput="document.getElementById('btn-delete-account').disabled = this.value !== 'DELETE'" />
      <button class="delete-confirm-btn" id="btn-delete-account"
        disabled onclick="submitDeleteAccount()">
        Permanently Delete Account
      </button>
      <button class="auth-btn" onclick="navigateAuth('account'); renderAccountScreen()">Cancel</button>
    </div>`;
}

async function submitDeleteAccount() {
  const token = AUTH.access_token;
  if (!token) return;

  // Disable the button and show a loading state while the request is in flight.
  const btn = document.getElementById('btn-delete-account');
  if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }

  try {
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg  = body.error || 'Account deletion failed. Please try again.';
      if (btn) { btn.disabled = false; btn.textContent = 'Permanently Delete Account'; }
      const sub = document.querySelector('#auth-delete .auth-sub, #auth-delete .delete-warning');
      if (sub) sub.textContent = msg;
      return;
    }
  } catch(err) {
    console.log('delete error:', err);
    if (btn) { btn.disabled = false; btn.textContent = 'Permanently Delete Account'; }
    const sub = document.querySelector('#auth-delete .auth-sub, #auth-delete .delete-warning');
    if (sub) sub.textContent = 'Network error. Please check your connection and try again.';
    return;
  }

  // Server confirmed deletion — wipe all local state.
  console.log('delete success, clearing local state');

  localStorage.clear();
  _clearSession();

  // Reset in-memory STATE and re-render the home page to clear the water
  // display and any other stale UI immediately after deletion.
  if (typeof STATE !== 'undefined') {
    STATE.water      = {};
    STATE.tracker    = {};
    STATE.selections = {};
  }
  if (typeof renderHome === 'function') renderHome();

  // Write a fresh zeroed companion so the widget doesn't display stale points.
  const freshCompanion = {
    mood: 'neutral', badges: [], points: 0, streak: 0, growthStage: 1,
    todayPoints: 0, cleanseCount: 0, allTimePoints: 0,
    lastPointDate: null, lastStreakDate: null, lastActiveDay: null,
  };
  localStorage.setItem('cleanseCompanion', JSON.stringify(freshCompanion));

  if (typeof renderTracker          === 'function') renderTracker();
  if (typeof gateTracker            === 'function') gateTracker();
  if (typeof renderCompanionWidget  === 'function') renderCompanionWidget();
  if (typeof updateCompanionDisplay === 'function') updateCompanionDisplay();

  // Do NOT call closeAuthModal() here — it queues startOnboardingFlow() via a
  // 350ms setTimeout which would race with and override our redirect below.
  // Instead keep the modal open and switch its active screen directly.
  setTimeout(() => {
    navigateAuth('login');
    const sub = document.querySelector('#auth-login .auth-sub');
    if (sub) sub.textContent = 'Your account has been deleted.';
    updateAuthUI();
  }, 350);
}

/* ── PRICING SCREEN RENDERER ─────────────────────────────────────────────── */
function renderPricingScreen() {
  const container = document.getElementById('pricing-plans');
  if (!container) return;

  // Plan display order per task spec
  const planOrder = ['free', 'basic', 'seasonal', 'premium', 'lifetime'];

  container.innerHTML = planOrder.map(planId => {
    const plan = PLANS[planId];
    const isCurrentPlan = AUTH.plan === planId;

    const featuresHtml = plan.features.map(f => `
      <div class="plan-feature ${f.included ? '' : 'excluded'}">
        <span class="plan-feature-icon">${f.included ? '✓' : '✗'}</span>
        ${f.text}
      </div>`).join('');

    const priceRow = plan.period && plan.period !== 'once'
      ? `${plan.priceLabel}<span class="plan-period">/${plan.period}</span>`
      : plan.priceLabel;

    const altPrice = plan.priceAlt
      ? `<div class="plan-price-alt">${plan.priceAlt}</div>`
      : '';

    const btnLabel = isCurrentPlan ? 'Current Plan'
      : (plan.ctaLabel || 'Choose Plan');

    const badgeHtml = plan.badge
      ? `<div class="plan-badge ${plan.badgeClass || ''}">${plan.badge}</div>`
      : '';

    return `
      <div class="plan-card ${isCurrentPlan ? 'plan-current' : ''} ${planId === 'premium' ? 'plan-featured' : ''}"
           style="--plan-color:${plan.color}">
        ${badgeHtml}
        <div class="plan-name">${plan.name}</div>
        <div class="plan-price">${priceRow}</div>
        ${altPrice}
        <div class="plan-desc">${plan.description}</div>
        <div class="plan-features">${featuresHtml}</div>
        <button class="plan-btn ${isCurrentPlan ? 'plan-btn-current' : ''}"
          onclick="handleSelectPlan('${planId}')"
          ${isCurrentPlan ? 'disabled' : ''}>
          ${btnLabel}
        </button>
      </div>`;
  }).join('');

  // Add-on purchase section — always re-render so pricing is tier-aware (Fix 6)
  const pricingInner = document.querySelector('.pricing-screen-inner');
  if (pricingInner) {
    // Remove stale addon section so it re-renders with current plan pricing
    const oldAddons = pricingInner.querySelector('.pricing-addons');
    if (oldAddons) oldAddons.remove();

    const plan = AUTH.plan;
    const guideIncluded = plan === 'premium' || plan === 'lifetime';

    let guideHtml;
    if (guideIncluded) {
      guideHtml = `<span style="color:var(--md-green);font-weight:600">✓ Digital Guide — included in your plan</span>`;
    } else {
      // Member discount by tier
      const guidePrice = plan === 'seasonal' ? '$9.99 <em>(member price)</em>'
                       : plan === 'basic'    ? '$11.99 <em>(member price)</em>'
                       : '$14.99';
      guideHtml = `<span class="pricing-addon-link" onclick="handleAddonPurchase('guide')">Digital Guide — ${guidePrice}</span>`;
    }

    const addons = document.createElement('div');
    addons.className = 'pricing-addons';
    addons.innerHTML = `
      ${guideHtml}
      &nbsp;·&nbsp;
      <span class="pricing-addon-link" onclick="handleAddonPurchase('spreadsheet')">Spreadsheet — $9.99</span>
      &nbsp;·&nbsp;
      <span class="pricing-addon-link" onclick="handleAddonPurchase('bundle')">Bundle Both — $19.99</span>
      <br>
      <span class="pricing-addon-link" onclick="handleAddonPurchase('physical-guide')" style="font-size:12px">
        Physical Guide (printed &amp; shipped) — $26.99
      </span>`;
    pricingInner.appendChild(addons);
  }
}

/* ── ADD-ON PURCHASE HANDLER ──────────────────────────────────────────────── */
function handleAddonPurchase(addonId) {
  const plan = AUTH.plan;

  // Member-discounted guide prices by tier (Fix 6)
  const guidePrice = (plan === 'seasonal') ? '$9.99'
                   : (plan === 'basic')    ? '$11.99'
                   : '$14.99';

  const addons = {
    guide:          { name: 'Digital Guide',             price: guidePrice, stripePriceId: 'price_GUIDE_1499'         }, // ── CONNECT: STRIPE ──
    spreadsheet:    { name: 'Interactive Spreadsheet',   price: '$9.99',    stripePriceId: 'price_SPREADSHEET_999'    }, // ── CONNECT: STRIPE ──
    bundle:         { name: 'Guide + Spreadsheet Bundle',price: '$19.99',   stripePriceId: 'price_BUNDLE_1999'        }, // ── CONNECT: STRIPE ──
    'physical-guide':{ name: 'Physical Guide (printed & shipped)', price: '$26.99', physicalUrl: null                  }, // ── CONNECT: PHYSICAL GUIDE PURCHASE URL ──
  };
  const addon = addons[addonId];
  if (!addon) return;

  if (!isLoggedIn()) { navigateAuth('signup'); return; }

  if (addonId === 'physical-guide') {
    // ── CONNECT: PHYSICAL GUIDE PURCHASE URL ──
    // Replace with your Amazon KDP or print-on-demand store URL:
    // window.open('YOUR_PHYSICAL_GUIDE_URL', '_blank');
    alert('Physical Guide — $26.99\n\nWire this to your Amazon KDP or print-on-demand store URL.\nSearch for: CONNECT: PHYSICAL GUIDE PURCHASE URL');
    return;
  }

  // ── CONNECT: STRIPE ── open Stripe Checkout for addon.stripePriceId
  alert(`Add-on: ${addon.name} — ${addon.price}\n\nWire to Stripe Checkout using price ID: ${addon.stripePriceId}`);
}

/* ── UPDATE UI BASED ON AUTH STATE ────────────────────────────────────────── */
function updateAuthUI() {
  // Fix 1: use the full onboarding flow (health → date picker) after auth changes
  // closeAuthModal() also calls this, so we only run it if modal is already closed
  // to avoid double-triggering. The DOMContentLoaded init handles the primary call.
  // (No direct call here — closeAuthModal() and DOMContentLoaded cover all paths.)
  const loginBtn   = document.getElementById('auth-login-btn');
  const accountBtn = document.getElementById('auth-account-btn');

  if (isLoggedIn()) {
    if (loginBtn)   loginBtn.style.display   = 'none';
    if (accountBtn) accountBtn.style.display = 'flex';
    const initial = document.getElementById('user-initial');
    if (initial) initial.textContent = AUTH.user.name?.charAt(0)?.toUpperCase() || '?';

    // Show role badge on account button
    const roleBadge = document.getElementById('auth-role-badge');
    if (roleBadge) {
      if (isAdmin()) { roleBadge.textContent = 'ADMIN'; roleBadge.style.display = 'block'; }
      else if (isTester()) { roleBadge.textContent = 'TESTER'; roleBadge.style.display = 'block'; }
      else { roleBadge.style.display = 'none'; }
    }
  } else {
    if (loginBtn)   loginBtn.style.display   = 'flex';
    if (accountBtn) accountBtn.style.display = 'none';
  }

  // Nav gating - recipes page is locked at nav level for free users
  // Shop and tracker are accessible but content is gated inside the page
  const navMap = {
    'nav-recipes': 'recipes-full',
    'nav-tracker': null,   // always navigable - gated inside
    'nav-shop':    null,   // always navigable - gated inside
  };
  Object.entries(navMap).forEach(([navId, feature]) => {
    const navEl = document.getElementById(navId);
    if (!navEl) return;
    if (!feature || canAccess(feature)) {
      navEl.classList.remove('nav-locked');
      navEl.onclick = () => navigate(navId.replace('nav-', ''));
    } else {
      navEl.classList.add('nav-locked');
      navEl.onclick = () => showUpgradeModal('Unlock the full program to access this section.');
    }
  });

  // Trigger app-level gating re-render
  if (typeof applyContentGating === 'function') applyContentGating();
}

/* ── UPGRADE MODAL (inline, no page navigation) ───────────────────────────── */
function showUpgradeModal(message) {
  navigateAuth('pricing');
  // Re-render pricing so tier-aware addon pricing is always current (Fix 6)
  renderPricingScreen();
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('active');
  // Always start pricing modal at the top regardless of previous scroll position
  const pricingScroll = document.querySelector('.pricing-scroll');
  if (pricingScroll) pricingScroll.scrollTop = 0;
  const sub = document.querySelector('#auth-pricing .auth-sub');
  if (sub && message) sub.textContent = message;
}

/* ── ADMIN DASHBOARD ──────────────────────────────────────────────────────── */
function renderAdminDashboard() {
  const screen = document.getElementById('auth-account');
  if (!screen || !isAdmin()) return;

  // Gather user stats from localStorage
  const allKeys = Object.keys(localStorage).filter(k => k.startsWith('detox_user_'));
  const users = allKeys.map(k => {
    try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; }
  }).filter(Boolean);

  const testerRows = TESTER_ACCOUNTS.map((t, i) => `
    <tr>
      <td style="padding:6px 8px;font-size:12px;color:var(--color-text-primary)">${t.name}</td>
      <td style="padding:6px 8px;font-size:12px;color:var(--color-text-secondary)">${t.email}</td>
      <td style="padding:6px 8px;font-size:11px;color:var(--color-text-secondary);font-family:monospace">Supabase</td>
      <td style="padding:6px 8px"><span style="font-size:10px;background:#D8F3DC;color:#1B4332;padding:2px 6px;border-radius:8px;">Active</span></td>
    </tr>`).join('');

  const userRows = users.length ? users.map(u => `
    <tr>
      <td style="padding:6px 8px;font-size:12px;">${u.name || '-'}</td>
      <td style="padding:6px 8px;font-size:12px;color:var(--color-text-secondary)">${u.email}</td>
      <td style="padding:6px 8px"><span style="font-size:10px;background:#E8F4F8;color:#1B4332;padding:2px 6px;border-radius:8px;">${u.plan || 'free'}</span></td>
      <td style="padding:6px 8px;font-size:11px;color:var(--color-text-secondary)">${u.createdAt ? u.createdAt.slice(0,10) : '-'}</td>
    </tr>`).join('') : '<tr><td colspan="4" style="padding:12px;font-size:12px;color:var(--color-text-secondary);text-align:center">No registered users yet</td></tr>';

  screen.querySelector('.auth-screen-inner').innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      <div style="width:48px;height:48px;border-radius:50%;background:#1B4332;color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:500;">A</div>
      <div>
        <div style="font-size:16px;font-weight:500;color:var(--color-text-primary)">Admin Dashboard</div>
        <div style="font-size:12px;color:var(--color-text-secondary)">${ADMIN_EMAIL}</div>
      </div>
      <span style="margin-left:auto;font-size:10px;font-weight:500;background:#1B4332;color:#fff;padding:3px 8px;border-radius:8px;">ADMIN</span>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">
      <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:12px;text-align:center;">
        <div style="font-size:22px;font-weight:500;color:var(--color-text-primary)">${users.length}</div>
        <div style="font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.5px;">Registered</div>
      </div>
      <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:12px;text-align:center;">
        <div style="font-size:22px;font-weight:500;color:var(--color-text-primary)">${users.filter(u=>u.plan && u.plan !== 'free').length}</div>
        <div style="font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.5px;">Paid</div>
      </div>
      <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);padding:12px;text-align:center;">
        <div style="font-size:22px;font-weight:500;color:var(--color-text-primary)">${TESTER_ACCOUNTS.length}</div>
        <div style="font-size:10px;color:var(--color-text-secondary);text-transform:uppercase;letter-spacing:0.5px;">Testers</div>
      </div>
    </div>

    <div style="font-size:11px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:8px;">Tester accounts</div>
    <div style="overflow-x:auto;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:var(--color-background-secondary);">
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--color-text-secondary);">Name</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--color-text-secondary);">Email</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--color-text-secondary);">Password</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--color-text-secondary);">Status</th>
          </tr>
        </thead>
        <tbody>${testerRows}</tbody>
      </table>
    </div>
    <div style="background:#FFF3E0;border-radius:var(--border-radius-md);padding:10px 12px;font-size:12px;color:#B8621A;margin-bottom:16px;">
      To add or remove testers, edit the TESTER_ACCOUNTS array in js/auth.js then redeploy.
      To change tester passwords, update the password field for that entry.
    </div>

    <div style="font-size:11px;font-weight:500;letter-spacing:1.5px;text-transform:uppercase;color:var(--color-text-secondary);margin-bottom:8px;">Registered users</div>
    <div style="overflow-x:auto;margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="background:var(--color-background-secondary);">
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--color-text-secondary);">Name</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--color-text-secondary);">Email</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--color-text-secondary);">Plan</th>
            <th style="padding:6px 8px;text-align:left;font-size:10px;color:var(--color-text-secondary);">Joined</th>
          </tr>
        </thead>
        <tbody>${userRows}</tbody>
      </table>
    </div>

    <button class="auth-btn auth-btn-outline mt-12" onclick="signOut()">Sign Out</button>`;
}

/* ── TESTER FEEDBACK BUTTON ───────────────────────────────────────────────── */
function renderTesterBadge() {
  const btn = document.getElementById('tester-feedback-btn');
  if (!btn) return;
  if (isTester()) {
    btn.style.display = 'block';
    // Re-trigger pulse animation by removing and re-adding it
    btn.style.animation = 'none';
    void btn.offsetHeight; // force reflow so animation restarts
    btn.style.animation = '';
  } else {
    btn.style.display = 'none';
  }
}

function showTesterFeedback() {
  const existing = document.getElementById('tester-feedback-modal');
  if (existing) { existing.remove(); return; }

  const modal = document.createElement('div');
  modal.id = 'tester-feedback-modal';
  modal.className = 'tester-feedback-modal';
  modal.innerHTML = `
    <div class="tester-feedback-inner">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:15px;font-weight:500;color:var(--color-text-primary)">Tester Feedback</div>
        <button onclick="document.getElementById('tester-feedback-modal').remove()"
          style="font-size:18px;color:var(--color-text-secondary);background:none;border:none;cursor:pointer;">&#x2715;</button>
      </div>
      <div style="font-size:12px;color:var(--color-text-secondary);margin-bottom:10px;">
        Signed in as: <strong>${AUTH.user?.name}</strong> &nbsp;|&nbsp; Page: <strong>${STATE?.activePage || 'home'}</strong>
      </div>
      <select id="feedback-type" style="width:100%;margin-bottom:8px;font-size:13px;padding:8px;">
        <option value="">Category...</option>
        <option value="bug">Bug or error</option>
        <option value="ux">Confusing or hard to use</option>
        <option value="content">Content issue</option>
        <option value="missing">Missing feature</option>
        <option value="positive">This works great</option>
        <option value="other">Other</option>
      </select>
      <textarea id="feedback-text" rows="4" placeholder="Describe what you found or experienced..."
        style="width:100%;font-size:13px;padding:10px;border:0.5px solid var(--color-border-tertiary);border-radius:8px;resize:vertical;font-family:var(--font-sans);"></textarea>
      <button onclick="submitTesterFeedback()"
        style="width:100%;margin-top:10px;padding:10px;background:#2D6A4F;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;">
        Submit Feedback
      </button>
      <div id="feedback-sent" style="display:none;text-align:center;padding:10px;font-size:13px;color:#2D6A4F;font-weight:500;">
        Feedback submitted. Thank you!
      </div>
    </div>`;
  document.body.appendChild(modal);
}

function submitTesterFeedback() {
  const type = document.getElementById('feedback-type')?.value;
  const text = document.getElementById('feedback-text')?.value?.trim();
  if (!text) return;

  // Save feedback locally
  const feedbackKey = 'detox_tester_feedback';
  const existing = JSON.parse(localStorage.getItem(feedbackKey) || '[]');
  existing.push({
    tester:    AUTH.user?.name,
    email:     AUTH.user?.email,
    page:      STATE?.activePage || 'unknown',
    type,
    text,
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem(feedbackKey, JSON.stringify(existing));

  // ── CONNECT: EMAIL / WEBHOOK ──
  // Send to your email or Slack webhook:
  // fetch('YOUR_WEBHOOK_URL', { method: 'POST', body: JSON.stringify(existing[existing.length-1]) })

  document.getElementById('feedback-sent').style.display = 'block';
  setTimeout(() => document.getElementById('tester-feedback-modal')?.remove(), 1500);
}

/* ── PASSWORD SHOW/HIDE (Fix 4D) ─────────────────────────────────────────── */
function togglePwVisibility(btn) {
  const input = btn.previousElementSibling;
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
    btn.setAttribute('aria-label', 'Hide password');
  } else {
    input.type = 'password';
    btn.textContent = '👁';
    btn.setAttribute('aria-label', 'Show password');
  }
}

/* ── CARD NUMBER FORMATTING ───────────────────────────────────────────────── */
function formatCardNumber(input) {
  let val = input.value.replace(/\D/g, '').substring(0, 16);
  input.value = val.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(input) {
  let val = input.value.replace(/\D/g, '').substring(0, 4);
  if (val.length > 2) val = val.substring(0, 2) + '/' + val.substring(2);
  input.value = val;
}

/* ── WINDOW SCOPE EXPORTS (Fix 2) ────────────────────────────────────────── */
// Explicit window assignments so inline onclick handlers in dynamically
// rendered HTML (renderAccountScreen, showPaymentSuccess, etc.) can reach
// these functions on all devices including tablets.
window.togglePwVisibility     = togglePwVisibility;
window.showChangePasswordForm = showChangePasswordForm;
window.submitChangePassword   = submitChangePassword;
window.showChangeEmailForm    = showChangeEmailForm;
window.submitChangeEmail      = submitChangeEmail;
window.showDeleteConfirmation = showDeleteConfirmation;
window.submitDeleteAccount    = submitDeleteAccount;
window.navigateAuth           = navigateAuth;
window.closeAuthModal         = closeAuthModal;
window.renderAccountScreen    = renderAccountScreen;
window.renderAdminDashboard   = renderAdminDashboard;
window.signOut                = signOut;
window.handleSignIn           = handleSignIn;
window.handleSignUp           = handleSignUp;
window.handleForgotPassword   = handleForgotPassword;
window.handleSelectPlan       = handleSelectPlan;
window.handleAddonPurchase    = handleAddonPurchase;
window.updateAuthUI           = updateAuthUI;
window.showUpgradeModal       = showUpgradeModal;
window.formatCardNumber       = formatCardNumber;
window.formatExpiry           = formatExpiry;

/* ── INIT ─────────────────────────────────────────────────────────────────── */
function initAuth() {
  // Sync fast-path: restore cached Supabase session from localStorage.
  // This populates AUTH before the page renders, preventing a flash of
  // unauthenticated content on page refresh.
  _syncLoadSession();

  updateAuthUI();
  renderPricingScreen();
  if (isLoggedIn()) {
    renderAccountScreen();
    renderTesterBadge();
  }

  // Async: validate the cached session with Supabase + register auth-state listener.
  if (sbClient) _initSupabaseSession();
}

// Validates the session server-side and keeps AUTH in sync with Supabase events.
async function _initSupabaseSession() {
  try {
    const { data: { session } } = await sbClient.auth.getSession();
    if (session) {
      _applySession(session);
      _validateCleanseOwner();
      // Load cloud data then re-render the home page so water count,
      // companion, day states, and challenge completion are visible
      // immediately. renderHome() already calls renderCompanionWidget()
      // and updateCompanionDisplay() internally — no extra calls needed.
      // Does not trigger auth calls or session init.
      if (typeof loadCloudData === 'function') {
        loadCloudData().then(() => {
          // Re-read STATE from localStorage so water/tracker reflect cloud data.
          if (typeof loadState === 'function') loadState();
          if (typeof renderHome === 'function') renderHome();
          // AUTH.userId is guaranteed populated here — safe to check onboarding.
          if (typeof startOnboardingFlow === 'function') startOnboardingFlow();
        }).catch(() => {});
      }
    } else {
      _clearSession();
    }
    updateAuthUI();
    renderPricingScreen();
    if (isLoggedIn()) {
      renderAccountScreen();
      if (typeof renderTesterBadge === 'function') renderTesterBadge();
    }
  } catch(e) {
    console.error('Supabase session validation error:', e);
  }

  // Keep AUTH in sync with future token refreshes, cross-tab sign-ins, etc.
  sbClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) {
      _applySession(session);
      _validateCleanseOwner();
      updateAuthUI();
      renderPricingScreen();
      // New or reset user landing back after email verification — start onboarding.
      // Check the user-specific key first, fall back to the legacy key for
      // existing users who completed screening before the per-user migration.
      const hKey = AUTH.userId ? 'healthScreeningComplete_' + AUTH.userId : 'healthScreeningComplete';
      const needsOnboarding = !localStorage.getItem(hKey) && !localStorage.getItem('healthScreeningComplete');
      if (needsOnboarding && typeof startOnboardingFlow === 'function') {
        setTimeout(startOnboardingFlow, 350);
      }
    }
    if (event === 'SIGNED_OUT') {
      _clearSession();
      updateAuthUI();
    }
    if (event === 'TOKEN_REFRESHED' && session) {
      // Keep access_token fresh for /api/get-download-url and other API calls
      AUTH.access_token = session.access_token;
      if (AUTH.user) AUTH.user.access_token = session.access_token;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════════════
   SUPABASE DATABASE SCHEMA
   Run this SQL in your Supabase SQL Editor to set up the database:
   ───────────────────────────────────────────────────────────────────────────

   -- User profiles table
   CREATE TABLE profiles (
     id          UUID REFERENCES auth.users ON DELETE CASCADE,
     name        TEXT,
     plan        TEXT DEFAULT 'free',
     stripe_customer_id TEXT,
     created_at  TIMESTAMPTZ DEFAULT NOW(),
     PRIMARY KEY (id)
   );

   -- Enable Row Level Security
   ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

   -- Users can only read and update their own profile
   CREATE POLICY "Users can view own profile"
     ON profiles FOR SELECT USING (auth.uid() = id);

   CREATE POLICY "Users can update own profile"
     ON profiles FOR UPDATE USING (auth.uid() = id);

   -- Auto-create profile on signup
   CREATE FUNCTION public.handle_new_user()
   RETURNS trigger AS $$
   BEGIN
     INSERT INTO public.profiles (id, name)
     VALUES (new.id, new.raw_user_meta_data->>'name');
     RETURN new;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;

   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

   ═══════════════════════════════════════════════════════════════════════════ */
