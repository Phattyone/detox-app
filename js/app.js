/* ── APP STATE ────────────────────────────────────────────────────────────── */
const STATE = {
  activePage: 'home',
  activeDay: 1,
  trackerDay: 1,
  shopFilter: 'all',
  selections: {}, // {recipeId_slotId: optionValue}
  tracker: {},    // stored in localStorage
  water: {},      // {day: count}
  prepChecklist: { checked: {}, awarded: {} },
};

// Guard: suppresses cloud sync writes during loadCloudData() to avoid
// writing freshly-fetched data straight back to the database.
let _cloudLoadInProgress = false;

// Guard: prevents startOnboardingFlow() from firing before the first
// loadCloudData() completes. Without this, the SIGNED_IN auth event
// could trigger onboarding before profile data (health screening,
// cleanse start date) has been restored from Supabase.
let _cloudDataLoaded = false;

/* ── EMAIL CAPTURE HELPER ─────────────────────────────────────────────────── */
// Fire-and-forget — never blocks the UI.
async function subscribeEmail(email, name) {
  if (!email || !email.includes('@')) return;
  try {
    await fetch('/api/mailerlite', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, name: name || '' }),
    });
  } catch(e) {
    console.warn('Email capture failed:', e);
  }
}

/* ── LOCAL STORAGE HELPERS ────────────────────────────────────────────────── */
function normalizePrepChecklist(raw) {
  const src = (raw && typeof raw === 'object') ? raw : {};
  return {
    checked: (src.checked && typeof src.checked === 'object') ? src.checked : {},
    awarded: (src.awarded && typeof src.awarded === 'object') ? src.awarded : {},
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem('detox_tracker');
    if (saved) STATE.tracker = JSON.parse(saved);
    const savedWater = localStorage.getItem('detox_water');
    if (savedWater) STATE.water = JSON.parse(savedWater);
    const savedSel = localStorage.getItem('detox_selections');
    if (savedSel) STATE.selections = JSON.parse(savedSel);
    const savedPrep = localStorage.getItem('detox_prep_checklist');
    if (savedPrep) STATE.prepChecklist = normalizePrepChecklist(JSON.parse(savedPrep));
  } catch(e) { console.warn('Could not load saved state:', e); }
}

function saveTracker() {
  try {
    localStorage.setItem('detox_tracker', JSON.stringify(STATE.tracker));
  } catch(e) {}
}

function saveWater() {
  try {
    localStorage.setItem('detox_water', JSON.stringify(STATE.water));
  } catch(e) {}
}

let STATE_waterMaxAwarded = {};
try {
  const saved = localStorage.getItem('detox_water_max_awarded');
  if (saved) STATE_waterMaxAwarded = JSON.parse(saved);
} catch(e) {}

function saveWaterMaxAwarded() {
  try {
    localStorage.setItem('detox_water_max_awarded', JSON.stringify(STATE_waterMaxAwarded));
  } catch(e) {}
}

function saveSelections() {
  try {
    localStorage.setItem('detox_selections', JSON.stringify(STATE.selections));
  } catch(e) {}
}

/* ── NAVIGATION ───────────────────────────────────────────────────────────── */
function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById(`page-${pageId}`);
  const nav  = document.getElementById(`nav-${pageId}`);
  if (page) page.classList.add('active');
  if (nav)  nav.classList.add('active');
  STATE.activePage = pageId;
  window.scrollTo(0, 0);
  // Re-render plan banner on the newly active page
  if (typeof renderPlanBanner === 'function') renderPlanBanner();
  // Re-render tracker with plan gating applied so cloud-restored entries
  // are visible while free users still see only their allowed content.
  if (pageId === 'tracker' && isLoggedIn()) {
    if (typeof renderTracker === 'function') renderTracker();
    if (typeof applyContentGating === 'function') applyContentGating();
  }
}

/* ── RECIPE RENDERING ─────────────────────────────────────────────────────── */
function getSelection(recipeId, slotId) {
  const key = `${recipeId}_${slotId}`;
  return STATE.selections[key] || null;
}

function setSelection(recipeId, slotId, value) {
  const key = `${recipeId}_${slotId}`;
  STATE.selections[key] = value;
  saveSelections();
  // Sync this day's progress (recipeId pattern: "day1_breakfast")
  const dm = recipeId && recipeId.match(/^day(\d+)_/);
  if (dm) syncDailyProgress(_isoDateForDay(parseInt(dm[1])));
}

function renderSlotResult(recipe, slot, selectedValue) {
  const option = slot.options.find(o => o.value === selectedValue);
  if (!option) return '<div class="slot-result"><div class="slot-result-instr text-muted italic">Select an option above to see instructions.</div></div>';
  return `
    <div class="slot-result">
      <div class="slot-result-instr">${option.instruction}</div>
      ${option.note ? `<div class="slot-result-note">${option.note}</div>` : ''}
    </div>`;
}

function renderRecipeCard(recipe, compact = false) {
  const slots = recipe.slots.map(slot => {
    const saved = getSelection(recipe.id, slot.id);
    const selected = saved || slot.options[0].value;
    const optionsHtml = slot.options.map(o =>
      `<option value="${o.value}" ${o.value === selected ? 'selected' : ''}>${o.value}</option>`
    ).join('');

    return `
      <div class="slot-group">
        <div class="slot-name">${slot.name}</div>
        <div class="slot-why">${slot.why}</div>
        <select class="slot-select"
          data-recipe="${recipe.id}"
          data-slot="${slot.id}"
          onchange="onSlotChange(this)">
          ${optionsHtml}
        </select>
        <div id="slot-result-${recipe.id}-${slot.id}">
          ${renderSlotResult(recipe, slot, selected)}
        </div>
      </div>`;
  }).join('');

  const stepsHtml = recipe.steps.map((step, i) => `
    <div class="step-item">
      <div class="step-num">${i + 1}</div>
      <div class="step-content">
        <div class="step-title">${step.title}</div>
        <div class="step-text">${step.text}</div>
      </div>
    </div>`).join('');

  const tipsHtml = recipe.tips.map(tip =>
    `<div class="tip-item">${tip}</div>`
  ).join('');

  const amazonHtml = recipe.amazon.map(item => `
    <a href="${item.url}" target="_blank" rel="noopener" class="amazon-link">
      <span class="amazon-link-icon">🛒</span>
      <div class="amazon-link-text">
        <div class="amazon-link-name">${item.name}</div>
        <div class="amazon-link-note">${item.note}</div>
      </div>
      <span class="amazon-link-arrow">→</span>
    </a>`).join('');

  return `
    <div class="why-box">
      <div class="why-label">Why this meal</div>
      <div class="why-text">${recipe.why}</div>
    </div>

    <div class="slots-section">
      <div class="slots-title">Ingredient Swaps - Select Your Options</div>
      ${slots}
    </div>

    <div class="steps-section">
      <div class="steps-title">Step by Step</div>
      ${stepsHtml}
    </div>

    <div class="tips-section">
      <div class="tips-title">Tips and Notes</div>
      ${tipsHtml}
    </div>

    ${recipe.amazon.length ? `
    <div class="amazon-section">
      <div class="amazon-title">Shop Now</div>
      ${amazonHtml}
    </div>` : ''}`;
}

function onSlotChange(select) {
  const recipeId = select.dataset.recipe;
  const slotId   = select.dataset.slot;
  const value    = select.value;
  setSelection(recipeId, slotId, value);

  const recipe = RECIPE_DATA[recipeId];
  const slot   = recipe.slots.find(s => s.id === slotId);
  const resultEl = select.closest('.slot-group')
    ? select.closest('.slot-group').querySelector('[id^="slot-result-"]')
    : document.getElementById(`slot-result-${recipeId}-${slotId}`);
  if (resultEl && slot) {
    resultEl.innerHTML = renderSlotResult(recipe, slot, value);
    resultEl.style.animation = 'none';
    resultEl.offsetHeight; // reflow
    resultEl.style.animation = 'fadeIn 0.3s ease';
  }
}

/* ── CLEANSE DATE LOGIC ───────────────────────────────────────────────────── */

// Safe local date parser: 'YYYY-MM-DD' → midnight LOCAL timestamp
// (avoids the UTC-parse off-by-one that new Date('YYYY-MM-DD') causes)
function parseDateLocal(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

// Local YYYY-MM-DD string for a Date object (avoids toISOString UTC shift)
function toLocalDateStr(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Returns YYYY-MM-DD ISO date string for a given cleanse day number (1–7).
// Returns null if cleanseStartDate is not set.
function _isoDateForDay(dayNum) {
  const start = localStorage.getItem('cleanseStartDate');
  if (!start) return null;
  return toLocalDateStr(new Date(parseDateLocal(start) + (dayNum - 1) * 86400000));
}

// Returns current cleanse day 1-7 based on stored start date,
// null if no date set / future start, 8 if past Day 7 (complete).
function getCleanseDay() {
  const start = localStorage.getItem('cleanseStartDate');
  if (!start) return null;
  const startMs  = parseDateLocal(start);
  const todayMs  = new Date(new Date().setHours(0,0,0,0)).getTime();
  const diffDays = Math.floor((todayMs - startMs) / 86400000);
  if (diffDays < 0) return null;   // future start — not begun yet
  if (diffDays >= 7) return 8;     // 8 = "cleanse complete" sentinel
  return diffDays + 1;             // 1-7
}

// How many days remain (for progress bar label)
function getDaysRemaining() {
  const start = localStorage.getItem('cleanseStartDate');
  if (!start) return null;
  const startMs = parseDateLocal(start);
  const endMs   = startMs + 6 * 86400000; // Day 7 local midnight
  const todayMs = new Date(new Date().setHours(0,0,0,0)).getTime();
  return Math.max(0, Math.ceil((endMs - todayMs) / 86400000));
}

// Called when user taps "Start Today" or confirms a future date
function setCleanseStart(mode) {
  let dateStr;
  if (mode === 'today') {
    dateStr = toLocalDateStr(new Date());
  } else {
    const input = document.getElementById('cleanse-start-input');
    dateStr = input?.value;
    if (!dateStr) { alert('Please select a date.'); return; }
    const picked  = parseDateLocal(dateStr);
    const todayMs = new Date(new Date().setHours(0,0,0,0)).getTime();
    if (picked > todayMs + 30 * 86400000) {
      alert('Please pick a date within the next 30 days.'); return;
    }
  }
  localStorage.setItem('cleanseStartDate', dateStr);
  // Record which user set this date so a different account on the same device
  // doesn't inherit it (validated in _applySession on next login).
  if (typeof AUTH !== 'undefined' && AUTH.userId) {
    localStorage.setItem('cleanseUserId', AUTH.userId);
    if (window.sbClient) {
      window.sbClient.from('profiles')
        .update({ cleanse_start_date: dateStr })
        .eq('id', AUTH.userId)
        .then(() => {}).catch(e => console.error('[sync] cleanse start date sync failed:', e));
    }
  }
  closeDatePicker();
  const day = getCleanseDay() || 1;
  if (day <= 7) updateDayProgress(day);
  if (day <= 7) renderHome(); else renderCleanseSummary();
  // Re-render tracker day tabs to reflect the new date
  renderTrackerDayTabs();
}

function showDatePicker() {
  const overlay = document.getElementById('date-picker-overlay');
  if (!overlay) return;
  // Pre-fill date input with tomorrow's date (local timezone safe)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const input = document.getElementById('cleanse-start-input');
  if (input) input.value = toLocalDateStr(tomorrow);
  overlay.style.display = 'flex';
}

function closeDatePicker() {
  const overlay = document.getElementById('date-picker-overlay');
  if (overlay) overlay.style.display = 'none';
}

/* ── ONBOARDING FLOW (Fix 1) ──────────────────────────────────────────────── */
// Correct sequence: login → health screening → date picker → app
// Returns the localStorage key to use for health screening completion.
// User-specific when logged in so each account on the device has its own state.
function _healthKey() {
  return (typeof AUTH !== 'undefined' && AUTH.userId)
    ? 'healthScreeningComplete_' + AUTH.userId
    : 'healthScreeningComplete';
}

// Returns the stored health screening value, checking the user-specific key
// first. Migrates the legacy unprefixed key to the user-specific format the
// first time a logged-in user is seen, so existing users aren't re-prompted.
// Uses cleanseUserId as a proxy for AUTH.userId when the async session hasn't
// resolved yet (page load), so the correct key is found before AUTH is populated.
function _getHealthStatus() {
  const userId = AUTH.userId || localStorage.getItem('cleanseUserId');
  const userKey = userId ? 'healthScreeningComplete_' + userId : null;

  // Check user-specific key first
  if (userKey && localStorage.getItem(userKey)) {
    return true;
  }

  // Migration: legacy key exists — promote it to user-specific format so
  // subsequent reads use the per-user key and the old key is cleaned up.
  const legacy = localStorage.getItem('healthScreeningComplete');
  if (legacy && AUTH.userId) {
    localStorage.setItem('healthScreeningComplete_' + AUTH.userId, 'true');
    localStorage.removeItem('healthScreeningComplete');
    return true;
  }

  return legacy || null;
}

// Call startOnboardingFlow() after any auth event; it handles the sequence.

function startOnboardingFlow() {
  // Don't run before the async session resolves — AUTH.userId will be null on
  // page load until _initSupabaseSession completes. The explicit call inside
  // loadCloudData().then() picks it up once the session is confirmed.
  if (!AUTH.userId) return;
  // Don't run before cloud data is restored — health screening status and
  // cleanse start date must be back in localStorage before we check them.
  if (!_cloudDataLoaded) return;
  if (!isLoggedIn()) return;

  // Don't interrupt if auth modal is open
  const authModal = document.getElementById('auth-modal');
  if (authModal && authModal.classList.contains('active')) return;

  // Don't show a second overlay if one is already visible
  const healthOverlay = document.getElementById('health-screening-overlay');
  if (healthOverlay && healthOverlay.style.display !== 'none') return;
  const datePicker = document.getElementById('date-picker-overlay');
  if (datePicker && datePicker.style.display !== 'none') return;

  // Step 1: Health screening (must complete before anything else)
  if (!_getHealthStatus()) {
    setTimeout(showHealthScreening, 450);
    return;
  }

  // Step 2: Date picker (only after health is done)
  if (!localStorage.getItem('cleanseStartDate')) {
    setTimeout(showDatePicker, 350);
    return;
  }

  // Both done — restore health banner if previously warned
  if (_getHealthStatus() === 'warned') {
    const banner = document.getElementById('health-check-banner');
    if (banner && banner.style.display === 'none') banner.style.display = 'flex';
  }
}

// Legacy wrapper kept for backward-compat calls in auth.js
function maybeShowDatePicker() {
  if (!isLoggedIn()) return;
  if (!_getHealthStatus()) return; // health first
  if (localStorage.getItem('cleanseStartDate')) return;
  const modal = document.getElementById('auth-modal');
  if (modal && modal.classList.contains('active')) return;
  setTimeout(showDatePicker, 500);
}

/* ── HOME PAGE ────────────────────────────────────────────────────────────── */
function renderHome() {
  if (!document.getElementById('home-meals')) {
    const homePage = document.getElementById('page-home');
    if (homePage && window._homePageTemplate) homePage.innerHTML = window._homePageTemplate;
  }
  const container = document.getElementById('home-meals');
  container.innerHTML = '';

  // Render pre-cleanse recipe content into its card
  const preRecipe = RECIPE_DATA['pre-cleanse'];
  const preContent = document.getElementById('pre-cleanse-recipe-content');
  if (preContent && preRecipe) {
    preContent.innerHTML = renderRecipeCard(preRecipe);
  }
  renderAvoidCard(); // inserted inside .home-desktop-main, before #home-meals

  const MEAL_SVG = {
    'morning':   '<svg viewBox="0 0 24 24" fill="none" stroke="#1B4332" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="14" r="4.5" fill="#E9B94D" stroke="none"/><path d="M12 5v2.5M4.9 8.4l1.8 1.8M19.1 8.4l-1.8 1.8M3 14h2.5M18.5 14H21"/></svg>',
    'breakfast': '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4c-4 0-7 2.6-7 6.2C5 15.5 8 20 12 20s7-4.5 7-9.8C19 6.6 16 4 12 4z" fill="#D96A6A"/><circle cx="9.5" cy="10" r=".9" fill="#F7E4DA"/><circle cx="13.5" cy="13" r=".9" fill="#F7E4DA"/><circle cx="11" cy="16" r=".9" fill="#F7E4DA"/><path d="M12 4c.4-1.2 1.4-2 2.8-2" stroke="#5E8A5E" stroke-width="2" stroke-linecap="round"/><path d="M12 4.2c-1.8-1.4-3.8-1-4.6.2 1.4 1 3.2.8 4.6-.2z" fill="#74A57F"/></svg>',
    'juice':     '<svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8l-1 4H9L8 4z" fill="#E9B94D"/><path d="M9 8h6v9a3 3 0 01-3 3 3 3 0 01-3-3V8z" fill="#EFA05C"/><path d="M10.5 10.5h3M10.5 13h3" stroke="#FBE9DD" stroke-width="1.4" stroke-linecap="round"/><path d="M14.5 4.5L16 2" stroke="#74A57F" stroke-width="2" stroke-linecap="round"/></svg>',
    'lunch':     '<svg viewBox="0 0 24 24" fill="none"><path d="M4 11h16a8 8 0 01-16 0z" fill="#74A57F"/><path d="M4 11h16" stroke="#1B4332" stroke-width="1.6" stroke-linecap="round"/><path d="M8 8.5c1.2-1.5 3-1.5 4 0 1-1.5 2.8-1.5 4 0" stroke="#8DBB8F" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
    'snack':     '<svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8l-1 4H9L8 4z" fill="#E9B94D"/><path d="M9 8h6v9a3 3 0 01-3 3 3 3 0 01-3-3V8z" fill="#EFA05C"/><path d="M10.5 10.5h3M10.5 13h3" stroke="#FBE9DD" stroke-width="1.4" stroke-linecap="round"/><path d="M14.5 4.5L16 2" stroke="#74A57F" stroke-width="2" stroke-linecap="round"/></svg>',
    'dinner':    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 11h16a8 8 0 01-16 0z" fill="#74A57F"/><path d="M4 11h16" stroke="#1B4332" stroke-width="1.6" stroke-linecap="round"/><path d="M8 8.5c1.2-1.5 3-1.5 4 0 1-1.5 2.8-1.5 4 0" stroke="#8DBB8F" stroke-width="2" stroke-linecap="round" fill="none"/></svg>',
    'evening':   '<svg viewBox="0 0 24 24" fill="none" stroke="#1B4332" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="14" r="4.5" fill="#E9B94D" stroke="none"/><path d="M12 5v2.5M4.9 8.4l1.8 1.8M19.1 8.4l-1.8 1.8M3 14h2.5M18.5 14H21"/></svg>',
  };

  const mealsHtml = MEAL_ORDER.map(mealId => {
    const recipe = RECIPE_DATA[mealId];
    if (!recipe) return '';

    return `
      <div class="meal-card" id="home-card-${mealId}">
        <div class="meal-card-header" onclick="toggleMealCard('${mealId}')">
          <div class="meal-badge">
            ${MEAL_SVG[mealId] || MEAL_SVG['lunch']}
          </div>
          <div class="meal-card-info">
            <div class="meal-card-title">${recipe.title}</div>
            <div class="meal-card-sub">${recipe.subtitle}</div>
          </div>
          <span class="meal-card-time">${recipe.time}</span>
          <span class="meal-card-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></span>
        </div>
        <div class="meal-card-body">
          ${renderRecipeCard(recipe)}
        </div>
      </div>`;
  }).join('');

  container.innerHTML = mealsHtml;
  buildWaterGlasses();
  updateWaterDisplay();
  gateMealCards();
  updateDayBtnStates(); // Fix 1: sync Today page day buttons with 4-state system
  renderTodaySchedule();
  renderCompanionWidget();
  renderDailyChallenge();
  updateCompanionDisplay();
  try { applyPrepChecklist(); } catch(e) { console.warn('applyPrepChecklist failed:', e); }
  renderAdvancedCleanse();
}

function setCheckItemState(item, checked) {
  item.classList.toggle('checked', checked);
  const box = item.querySelector('.check-box');
  if (box) box.textContent = '✓';
}

function applyPrepChecklist() {
  STATE.prepChecklist = normalizePrepChecklist(STATE.prepChecklist);
  const items = document.querySelectorAll('#night-checklist .checklist-item');
  items.forEach(item => {
    const idx = item.dataset.index;
    setCheckItemState(item, !!STATE.prepChecklist.checked[idx]);
  });
}

function togglePreCleanse() {
  const body  = document.getElementById('pre-cleanse-body');
  const arrow = document.getElementById('pre-cleanse-arrow');
  if (!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if (arrow) arrow.style.transform = isOpen ? '' : 'rotate(90deg)';
}

function toggleCheck(el) {
  STATE.prepChecklist = normalizePrepChecklist(STATE.prepChecklist);
  const idx = el.dataset.index;
  const nowChecked = !STATE.prepChecklist.checked[idx];
  STATE.prepChecklist.checked[idx] = nowChecked;
  setCheckItemState(el, nowChecked);

  if (nowChecked && !STATE.prepChecklist.awarded[idx]) {
    awardPoints(POINTS_CHECKLIST_ITEM, 'checklist');
    STATE.prepChecklist.awarded[idx] = true;
  }

  try { localStorage.setItem('detox_prep_checklist', JSON.stringify(STATE.prepChecklist)); } catch(e) {}

  if (isLoggedIn() && window.sbClient && AUTH.userId) {
    window.sbClient.from('profiles')
      .update({ prep_checklist: STATE.prepChecklist })
      .eq('id', AUTH.userId)
      .then(() => {})
      .catch(e => console.warn('[sync] prep_checklist push failed:', e));
  }
}

function toggleMealCard(mealId) {
  const card = document.getElementById(`home-card-${mealId}`);
  if (!card) return;
  const wasOpen = card.classList.contains('open');
  card.classList.toggle('open');
  if (!wasOpen) {
    const today = toLocalDateStr(new Date());
    const awardedKey = 'detox_meal_awarded_' + today;
    let awarded = {};
    try { awarded = JSON.parse(localStorage.getItem(awardedKey) || '{}'); } catch(e) {}
    if (!awarded[mealId]) {
      awardPoints(POINTS_MEAL_LOGGED, 'meal');
      awarded[mealId] = true;
      try { localStorage.setItem(awardedKey, JSON.stringify(awarded)); } catch(e) {}
    }
  }
}

function updateDayProgress(day) {
  // Never switch to a future day — block any call site, not just the onclick handler.
  if (getDayState(day) === 'future') return;
  STATE.activeDay = day;
  document.querySelectorAll('.day-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i + 1 === day);
  });
  updateDayBtnStates(); // Fix 1: keep state indicators in sync
  const pct = ((day - 1) / 6) * 100;
  const fill  = document.getElementById('progress-fill');
  const label = document.getElementById('progress-label');
  if (fill) fill.style.width = pct + '%';

  if (label) {
    const rem = getDaysRemaining();
    if (rem !== null) {
      label.textContent = rem === 0 ? 'Final Day!' : `${rem} day${rem !== 1 ? 's' : ''} remaining`;
    } else {
      label.textContent = day < 7 ? `${7 - day} days remaining` : 'Day 7 — Final Day!';
    }
  }
  updateWaterDisplay();
  if (isLoggedIn()) updateCompanionDisplay();
}

/* ── WATER TRACKER ────────────────────────────────────────────────────────── */
const WATER_GLASSES_TOTAL = 12;   // 12 × 8 oz = 96 oz goal
const WATER_OZ_PER_GLASS  = 8;

// Build the 12-glass grid once (called from renderHome)
function buildWaterGlasses() {
  const container = document.getElementById('water-glasses-container');
  if (!container || container.dataset.built) return;
  container.dataset.built = '1';
  container.innerHTML = Array.from({length: WATER_GLASSES_TOTAL}, (_, i) => `
    <button class="water-glass" id="wg-${i}" onclick="toggleWater(${i})" aria-label="Glass ${i+1}">
      <svg viewBox="0 0 34 44">
        <defs><clipPath id="gc-${i}"><path d="M5 3 H29 L26 41 H8 Z"/></clipPath></defs>
        <g clip-path="url(#gc-${i})">
          <rect class="fill" x="0" y="8" width="34" height="36" fill="#7FB6C4"/>
          <ellipse class="fill" cx="17" cy="9" rx="14" ry="3" fill="#A8D2DC"/>
        </g>
        <path d="M5 3 H29 L26 41 H8 Z" fill="none" stroke="#B9C4B6" stroke-width="2.4" stroke-linejoin="round"/>
      </svg>
    </button>`).join('');
}

function updateWaterDisplay() {
  const day   = STATE.activeDay;
  const count = STATE.water[day] || 0;
  const oz    = count * WATER_OZ_PER_GLASS;
  const goal  = WATER_GLASSES_TOTAL * WATER_OZ_PER_GLASS;
  const pct   = Math.min((count / WATER_GLASSES_TOTAL) * 100, 100);

  // Fill glasses
  for (let i = 0; i < WATER_GLASSES_TOTAL; i++) {
    const g = document.getElementById(`wg-${i}`);
    if (g) g.classList.toggle('filled', i < count);
  }

  // Meter bar
  const fill = document.getElementById('water-meter-fill');
  if (fill) fill.style.width = pct + '%';

  // oz label
  const ozLabel = document.getElementById('water-oz-label');
  if (ozLabel) {
    ozLabel.textContent = `${oz} / ${goal} oz`;
    ozLabel.classList.toggle('goal-met', count >= WATER_GLASSES_TOTAL);
  }

  // Message
  const countEl = document.getElementById('water-count');
  if (countEl) {
    const msgs = [
      'Tap a glass to log water!',
      '8 oz in — great start!',
      '16 oz — keep it going!',
      '24 oz — you\'re warming up!',
      '32 oz — one-third there!',
      '40 oz — solid progress!',
      '48 oz — halfway! 🎯',
      '56 oz — more than halfway!',
      '64 oz — two-thirds done!',
      '72 oz — almost there!',
      '80 oz — one more push!',
      '88 oz — so close!',
      '96 oz — Daily goal hit! 🏆',
    ];
    countEl.textContent = msgs[Math.min(count, WATER_GLASSES_TOTAL)];
    countEl.style.color = count >= WATER_GLASSES_TOTAL ? 'var(--md-green)' : 'var(--teal)';
  }

  // Refresh Sol's growth stage art to reflect the new water count
  const svgWrap = document.getElementById('companion-svg');
  if (svgWrap && typeof renderSolArt === 'function') {
    const companion = getCompanion();
    svgWrap.innerHTML = renderSolArt({
      stage: solStageFromWater(count),
      expression: solExpressionFromMood(companion.mood),
      variant: 'plant'
    });
    const solSvg = svgWrap.querySelector('svg');
    if (solSvg) {
      solSvg.style.cursor = 'pointer';
      solSvg.onclick = tapCompanion;
      solSvg.classList.add('sf-svg');
      solSvg.classList.toggle('sf-thriving', companion.mood === 'thriving');
    }
  }
}

function toggleWater(index) {
  const day     = STATE.activeDay;
  const current = STATE.water[day] || 0;
  const newVal  = (index + 1 === current) ? index : index + 1;
  const filling = newVal > current;
  STATE.water[day] = newVal;
  saveWater();
  syncDailyProgress(_isoDateForDay(day));
  playWaterSound();
  const maxAwarded = STATE_waterMaxAwarded[day] || 0;
  if (filling && newVal > maxAwarded) {
    STATE_waterMaxAwarded[day] = newVal;
    saveWaterMaxAwarded();
    awardPoints(POINTS_WATER_GLASS, 'water');
  }
  // Fix 4: pop animation on tapped glass
  const glass = document.getElementById(`wg-${index}`);
  if (glass) {
    glass.classList.remove('popping');
    void glass.offsetHeight;           // force reflow to restart animation
    glass.classList.add('popping');
    setTimeout(() => glass.classList.remove('popping'), 320);
  }
  updateWaterDisplay();
}

// Web Audio API water-drop tone — no external file needed
function playWaterSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => ctx.close();
  } catch(e) { /* Audio not supported — silent */ }
}

/* ── RANDOM GENERATOR ─────────────────────────────────────────────────────── */
function randomize() {
  const results = document.getElementById('random-results');
  const btn = document.querySelector('.random-btn-icon');
  if (btn) {
    btn.style.animation = 'none';
    btn.offsetHeight;
    btn.style.animation = 'spin 0.5s ease';
  }

  const meals = MEAL_ORDER.filter(id => RECIPE_DATA[id]);
  const html = meals.map(mealId => {
    const recipe = RECIPE_DATA[mealId];
    const slotResults = recipe.slots.map(slot => {
      const randomOption = slot.options[Math.floor(Math.random() * slot.options.length)];
      setSelection(recipe.id, slot.id, randomOption.value);
      return `
        <div class="random-slot-result">
          <div class="random-slot-name">${slot.name}</div>
          <div class="random-slot-value">${randomOption.value}</div>
          <div class="random-slot-instr">${randomOption.instruction}</div>
        </div>`;
    }).join('');

    return `
      <div class="random-result">
        <div class="random-result-header" style="background:${recipe.color}11; border-bottom:1px solid ${recipe.color}22">
          <span class="random-result-icon">${recipe.icon}</span>
          <div class="random-result-info">
            <div class="random-result-meal">${recipe.subtitle}</div>
            <div class="random-result-name">${recipe.title}</div>
          </div>
        </div>
        <div class="random-result-body">
          ${slotResults}
        </div>
      </div>`;
  }).join('');

  if (results) {
    results.innerHTML = html;
    results.style.animation = 'none';
    results.offsetHeight;
    results.style.animation = 'fadeIn 0.4s ease';
  }
}

/* ── RECIPES PAGE ─────────────────────────────────────────────────────────── */
function renderRecipesPage() {
  const container = document.getElementById('recipes-list');
  if (!container) return;
  container.innerHTML = '';
  renderAvoidBanner();

  const allRecipes = ['pre-cleanse', ...MEAL_ORDER];
  allRecipes.forEach(mealId => {
    const recipe = RECIPE_DATA[mealId];
    if (!recipe) return;

    const div = document.createElement('div');
    div.className = 'card';
    div.id = `recipe-card-${mealId}`;
    div.innerHTML = `
      <div class="card-header" onclick="toggleRecipeCard('${mealId}')">
        <div class="card-icon" style="background:${recipe.color}22">
          <span>${recipe.icon}</span>
        </div>
        <div class="card-info">
          <div class="card-title">${recipe.title}</div>
          <div class="card-meta">${recipe.subtitle} &nbsp;·&nbsp; ${recipe.time}</div>
        </div>
        <span class="card-chevron">›</span>
      </div>
      <div class="card-body">
        ${renderRecipeCard(recipe)}
      </div>`;
    container.appendChild(div);
  });
  gateRecipeInstructions();
}

function toggleRecipeCard(mealId) {
  const card = document.getElementById(`recipe-card-${mealId}`);
  if (card) card.classList.toggle('open');
}

/* ── TRACKER PAGE ─────────────────────────────────────────────────────────── */
const METRICS    = ['Weight (lbs)', 'BMI', 'Body Fat %', 'Muscle %', 'Water %', 'Waist (in)', 'Hips (in)', 'Bone %'];
const METRIC_IDS = ['weight', 'bmi', 'bodyfat', 'muscle', 'water', 'waist', 'hips', 'bone'];
const WELLNESS_ITEMS = ['Energy Level', 'Mental Clarity', 'Mood', 'Sleep Quality', 'Hunger (10=not hungry)', 'Skin Appearance', 'Digestion', 'Overall Feeling'];
// Task 5: updated journal prompts (7 total; free sees 2, paid sees all)
const JOURNAL_QS = [
  'How are you feeling physically today?',
  'What did you eat today and how did it make you feel?',
  'What challenges did you face today?',
  'What are you most proud of today?',
  'What will you do differently tomorrow?',
  'Rate your energy level and describe it.',
  'Any detox symptoms or changes you noticed?',
];

const JOURNAL_MOODS = ['😩','😕','😐','🙂','😊'];

function renderTracker() {
  renderTrackerDayTabs();
  renderPastCleanses();    // inject after day tabs for advanced users
  renderMetrics();
  renderPhotos();       // Task 3: progress photos (Basic+)
  renderWellness();
  renderJournal();      // Task 5: enhanced journal with mood
  updateSummaryStats();
}

/* ── FIX 8: PAST CLEANSES HISTORY (seasonal, premium, lifetime only) ──────── */
function renderPastCleanses() {
  // Remove any previously injected section (re-render safe)
  const existing = document.getElementById('past-cleanses-section');
  if (existing) existing.remove();

  // Only visible to seasonal, premium, and lifetime users (Fix 8)
  // All three tiers hold 'advanced'; basic and free do not
  if (!canAccess('advanced')) return;

  const dayTabsEl = document.getElementById('tracker-day-tabs');
  if (!dayTabsEl) return;

  const cleanses = JSON.parse(localStorage.getItem('completedCleanse') || '[]');

  const section = document.createElement('div');
  section.id = 'past-cleanses-section';
  section.style.cssText = 'margin-top:20px;margin-bottom:4px;';

  if (cleanses.length === 0) {
    section.innerHTML = `
      <div class="section-title">Past Cleanses</div>
      <div class="callout">
        <div class="callout-label">No history yet</div>
        <div class="callout-text">Complete your first cleanse and tap "Start Another Cleanse" to see your history here.</div>
      </div>`;
  } else {
    // Build rows for each archived cleanse
    const rows = cleanses.map((c, idx) => {
      // Days logged in archived tracker
      let daysLogged = 0;
      for (let d = 1; d <= 7; d++) {
        if (METRIC_IDS.some(id => c.tracker && c.tracker[`metric_${d}_${id}`])) daysLogged++;
      }

      // Weight change
      const w1 = parseFloat(c.tracker && c.tracker['metric_1_weight']);
      const w7 = parseFloat(c.tracker && c.tracker['metric_7_weight']);
      let weightStr = '—';
      if (!isNaN(w1) && !isNaN(w7) && w1 > 0 && w7 > 0) {
        const diff = (w7 - w1).toFixed(1);
        weightStr = parseFloat(diff) <= 0 ? `−${Math.abs(diff)} lbs` : `+${diff} lbs`;
      }

      // Average energy score
      let totalE = 0, countE = 0;
      for (let d = 1; d <= 7; d++) {
        const v = parseFloat(c.tracker && c.tracker[`wellness_${d}_item0`]);
        if (!isNaN(v) && v > 0) { totalE += v; countE++; }
      }
      const avgE = countE > 0 ? (totalE / countE).toFixed(1) + '/10' : '—';

      // Format start date as human-readable
      let dateLabel = c.startDate || '—';
      if (c.startDate) {
        const [y, m, d] = c.startDate.split('-').map(Number);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        dateLabel = `${months[m-1]} ${d}, ${y}`;
      }

      return `
        <div class="past-cleanse-card">
          <div class="past-cleanse-header">
            <span class="past-cleanse-num">Cleanse #${idx + 1}</span>
            <span class="past-cleanse-date">${dateLabel}</span>
          </div>
          <div class="past-cleanse-stats">
            <span>📅 ${daysLogged}/7 days</span>
            <span>⚖️ ${weightStr}</span>
            <span>⚡ ${avgE} avg energy</span>
          </div>
        </div>`;
    }).reverse().join(''); // most recent first

    // Collapsible section
    section.innerHTML = `
      <div class="section-title past-cleanses-toggle" onclick="togglePastCleanses()" style="cursor:pointer">
        Past Cleanses
        <span id="past-cleanses-chevron" style="font-size:10px;font-weight:400;margin-left:4px">▼</span>
      </div>
      <div id="past-cleanses-list">${rows}</div>`;
  }

  dayTabsEl.after(section);
}

function renderAdvancedCleanse() {
  const existing = document.getElementById('advanced-cleanse-section');
  if (existing) existing.remove();

  // Visible to seasonal, premium, and lifetime only (guide-pdf distinguishes from basic/free)
  if (!canAccess('guide-pdf')) return;

  const anchorEl = document.getElementById('home-meals');
  if (!anchorEl) return;

  const section = document.createElement('div');
  section.id = 'advanced-cleanse-section';
  section.style.cssText = 'margin-top:20px;margin-bottom:4px;';
  section.innerHTML = `
    <div class="section-title">Advanced Cleanse</div>
    <div class="callout" style="text-align:center;padding:20px 16px;">
      <div style="font-size:32px;margin-bottom:10px;">&#x1F550;</div>
      <div class="callout-label" style="font-size:16px;margin-bottom:6px;">Coming Soon</div>
      <div class="callout-text">A deeper, more intensive cleanse program. Stay tuned.</div>
    </div>`;

  // Insert after past cleanses if present, otherwise directly after anchor
  const pastCleansesSection = document.getElementById('past-cleanses-section');
  if (pastCleansesSection) {
    pastCleansesSection.after(section);
  } else {
    anchorEl.after(section);
  }
}

function togglePastCleanses() {
  const list     = document.getElementById('past-cleanses-list');
  const chevron  = document.getElementById('past-cleanses-chevron');
  if (!list) return;
  const hidden = list.style.display === 'none';
  list.style.display = hidden ? 'block' : 'none';
  if (chevron) chevron.textContent = hidden ? '▼' : '▶';
}

/* ── SMART DAY PROGRESSION HELPERS ───────────────────────────────────────── */

// Returns true if a day has any logged data (journal, metric, or water)
function dayHasData(dayNum) {
  const hasMetric  = METRIC_IDS.some(id => getTrackerVal('metric', dayNum, id));
  const hasJournal = JOURNAL_QS.some((_, qi) => getTrackerVal('journal', dayNum, `q${qi}`));
  const hasWater   = (STATE.water[dayNum] || 0) > 0;
  return hasMetric || hasJournal || hasWater;
}

// ── SHARED utility (Fix 1) ─────────────────────────────────────────────────
// Returns the state for any cleanse day number:
//   'completed'  past day with logged data
//   'missed'     past day with no logged data
//   'today'      current calculated cleanse day
//   'future'     day that hasn't happened yet
//   'normal'     no start date set — all days freely accessible
function getDayState(dayNum) {
  // Logged-out users see all tiles in their default inactive state —
  // cleanseStartDate is preserved in localStorage across sign-out but
  // should not drive visual state until the user is authenticated.
  if (!isLoggedIn()) return 'normal';

  const todayDayNum  = getCleanseDay();
  const hasStartDate = !!localStorage.getItem('cleanseStartDate');

  if (!hasStartDate || todayDayNum === null) return 'normal';
  if (todayDayNum === 8) return dayHasData(dayNum) ? 'completed' : 'missed'; // cleanse done
  if (dayNum < todayDayNum) return dayHasData(dayNum) ? 'completed' : 'missed';
  if (dayNum === todayDayNum) return 'today';
  return 'future';
}

// ── Today page day buttons — apply 4-state visuals (Fix 1) ────────────────
function updateDayBtnStates() {
  const dayBtns = document.querySelectorAll('.day-btn');
  // FIX 1: When logged out, no day should be highlighted as active.
  if (!isLoggedIn()) {
    dayBtns.forEach(btn => btn.classList.remove('active'));
  }
  dayBtns.forEach((btn, i) => {
    const dayNum = i + 1;
    const state  = getDayState(dayNum);

    // Clear previous state classes and badges
    btn.classList.remove('day-btn-completed', 'day-btn-missed', 'day-btn-today', 'day-btn-future');
    btn.querySelectorAll('.day-btn-badge').forEach(el => el.remove());

    const dayLabelEl = btn.querySelector('.day-label');

    switch (state) {
      case 'completed':
        btn.classList.add('day-btn-completed');
        btn.onclick = () => updateDayProgress(dayNum);
        // Restore label
        if (dayLabelEl) dayLabelEl.textContent = 'Day';
        // Checkmark badge
        _addDayBtnBadge(btn, '✓', 'day-btn-badge-complete');
        break;

      case 'missed':
        btn.classList.add('day-btn-missed');
        btn.onclick = () => updateDayProgress(dayNum);
        if (dayLabelEl) dayLabelEl.textContent = 'Day';
        _addDayBtnBadge(btn, '⚠', 'day-btn-badge-missed');
        break;

      case 'today':
        btn.classList.add('day-btn-today');
        btn.onclick = () => updateDayProgress(dayNum);
        // Show "TODAY" in the label slot
        if (dayLabelEl) dayLabelEl.textContent = 'TODAY';
        break;

      case 'future':
        btn.classList.add('day-btn-future');
        if (dayLabelEl) dayLabelEl.textContent = 'Day';
        if (canAccess('days2to7')) {
          const unlockDate = getDayDate(dayNum);
          const msg = unlockDate
            ? `Day ${dayNum} unlocks on ${unlockDate}`
            : `Day ${dayNum} hasn't started yet`;
          btn.onclick = () => showDayToast(msg);
        }
        // else: free user -- onclick already set by gateMealCards (showUpgradeModal)
        break;

      default: // 'normal' -- no start date
        if (dayLabelEl) dayLabelEl.textContent = 'Day';
        if (dayNum === 1 || canAccess('days2to7')) {
          btn.onclick = () => updateDayProgress(dayNum);
        }
        // else: free user on day 2-7 -- onclick already set by gateMealCards
        break;
    }
  });
}

function _addDayBtnBadge(btn, icon, extraClass) {
  const badge = document.createElement('div');
  badge.className = `day-btn-badge ${extraClass}`;
  badge.textContent = icon;
  btn.appendChild(badge);
}

// Returns a human-readable date string for a given cleanse day number
function getDayDate(dayNum) {
  const start = localStorage.getItem('cleanseStartDate');
  if (!start) return null;
  const startMs = parseDateLocal(start);
  const d = new Date(startMs + (dayNum - 1) * 86400000);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

// Show a brief toast above the bottom nav
function showDayToast(msg) {
  const existing = document.getElementById('day-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'day-toast';
  toast.className = 'day-toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 2600);
}

function renderTrackerDayTabs() {
  const container = document.getElementById('tracker-day-tabs');
  if (!container) return;

  const hasStartDate = !!localStorage.getItem('cleanseStartDate');

  const tabsHtml = Array.from({length: 7}, (_, i) => {
    const dayNum   = i + 1;
    const isActive = STATE.trackerDay === dayNum;

    // Use shared getDayState() — same logic as Today page (Fix 1)
    const rawState = getDayState(dayNum);
    const state    = rawState === 'normal' && isActive ? 'today' : rawState;

    // ── Build tab HTML ───────────────────────────────────────────────────
    let badge   = '';
    let onclick = '';
    let title   = '';
    let extraClass = '';

    if (state === 'completed') {
      badge   = '<div class="day-tab-badge day-tab-badge-complete">✓</div>';
      onclick = `setTrackerDay(${dayNum})`;
      extraClass = 'day-tab-completed';
    } else if (state === 'missed') {
      badge   = '<div class="day-tab-badge day-tab-badge-missed">⚠</div>';
      onclick = `setTrackerDay(${dayNum})`;
      title   = `No data logged for Day ${dayNum} — tap to add it now`;
      extraClass = 'day-tab-missed';
    } else if (state === 'today') {
      badge   = '<div class="day-tab-today-label">TODAY</div>';
      onclick = `setTrackerDay(${dayNum})`;
      extraClass = 'day-tab-today';
    } else if (state === 'future') {
      const unlockDate = getDayDate(dayNum);
      const toastMsg   = unlockDate
        ? `Day ${dayNum} unlocks on ${unlockDate}`
        : `Day ${dayNum} hasn't started yet`;
      // Escape for inline onclick attribute
      const escapedMsg = toastMsg.replace(/'/g, "\\'");
      onclick    = `showDayToast('${escapedMsg}')`;
      extraClass = 'day-tab-future';
    } else {
      // 'normal' — no start date
      onclick    = `setTrackerDay(${dayNum})`;
      extraClass = isActive ? 'active' : '';
    }

    const activeClass = (isActive && state !== 'future') ? ' active' : '';
    return `<div class="day-tab day-btn ${extraClass}${activeClass}"
                 onclick="${onclick}"
                 ${title ? `title="${title}"` : ''}
            ><div class="day-num">${dayNum}</div><div class="day-label">Day</div>${badge}</div>`;
  }).join('');

  // "Wrong day? Reset" link — only when a start date is set
  const resetLink = hasStartDate ? `
    <div class="day-tab-reset-link" onclick="resetCleanseDate()">Wrong day?</div>` : '';

  container.innerHTML = tabsHtml + resetLink;
}

function setTrackerDay(day) {
  STATE.trackerDay = day;
  renderTrackerDayTabs();
  // Re-apply subscription gating to freshly-rendered tabs
  if (typeof applyContentGating === 'function') applyContentGating();
  renderMetrics();
  renderPhotos();    // Task 3: refresh photo slots for selected day
  renderWellness();
  renderJournal();
}

function getTrackerVal(type, day, key) {
  return STATE.tracker[`${type}_${day}_${key}`] || '';
}

function setTrackerVal(type, day, key, value) {
  STATE.tracker[`${type}_${day}_${key}`] = value;
  saveTracker();
}

function renderMetrics() {
  const container = document.getElementById('metrics-grid');
  if (!container) return;
  const day = STATE.trackerDay;

  const inputTiles = METRICS.map((label, i) => {
    const id   = METRIC_IDS[i];
    const val  = getTrackerVal('metric', day, id);
    const day1 = getTrackerVal('metric', 1, id);
    const day7 = getTrackerVal('metric', 7, id);
    let changeHtml = '';
    if (day1 && day7 && day === 7) {
      const diff = (parseFloat(day7) - parseFloat(day1)).toFixed(1);
      const cls  = diff < 0 ? 'positive' : diff > 0 ? 'negative' : '';
      const sign = diff > 0 ? '+' : '';
      changeHtml = `<div class="metric-change ${cls}">${sign}${diff} since Day 1</div>`;
    }
    // Trigger WHR recalc when waist or hips change
    const whrUpdate = (id === 'waist' || id === 'hips')
      ? ` updateWHRDisplay(${day});` : '';
    return `
      <div class="metric-card">
        <div class="metric-label">${label}</div>
        <input class="metric-input"
          type="number" step="0.1" inputmode="decimal"
          placeholder="--"
          value="${val}"
          onchange="setTrackerVal('metric', ${day}, '${id}', this.value); updateSummaryStats();${whrUpdate}" />
        ${changeHtml}
      </div>`;
  }).join('');

  container.innerHTML = inputTiles + renderWHRTile(day);
}

function renderWHRTile(day) {
  const waist = parseFloat(getTrackerVal('metric', day, 'waist'));
  const hips  = parseFloat(getTrackerVal('metric', day, 'hips'));
  const whrVal = (!isNaN(waist) && !isNaN(hips) && hips > 0)
    ? (waist / hips).toFixed(2)
    : '--';
  return `
    <div class="metric-card metric-card-calculated" id="whr-tile-${day}">
      <div class="metric-label">Waist-to-Hip</div>
      <div class="metric-display">${whrVal}</div>
      <div class="whr-range-note">
        &lt; 0.85 healthy (women)<br>&lt; 0.90 healthy (men)
      </div>
    </div>`;
}

function updateWHRDisplay(day) {
  const tile = document.getElementById(`whr-tile-${day}`);
  if (!tile) return;
  const waist = parseFloat(getTrackerVal('metric', day, 'waist'));
  const hips  = parseFloat(getTrackerVal('metric', day, 'hips'));
  const display = tile.querySelector('.metric-display');
  if (display) {
    display.textContent = (!isNaN(waist) && !isNaN(hips) && hips > 0)
      ? (waist / hips).toFixed(2)
      : '--';
  }
}

function renderWellness() {
  const container = document.getElementById('wellness-grid');
  if (!container) return;
  const day = STATE.trackerDay;

  container.innerHTML = WELLNESS_ITEMS.map((label, wi) => {
    const current = getTrackerVal('wellness', day, `item${wi}`);
    const btns = Array.from({length: 10}, (_, i) => {
      const n = i + 1;
      return `<button class="scale-btn ${current == n ? 'selected' : ''}"
        onclick="setWellness(${day}, ${wi}, ${n})">${n}</button>`;
    }).join('');
    return `
      <div class="wellness-item">
        <div class="wellness-label">${label}</div>
        <div class="wellness-scale">${btns}</div>
      </div>`;
  }).join('');
}

function setWellness(day, itemIndex, value) {
  const current = getTrackerVal('wellness', day, `item${itemIndex}`);
  const newVal  = current == value ? '' : value;
  setTrackerVal('wellness', day, `item${itemIndex}`, newVal);
  renderWellness();
  updateSummaryStats();
}

function renderJournal() {
  const container = document.getElementById('journal-prompts');
  if (!container) return;
  const day = STATE.trackerDay;

  // ── Mood selector (Task 5) ─────────────────────────────────────────────
  const moodVal = getTrackerVal('mood', day, 'value');
  const moodHtml = `
    <div class="journal-mood-wrap">
      <div class="journal-mood-label">How are you feeling today?</div>
      <div class="journal-mood-options">
        ${JOURNAL_MOODS.map((emoji, i) => `
          <button class="mood-btn ${moodVal !== '' && Number(moodVal) === i ? 'selected' : ''}"
                  onclick="selectMood(${day}, ${i})">${emoji}</button>
        `).join('')}
      </div>
    </div>`;

  // ── Prompts (Task 5: 7 prompts, free users see 2 via gateTracker) ─────
  const promptsHtml = JOURNAL_QS.map((q, qi) => {
    const val = getTrackerVal('journal', day, `q${qi}`);
    return `
      <div class="journal-prompt">
        <div class="journal-q">${q}</div>
        <textarea class="journal-input" rows="2" placeholder="Write here..."
          oninput="setTrackerVal('journal', ${day}, 'q${qi}', this.value)"
        >${val}</textarea>
      </div>`;
  }).join('');

  // ── Save bar (Task 5) ────────────────────────────────────────────────
  const lastSaved = getTrackerVal('journal', day, 'lastSaved');
  const saveBarHtml = `
    <div class="journal-save-bar">
      <button class="journal-save-btn" id="journal-save-btn" onclick="saveJournalEntry()">
        Save Journal Entry
      </button>
      <div class="journal-last-saved" id="journal-last-saved"
           style="${lastSaved ? '' : 'visibility:hidden'}">
        Last saved: ${lastSaved || '—'}
      </div>
    </div>`;

  container.innerHTML = moodHtml + promptsHtml + saveBarHtml;
}

// Task 5: select mood emoji for the day
function selectMood(day, index) {
  setTrackerVal('mood', day, 'value', index);
  document.querySelectorAll('.mood-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === index);
  });
}

// Task 5: save journal entry with timestamp confirmation
function saveJournalEntry() {
  saveTracker();
  const _jd = _isoDateForDay(STATE.trackerDay);
  if (_jd) { syncDailyProgress(_jd); syncBodyMetrics(STATE.trackerDay); }
  const now     = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  setTrackerVal('journal', STATE.trackerDay, 'lastSaved', timeStr);

  const btn        = document.getElementById('journal-save-btn');
  const lastSavedEl = document.getElementById('journal-last-saved');

  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ Saved!';
    btn.classList.add('journal-save-success');
    setTimeout(() => {
      btn.innerHTML = orig;
      btn.classList.remove('journal-save-success');
    }, 2000);
  }
  if (lastSavedEl) {
    lastSavedEl.textContent = 'Last saved: ' + timeStr;
    lastSavedEl.style.visibility = 'visible';
  }
}

/* ── TASK 3: PROGRESS PHOTOS ─────────────────────────────────────────────── */
function renderPhotos() {
  // Hidden entirely for free users
  const existing = document.getElementById('photos-section');
  if (existing) existing.remove();
  if (!canAccess('photos')) return;

  const metricsGrid = document.getElementById('metrics-grid');
  if (!metricsGrid) return;

  const slotsHtml = [1,2,3,4,5,6,7].map(d => {
    const photo = localStorage.getItem(`photos_day_${d}`);
    const isActive = d === STATE.trackerDay ? 'photo-slot photo-active' : 'photo-slot';

    if (photo) {
      return `
        <div class="${isActive}" data-day="${d}">
          <div class="photo-day-num">Day ${d}</div>
          <div class="photo-thumb-wrap">
            <img src="${photo}" class="photo-thumb" alt="Day ${d} photo" />
            <button class="photo-delete-btn" onclick="deletePhoto(${d})" title="Delete photo">🗑</button>
          </div>
        </div>`;
    }
    return `
      <div class="${isActive}" data-day="${d}">
        <div class="photo-day-num">Day ${d}</div>
        <label class="photo-placeholder" for="photo-input-${d}" title="Add photo for Day ${d}">
          <span class="photo-placeholder-icon">📷</span>
          <span class="photo-placeholder-text">Add</span>
          <input type="file" id="photo-input-${d}" accept="image/*" style="display:none"
                 onchange="uploadPhoto(event, ${d})" />
        </label>
      </div>`;
  }).join('');

  const syncNote = (isLoggedIn() && AUTH.plan !== 'free')
    ? 'Photos saved to your account and synced across devices.'
    : `Photos stored on this device. <span class="sync-link" onclick="navigateAuth('login'); document.getElementById('auth-modal').classList.add('active')">Sign in</span> to back up to the cloud.`;

  const section = document.createElement('div');
  section.id = 'photos-section';
  section.innerHTML = `
    <div class="section-title mt-20">Progress Photos</div>
    <div class="photos-grid">${slotsHtml}</div>
    <div class="photos-sync-note">${syncNote}</div>`;

  metricsGrid.after(section);

  // Fill in any cloud photos not in localStorage (fire-and-forget)
  if (isLoggedIn() && AUTH.access_token) _loadCloudPhotos();
}

function uploadPhoto(event, day) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;
  if (file.size > 5 * 1024 * 1024) {
    alert('Photo must be under 5 MB. Please choose a smaller image.');
    return;
  }
  compressImage(file, 800).then(dataUrl => {
    try {
      localStorage.setItem(`photos_day_${day}`, dataUrl);
    } catch(e) {
      alert('Not enough storage space to save this photo. Try deleting older photos.');
      return;
    }
    const existing = document.getElementById('photos-section');
    if (existing) existing.remove();
    renderPhotos();
    // Sync to cloud (fire-and-forget)
    if (isLoggedIn() && AUTH.access_token) _syncPhotoToCloud(day, dataUrl);
  }).catch(() => alert('Could not process this image. Please try another.'));
}

function deletePhoto(day) {
  if (!confirm(`Delete your Day ${day} progress photo?`)) return;
  localStorage.removeItem(`photos_day_${day}`);
  const existing = document.getElementById('photos-section');
  if (existing) existing.remove();
  renderPhotos();
  // Delete from cloud (fire-and-forget)
  if (isLoggedIn() && AUTH.access_token) _deleteCloudPhoto(day);
}

async function _syncPhotoToCloud(day, dataUrl) {
  try {
    await fetch('/api/photo-upload', {
      method:  'POST',
      headers: { 'Authorization': 'Bearer ' + AUTH.access_token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ file: dataUrl, day }),
    });
  } catch(e) {
    console.warn('[photos] cloud sync failed:', e);
  }
}

async function _deleteCloudPhoto(day) {
  try {
    await fetch('/api/photo-upload', {
      method:  'DELETE',
      headers: { 'Authorization': 'Bearer ' + AUTH.access_token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ day }),
    });
  } catch(e) {
    console.warn('[photos] cloud delete failed:', e);
  }
}

async function _loadCloudPhotos() {
  if (!AUTH.access_token) return;
  const grid = document.querySelector('#photos-section .photos-grid');
  if (!grid) return;
  for (let d = 1; d <= 7; d++) {
    if (localStorage.getItem(`photos_day_${d}`)) continue; // already displayed from localStorage
    const slot = grid.querySelector(`[data-day="${d}"]`);
    if (!slot) continue;
    try {
      const resp = await fetch(`/api/photo-url?day=${d}`, {
        headers: { 'Authorization': 'Bearer ' + AUTH.access_token },
      });
      if (!resp.ok) continue;
      const { url } = await resp.json();
      if (!url) continue;
      // Patch the slot DOM in-place (don't re-render to avoid flash)
      const isActive = d === STATE.trackerDay ? 'photo-slot photo-active' : 'photo-slot';
      slot.className = isActive;
      slot.innerHTML = `
        <div class="photo-day-num">Day ${d}</div>
        <div class="photo-thumb-wrap">
          <img src="${url}" class="photo-thumb" alt="Day ${d} photo" />
          <button class="photo-delete-btn" onclick="deletePhoto(${d})" title="Delete photo">🗑</button>
        </div>`;
    } catch(e) {
      console.warn(`[photos] could not load cloud photo day ${d}:`, e);
    }
  }
}

function compressImage(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function updateSummaryStats() {
  // Count days with any entry
  let daysLogged = 0;
  for (let d = 1; d <= 7; d++) {
    const hasEntry = METRIC_IDS.some(id => getTrackerVal('metric', d, id));
    if (hasEntry) daysLogged++;
  }

  // Weight change
  const w1 = parseFloat(getTrackerVal('metric', 1, 'weight'));
  const wCurrent = Array.from({length: 7}, (_, i) => parseFloat(getTrackerVal('metric', 7-i, 'weight'))).find(v => !isNaN(v));
  let weightChange = '--';
  if (!isNaN(w1) && wCurrent) {
    const diff = (wCurrent - w1).toFixed(1);
    weightChange = diff <= 0 ? `${Math.abs(diff)} lbs` : `+${diff} lbs`;
  }

  // Average energy
  let totalEnergy = 0, energyCount = 0;
  for (let d = 1; d <= 7; d++) {
    const v = parseFloat(getTrackerVal('wellness', d, 'item0'));
    if (!isNaN(v) && v > 0) { totalEnergy += v; energyCount++; }
  }
  const avgEnergy = energyCount > 0 ? (totalEnergy / energyCount).toFixed(1) : '--';

  const el1 = document.getElementById('stat-days');
  const el2 = document.getElementById('stat-weight');
  const el3 = document.getElementById('stat-energy');
  if (el1) el1.textContent = daysLogged;
  if (el2) el2.textContent = weightChange;
  if (el3) el3.textContent = avgEnergy === '--' ? '--' : avgEnergy + '/10';
}

function saveDay() {
  saveTracker();
  const _sd = _isoDateForDay(STATE.trackerDay);
  if (_sd) { syncDailyProgress(_sd); syncBodyMetrics(STATE.trackerDay); }
  awardPoints(POINTS_JOURNAL_ENTRY, 'journal');
  const toast = document.getElementById('save-toast');
  if (toast) {
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 2000);
  }
}

/* ── SHOP PAGE ────────────────────────────────────────────────────────────── */
function renderShop(filter) {
  STATE.shopFilter = filter || STATE.shopFilter;

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === STATE.shopFilter);
  });

  const container = document.getElementById('shop-list');
  if (!container) return;
  container.innerHTML = '';

  const isPaid = canAccess('shop-links');

  function getItemIcon(name, bucketId) {
    if (bucketId === 'percleanse') return '🛍️';
    if (bucketId === 'restock')    return '💊';
    const n = name || '';
    if (n.includes('Blender') || n.includes('Skillet')) return '🍳';
    if (n.includes('Juicer'))   return '🥤';
    if (n.includes('Steamer') || n.includes('Basket')) return '♨️';
    if (n.includes('Bamboo'))   return '🎍';
    if (n.includes('Body Scale')) return '⚖️';
    if (n.includes('Kitchen Scale') || n.includes('Portable Kitchen')) return '⚖️';
    if (n.includes('Shaker'))   return '🧉';
    if (n.includes('Water'))    return '💧';
    if (n.includes('Cooler'))   return '🧊';
    if (n.includes('Container') || n.includes('Pyrex')) return '🫙';
    if (n.includes('Grater'))   return '🔪';
    if (n.includes('Photo'))    return '📸';
    return '🔌';
  }

  function renderGroupItem(item, isPaid) {
    const firstOpt = item.options[0];
    const groupId  = 'shop-group-' + item.group;
    const notesJson = JSON.stringify(item.options.map(o => o.note)).replace(/'/g, "\\'");
    const urlsJson  = JSON.stringify(item.options.map(o => o.url)).replace(/'/g, "\\'");

    // Fix 5: free users see generic option labels instead of brand names
    // Basic+ users see the real labels from SHOP_DATA
    const brandMasked = !isPaid && !canAccess('shop-links');
    const optionsHtml = item.options.map((o, i) => {
      const label = brandMasked
        ? (item.label + ' — Option ' + (i + 1)) // generic: "Blender — Option 1"
        : o.label;
      return '<option value="' + i + '">' + label + '</option>';
    }).join('');
    const shopBtn  = isPaid
      ? '<a href="' + firstOpt.url + '" target="_blank" rel="noopener" id="' + groupId + '-btn" class="shop-group-btn">Shop Now</a>'
      : '<button class="shop-group-btn shop-group-btn-locked" onclick="showUpgradeModal(this.dataset.msg)" data-msg="Unlock all shopping links with any paid plan.">Unlock</button>';

    // Fix 5: brand-lock indicator shown on dropdown for free users
    const brandLockNote = brandMasked
      ? '<div class="shop-brand-lock-note">🔒 Upgrade to see recommended brands</div>'
      : '';

    return [
      '<div class="shop-group-row" id="' + groupId + '">',
        '<div class="shop-group-header">',
          '<span class="shop-group-icon">' + item.icon + '</span>',
          '<div class="shop-group-label-wrap">',
            '<div class="shop-group-label">' + item.label + '</div>',
            '<div class="shop-group-sublabel">' + item.sublabel + '</div>',
          '</div>',
          '<span class="shop-pick-one-pill">' + (item.required ? 'Pick one' : 'Optional') + '</span>',
        '</div>',
        '<div class="shop-group-body">',
          brandLockNote,
          '<div class="shop-group-select-wrap">',
            '<select class="shop-group-select"',
              ' data-notes="' + notesJson + '"',
              ' data-urls="' + urlsJson + '"',
              ' data-groupid="' + groupId + '"',
              ' data-paid="' + isPaid + '"',
              ' onchange="onShopGroupChange(this)">',
              optionsHtml,
            '</select>',
            '<span class="shop-group-arrow">&#9662;</span>',
          '</div>',
          '<div class="shop-group-result">',
            '<div class="shop-group-note" id="' + groupId + '-note">' + firstOpt.note + '</div>',
            shopBtn,
          '</div>',
        '</div>',
      '</div>'
    ].join('');
  }

  function renderSingleItem(item, isPaid, bucketId) {
    const icon = getItemIcon(item.name, bucketId);
    const actionHtml = isPaid
      ? '<span class="amazon-link-arrow">→</span>'
      : '<button class="shop-btn-unlock" onclick="showUpgradeModal(this.dataset.msg)" data-msg="Unlock all shopping links with any paid plan.">Unlock</button>';
    const clickAttr = isPaid
      ? 'href="' + item.url + '" target="_blank" rel="noopener"'
      : 'onclick="showUpgradeModal(this.dataset.msg)" data-msg="Unlock all shopping links with any paid plan."';
    return '<a ' + clickAttr + ' class="amazon-link' + (!isPaid ? ' shop-item-gated' : '') + '">'
      + '<span class="amazon-link-icon">' + icon + '</span>'
      + '<div class="amazon-link-text">'
      + '<div class="amazon-link-name">' + item.name
      + (item.priority ? '<span class="priority-badge">Essential</span>' : '')
      + '</div>'
      + '<div class="amazon-link-note">' + item.note + '</div>'
      + '</div>'
      + actionHtml
      + '</a>';
  }

  const buckets = {
    onetime:    { label: 'One-Time Equipment',       badge: 'Buy Once, Use Every Cleanse',      color: 'var(--teal)',     desc: 'Each category below requires only one item. Use the dropdown to compare options, then tap Shop Now on your choice.' },
    percleanse: { label: 'Cleanse Groceries',    badge: 'Buy Fresh Each Time - ~$80-$120',  color: 'var(--md-green)', desc: 'Fresh food for the week. Plan two shopping trips: once before Day 1 and once around Day 4.' },
    restock:    { label: 'Supplements & Seasonings', badge: 'Restock When Running Low',         color: 'var(--amber)',    desc: 'Most last multiple cleanses. Check your stock before each cleanse and reorder only what you need.' },
  };

  const showBuckets = STATE.shopFilter === 'all'
    ? ['onetime', 'percleanse', 'restock']
    : STATE.shopFilter === 'delivery' ? []
    : [STATE.shopFilter];

  showBuckets.forEach(bucketId => {
    const bucket  = buckets[bucketId];
    const items   = SHOP_DATA[bucketId] || [];
    const groups  = items.filter(i => i.group);
    const singles = items.filter(i => !i.group);

    const FREE_SINGLES = { onetime: 4, percleanse: 2, restock: 1 };
    const visibleSingles = isPaid ? singles : singles.slice(0, FREE_SINGLES[bucketId] || 2);
    const lockedSingles  = isPaid ? [] : singles.slice(FREE_SINGLES[bucketId] || 2);

    const groupsHtml  = groups.map(g => renderGroupItem(g, isPaid)).join('');
    const singlesHtml = visibleSingles.map(i => renderSingleItem(i, isPaid, bucketId)).join('');

    let lockedHtml = '';
    if (lockedSingles.length > 0) {
      const blurred = lockedSingles.slice(0, 3).map(i => {
        const icon = getItemIcon(i.name, bucketId);
        return '<div class="amazon-link shop-item-blurred">'
          + '<span class="amazon-link-icon">' + icon + '</span>'
          + '<div class="amazon-link-text">'
          + '<div class="amazon-link-name">' + i.name + '</div>'
          + '<div class="amazon-link-note">' + i.note + '</div>'
          + '</div></div>';
      }).join('');
      lockedHtml = '<div class="shop-blur-stack"><div class="shop-blur-inner">' + blurred + '</div>'
        + '<div class="shop-blur-badge"><span class="shop-blur-count">+ ' + lockedSingles.length + ' more items locked</span></div></div>';
    }

    const singlesSectionLabel = (groups.length > 0 && singles.length > 0)
      ? '<div class="shop-singles-label">Single items - no choice needed</div>'
      : '';

    container.innerHTML += '<div class="shop-bucket-header" style="border-left-color:' + bucket.color + '">'
      + '<div class="shop-bucket-title">' + bucket.label + '</div>'
      + '<div class="shop-bucket-badge" style="background:' + bucket.color + '">' + bucket.badge + '</div>'
      + '<div class="shop-bucket-desc">' + bucket.desc + '</div>'
      + '</div>'
      + groupsHtml
      + singlesSectionLabel
      + singlesHtml
      + lockedHtml
      + '<div style="height:8px"></div>';
  });

  // Delivery section
  if (STATE.shopFilter === 'all' || STATE.shopFilter === 'delivery') {
    const deliveryItems = SHOP_DATA.delivery || [];
    const visibleDel    = isPaid ? deliveryItems : deliveryItems.slice(0, 1);
    const lockedDel     = isPaid ? [] : deliveryItems.slice(1);

    const visDelHtml = visibleDel.map(item => {
      const arrow  = '<span class="amazon-link-arrow">&#8594;</span>';
      const unlock = '<button class="shop-btn-unlock" data-msg="Unlock all delivery service links." onclick="showUpgradeModal(this.dataset.msg)">Unlock</button>';
      const inner  = '<span class="amazon-link-icon">' + item.icon + '</span>'
        + '<div class="amazon-link-text"><div class="amazon-link-name">' + item.name
        + (item.affiliate ? '<span class="priority-badge">Earns Commission</span>' : '')
        + '</div><div class="amazon-link-note">' + item.note + '</div></div>'
        + (isPaid ? arrow : unlock);
      return isPaid
        ? '<a href="' + item.url + '" target="_blank" rel="noopener" class="amazon-link delivery-link">' + inner + '</a>'
        : '<div class="amazon-link delivery-link shop-item-gated" data-msg="Unlock all delivery service links." onclick="showUpgradeModal(this.dataset.msg)">' + inner + '</div>';
    }).join('');

    let lockedDelHtml = '';
    if (lockedDel.length > 0) {
      const blurred = lockedDel.slice(0, 3).map(i =>
        '<div class="amazon-link delivery-link shop-item-blurred">'
        + '<span class="amazon-link-icon">' + i.icon + '</span>'
        + '<div class="amazon-link-text"><div class="amazon-link-name">' + i.name + '</div>'
        + '<div class="amazon-link-note">' + i.note + '</div></div></div>'
      ).join('');
      lockedDelHtml = '<div class="shop-blur-stack"><div class="shop-blur-inner">' + blurred + '</div>'
        + '<div class="shop-blur-badge"><span class="shop-blur-count">+ ' + lockedDel.length + ' more services locked</span></div></div>';
    }

    container.innerHTML += '<div class="shop-bucket-header" style="border-left-color:#534AB7">'
      + '<div class="shop-bucket-title">Prefer Delivery?</div>'
      + '<div class="shop-bucket-badge" style="background:#534AB7">Order Groceries to Your Door</div>'
      + '<div class="shop-bucket-desc">Do not want to shop in person? Order your weekly produce and groceries delivered.</div>'
      + '</div>' + visDelHtml + lockedDelHtml;
  }

  if (!isPaid) gateShopLinks();
  // Fix 8: render survey card for logged-in users at bottom of shop
  if (typeof renderSurveyCard === 'function') renderSurveyCard();
}

// Called when user changes a shop group dropdown
function onShopGroupChange(select) {
  const idx     = parseInt(select.value);
  const notes   = JSON.parse(select.dataset.notes || '[]');
  const urls    = JSON.parse(select.dataset.urls  || '[]');
  const groupId = select.dataset.groupid;
  const isPaid  = select.dataset.paid === 'true';
  const noteEl  = document.getElementById(groupId + '-note');
  const btnEl   = document.getElementById(groupId + '-btn');
  if (noteEl && notes[idx] !== undefined) noteEl.textContent = notes[idx];
  if (btnEl  && urls[idx]  !== undefined) btnEl.href = urls[idx];
}


/* ── POST-PURCHASE UPSELL ─────────────────────────────────────────────────── */
function showUpsell(planId) {
  // Show a one-time upsell for the guide + spreadsheet bundle after plan selection
  if (planId === 'free') return;
  const modal = document.getElementById('auth-modal');
  const screen = document.getElementById('auth-payment');
  if (!screen) return;

  // Only show if user does not already have the bundle noted
  const hasBought = localStorage.getItem('detox_bundle_purchased');
  if (hasBought) return;

  const upsell = document.createElement('div');
  upsell.className = 'upsell-banner';
  upsell.innerHTML = `
    <div class="upsell-icon">📖</div>
    <div class="upsell-text">
      <div class="upsell-title">Add the Complete Guide + Spreadsheet</div>
      <div class="upsell-desc">The interactive spreadsheet and full guide PDF are the perfect companions to the app. One-time add-on today only.</div>
    </div>
    <div class="upsell-actions">
      <button class="upsell-btn-yes" onclick="markBundlePurchased(); this.closest('.upsell-banner').remove();">Add for $24.99</button>
      <button class="upsell-btn-no" onclick="this.closest('.upsell-banner').remove();">No thanks</button>
    </div>`;

  screen.querySelector('.auth-screen-inner')?.prepend(upsell);
}

function markBundlePurchased() {
  localStorage.setItem('detox_bundle_purchased', '1');
  // ── CONNECT: STRIPE ── Trigger a separate Stripe Checkout for the bundle add-on
  // window.open('YOUR_BUNDLE_STRIPE_CHECKOUT_URL', '_blank');
  alert('Bundle add-on selected! Your developer will wire this to Stripe Checkout.');
}

/* ── EMAIL CAPTURE ────────────────────────────────────────────────────────── */
function handleEmailCapture() {
  const emailEl = document.getElementById('capture-email');
  const email   = emailEl?.value?.trim();
  if (!email || !email.includes('@')) {
    emailEl?.classList.add('input-error');
    return;
  }
  emailEl?.classList.remove('input-error');

  // ── CONNECT: EMAIL SERVICE ──
  // Send to your email provider (Mailchimp, ConvertKit, Klaviyo, etc.)
  // e.g. fetch('YOUR_MAILCHIMP_API_ENDPOINT', { method: 'POST', body: JSON.stringify({ email }) })
  // For now, store locally as demo
  const emails = JSON.parse(localStorage.getItem('detox_email_list') || '[]');
  if (!emails.includes(email)) {
    emails.push(email);
    localStorage.setItem('detox_email_list', JSON.stringify(emails));
  }
  subscribeEmail(email);

  const banner = document.getElementById('email-capture-banner');
  if (banner) {
    banner.innerHTML = `
      <div class="capture-success">
        <span>✓</span> You are on the list. Check your inbox for your free shopping list.
      </div>`;
  }
}



/* ── CONTENT GATING ───────────────────────────────────────────────────────── */

// Remove all gate-applied restrictions so gating can be re-evaluated cleanly
function ungateAll() {
  const selectors = [
    '#metrics-grid',
    '#wellness-grid',
    '#journal-prompts',
    '#journal-prompts .journal-prompt',
    '.meal-card',
    '.recipe-instructions',
    '.shop-link-row',
    '.gate-lock-card',
    '.random-btn',
    '.checklist-item',
    '.check-text',
  ];
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      el.style.filter        = '';
      el.style.pointerEvents = '';
      el.style.userSelect    = '';
      el.style.opacity       = '';
      el.style.display       = '';
    });
  });

  // Remove injected gate UI elements
  document.querySelectorAll(
    '.gate-upgrade-prompt, .gate-sample-note, .gate-generator-teaser, ' +
    '.gate-blur-overlay, .gate-lock-card, .gate-unlock-row, .session-interstitial'
  ).forEach(el => el.remove());

  // Restore save button text if it was swapped for a gated label
  const saveBtn = document.querySelector('.save-btn');
  if (saveBtn && saveBtn.textContent === 'Save Day 1 Entry') {
    saveBtn.textContent = 'Save Entry';
  }

  // Restore generator button onclick (gateGenerator() replaces it)
  const genBtn = document.querySelector('.random-btn');
  if (genBtn) genBtn.onclick = () => randomize();

  // Restore checklist item onclick handlers (gateChecklist() nulls them)
  document.querySelectorAll('.checklist-item').forEach(el => {
    el.onclick = () => toggleCheck(el);
  });

  // Restore check-box content and styles (gateChecklist() swaps them for a lock)
  document.querySelectorAll('.check-box').forEach(box => {
    if (box.textContent === '🔒') {
      box.textContent   = '';
      box.style.background  = '';
      box.style.borderColor = '';
    }
  });
}

// Called after every auth state change to re-apply all restrictions
function applyContentGating() {
  ungateAll(); // clear stale restrictions before re-evaluating
  gateChecklist();
  gateGenerator();
  gateShopLinks();
  gateTracker();
  gateCompanionWidget();
  checkSessionLimit();
  if (typeof updateTrackerSyncMsg === 'function') updateTrackerSyncMsg();
  if (typeof renderPlanBanner     === 'function') renderPlanBanner();
  if (typeof initCoachButton      === 'function') initCoachButton();   // Task 2
  if (typeof renderGuide          === 'function') renderGuide();       // Tasks 6 & 7
}

// Shared lock card HTML used inside meal cards
function lockCard(title, sub, upgradeMsg) {
  return `
    <div class="gate-lock-card">
      <div class="gate-lock-icon">🔒</div>
      <div class="gate-lock-text">
        <div class="gate-lock-title">${title}</div>
        <div class="gate-lock-sub">${sub}</div>
      </div>
      <button class="gate-lock-btn" onclick="showUpgradeModal('${upgradeMsg}')">Upgrade</button>
    </div>`;
}

// Inline upgrade prompt inserted below unlocked content
function upgradePrompt(title, sub, btnLabel) {
  return `
    <div class="gate-upgrade-prompt">
      <div class="gate-upgrade-dot"></div>
      <div class="gate-upgrade-body">
        <div class="gate-upgrade-title">${title}</div>
        <div class="gate-upgrade-sub">${sub}</div>
        <button class="gate-upgrade-btn"
          onclick="showUpgradeModal('${sub}')">
          ${btnLabel || 'See plans from $7.99/mo'}
        </button>
      </div>
    </div>`;
}

// ── GATE 1: Meal cards on home screen ─────────────────────────────────────
// Morning routine is always free. Breakfast through evening on Day 1 locked.
// Days 2-7 locked entirely.
function gateMealCards() {
  const hasFull = canAccess('day1-full');
  MEAL_ORDER.forEach(mealId => {
    if (mealId === 'morning') return; // always free
    const card = document.getElementById(`home-card-${mealId}`);
    if (!card) return;

    const body = card.querySelector('.meal-card-body');
    if (!body) return;

    if (!hasFull) {
      // Remove open state, prevent tapping to open normally
      card.classList.remove('open');
      const header = card.querySelector('.meal-card-header');
      if (header) {
        header.onclick = () => showUpgradeModal('Unlock the full 7-day meal plan with any paid plan.');
        if (!header.querySelector('.card-lock-icon')) {
          const lockIcon = document.createElement('span');
          lockIcon.className = 'card-lock-icon';
          lockIcon.textContent = '🔒';
          header.appendChild(lockIcon);
        }
      }
      // Inject lock card into body
      body.innerHTML = lockCard(
        'Full recipe locked',
        'Unlock all instructions, ingredient swaps, and step-by-step guidance.',
        'Unlock the full 7-day meal plan with any paid plan.'
      );
    }
  });

  // Inject upgrade prompt after morning routine card
  if (!hasFull) {
    const morningCard = document.getElementById('home-card-morning');
    if (morningCard && !morningCard.querySelector('.gate-upgrade-prompt')) {
      const prompt = document.createElement('div');
      prompt.innerHTML = upgradePrompt(
        'Ready to start your cleanse?',
        'Unlock the complete 7-day plan, all recipes with ingredient swaps, and the daily tracker.',
        'See plans from $7.99/mo'
      );
      morningCard.after(prompt.firstElementChild);
    }
  }

  // Lock home page day tabs 2-7 for free users -- Day 1 is the only accessible day
  if (!hasFull) {
    document.querySelectorAll('.day-btn').forEach((btn, i) => {
      if (i >= 1) {
        btn.classList.add('day-btn-future');
        btn.onclick = () => showUpgradeModal('Unlock the full 7-day meal plan to access all days.');
        if (!btn.querySelector('.day-btn-lock')) {
          const lockSpan = document.createElement('span');
          lockSpan.className = 'day-btn-lock';
          lockSpan.textContent = '🔒';
          btn.appendChild(lockSpan);
        }
      }
    });
  }
}

// ── GATE 2: Recipe instructions blurred ───────────────────────────────────
// The slot-result divs get a blur overlay if recipes-full is not accessible
function gateRecipeInstructions() {
  if (canAccess('recipes-full')) return;
  document.querySelectorAll('.slot-result').forEach(el => {
    if (el.querySelector('.gate-blur-overlay')) return;
    el.style.position = 'relative';
    el.style.overflow = 'hidden';

    const instr = el.querySelector('.slot-result-instr');
    const note  = el.querySelector('.slot-result-note');

    // Show first sentence, blur the rest
    if (instr) {
      const full = instr.textContent.trim();
      // Split on first period followed by a space or end of string
      const firstDot = full.search(/\.\s/);
      const preview  = firstDot > 0 ? full.substring(0, firstDot + 1) : full.substring(0, 80);
      const rest     = firstDot > 0 ? full.substring(firstDot + 1).trim() : '';

      instr.innerHTML = `
        <span class="gate-preview-text">${preview}</span>
        ${rest ? `<span class="gate-preview-rest"> ${rest}</span>` : ''}`;

      const restEl = instr.querySelector('.gate-preview-rest');
      if (restEl) restEl.style.filter = 'blur(4px)';
    }
    if (note) note.style.filter = 'blur(4px)';

    // Overlay sits over the blurred portion only
    const overlay = document.createElement('div');
    overlay.className = 'gate-blur-overlay';
    overlay.innerHTML = `
      <div class="gate-blur-icon">🔒</div>
      <div class="gate-blur-text">Full instructions unlock with Basic or above</div>
      <button class="gate-blur-btn"
        onclick="showUpgradeModal('Unlock all recipe instructions and ingredient swap details.')">
        Unlock for $7.99/mo
      </button>`;
    el.appendChild(overlay);
  });
}

// ── GATE 3: Night-before checklist capped at 2 items ─────────────────────
function gateChecklist() {
  if (canAccess('checklist-full')) return;
  const items = document.querySelectorAll('.checklist-item');
  let lockedCount = 0;
  items.forEach((item, i) => {
    if (i >= 2) {
      item.onclick = null;
      item.style.opacity = '0.5';
      item.style.cursor  = 'default';
      const box = item.querySelector('.check-box');
      if (box) { box.textContent = '🔒'; box.style.background = 'var(--lt-gray)'; box.style.borderColor = 'var(--mid-gray)'; box.style.fontSize = '12px'; }
      const text = item.querySelector('.check-text');
      if (text) text.style.filter = 'blur(2.5px)';
      lockedCount++;
    }
  });
  // Add unlock row if not already there
  if (lockedCount > 0) {
    const checklist = document.getElementById('night-checklist');
    if (checklist && !checklist.querySelector('.gate-unlock-row')) {
      const row = document.createElement('div');
      row.className = 'gate-unlock-row';
      row.innerHTML = `
        <span class="gate-unlock-text">${lockedCount} more prep steps locked</span>
        <button class="gate-unlock-btn"
          onclick="showUpgradeModal('Unlock the complete night-before prep checklist.')">
          Unlock all
        </button>`;
      checklist.appendChild(row);
    }
  }
}

// ── GATE 4: Shop links locked ─────────────────────────────────────────────
function gateShopLinks() {
  if (canAccess('shop-links')) return;

  // Ensure shop items are visible - remove any nav-level block
  const shopPage = document.getElementById('page-shop');
  if (shopPage) shopPage.style.display = '';

  document.querySelectorAll('.amazon-link').forEach(link => {
    if (link.dataset.gated) return;
    link.dataset.gated = '1';
    link.dataset.originalHref = link.href || '';
    link.removeAttribute('href');
    link.style.cursor = 'pointer'; // keep pointer so it feels tappable

    // Replace arrow with amber unlock button
    const arrow = link.querySelector('.amazon-link-arrow');
    if (arrow) {
      arrow.outerHTML = `<button class="shop-btn-unlock"
        onclick="event.stopPropagation(); showUpgradeModal('Unlock all shopping links with any paid plan.')">
        Unlock
      </button>`;
    }
    link.onclick = (e) => {
      e.preventDefault();
      showUpgradeModal('Unlock all shopping links with any paid plan. Direct links to every product.');
    };
  });

  // Single upgrade prompt at the very top of the shop list
  const shopList = document.getElementById('shop-list');
  if (shopList && !shopList.querySelector('.gate-upgrade-prompt')) {
    const p = document.createElement('div');
    p.innerHTML = upgradePrompt(
      'Unlock all shopping links',
      'Browse the full list below. Unlock with any paid plan to shop directly.',
      'Unlock shop — $7.99/mo'
    );
    shopList.prepend(p.firstElementChild);
  }
}

// ── GATE 5: Session interstitial after 3 visits ───────────────────────────
function checkSessionLimit() {
  if (canAccess('day1-full')) return; // paid users never see this
  if (isLoggedIn() && canAccess('day1-full')) return;

  const count = parseInt(localStorage.getItem('detox_session_count') || '0') + 1;
  localStorage.setItem('detox_session_count', count);

  if (count === 3) {
    setTimeout(() => showSessionInterstitial(), 1200);
  }
}

function showSessionInterstitial() {
  const existing = document.getElementById('session-interstitial');
  if (existing) return;

  const overlay = document.createElement('div');
  overlay.id = 'session-interstitial';
  overlay.className = 'session-interstitial';
  overlay.innerHTML = `
    <div class="session-modal-box">
      <div class="session-modal-icon">🌿</div>
      <div class="session-modal-title">Ready to start your cleanse?</div>
      <div class="session-modal-sub">
        You have explored the program. Unlock the complete 7-day plan,
        all recipes with ingredient swaps, and the progress tracker to get your results.
      </div>
      <button class="session-modal-btn"
        onclick="document.getElementById('session-interstitial').remove(); showUpgradeModal('');">
        See membership plans
      </button>
      <div class="session-modal-skip"
        onclick="document.getElementById('session-interstitial').remove()">
        Continue with free preview
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

// ── GATE 6: Random generator locked ──────────────────────────────────────
function gateGenerator() {
  const btn = document.querySelector('.random-btn');
  const results = document.getElementById('random-results');
  if (!btn) return;

  if (!canAccess('generator')) {
    btn.onclick = () => showUpgradeModal('The random meal generator is available on Basic and above.');
    btn.style.opacity = '0.6';
    // Insert teaser above button
    if (!document.getElementById('generator-teaser')) {
      const teaser = document.createElement('div');
      teaser.id = 'generator-teaser';
      teaser.className = 'gate-generator-teaser';
      teaser.innerHTML = `
        <div class="gate-gen-icon">🔀</div>
        <div class="gate-gen-title">Random Day Plan Generator</div>
        <div class="gate-gen-sub">Generate a full personalized day of meals and ingredient swaps with one tap. Available on Basic and above.</div>`;
      btn.before(teaser);
    }
  }
}

// ── GATE 7: Tracker locked ────────────────────────────────────────────────
function gateTracker() {
  if (canAccess('tracker')) return;

  // ── Day tabs: free users get Day 1 only; Days 2-7 locked ─────────────────
  const dayTabs = document.querySelectorAll('.day-tab');
  dayTabs.forEach((tab, i) => {
    if (i >= 1) { // Days 2-7 (indices 1-6) -- free users get Day 1 only
      tab.classList.add('day-tab-locked');
      tab.title = 'Upgrade to Basic to unlock';
      tab.onclick = (e) => {
        e.stopPropagation();
        showUpgradeModal('Upgrade to unlock all 7 days of tracking.');
      };
      if (!tab.querySelector('.day-tab-lock')) {
        const lockSpan = document.createElement('span');
        lockSpan.className = 'day-tab-lock';
        lockSpan.textContent = ' 🔒';
        tab.appendChild(lockSpan);
      }
    }
  });

  // ── Metrics grid: show Weight and Waist free, blur the rest ──────────────
  // METRIC_IDS order: weight, bmi, bodyfat, muscle, water, waist, hips, bone
  // Show index 0 (weight) and 5 (waist) - most visible/motivating results
  const metricCards = document.querySelectorAll('#metrics-grid .metric-card');
  metricCards.forEach((card, i) => {
    if (i !== 0 && i !== 5) { // lock all except Weight and Waist
      card.style.filter = 'blur(4px)';
      card.style.pointerEvents = 'none';
      card.style.userSelect = 'none';
    }
  });

  // Add unlock note under metrics
  const metricsGrid = document.getElementById('metrics-grid');
  if (metricsGrid && !metricsGrid.nextElementSibling?.classList.contains('gate-sample-note')) {
    const note = document.createElement('div');
    note.className = 'gate-sample-note';
    note.innerHTML = `
      <span>Showing 2 of 6 metrics free.</span>
      <button onclick="showUpgradeModal('Unlock all 6 body metrics across all 7 days.')">Unlock all</button>`;
    metricsGrid.after(note);
  }

  // ── Wellness grid: blur entirely ─────────────────────────────────────────
  const wellnessGrid = document.getElementById('wellness-grid');
  if (wellnessGrid) {
    wellnessGrid.style.filter = 'blur(4px)';
    wellnessGrid.style.pointerEvents = 'none';
    wellnessGrid.style.userSelect = 'none';
  }

  // ── Journal: show exactly 2 prompts for free, hide the rest (Fix 4) ────────
  const journalPrompts = document.querySelectorAll('#journal-prompts .journal-prompt');
  journalPrompts.forEach((prompt, i) => {
    if (i >= 2) {
      prompt.style.display = 'none'; // hide entirely, not just blurred
    }
  });

  // Upgrade link below the 2 visible prompts (Fix 4)
  const journalSection = document.getElementById('journal-prompts');
  if (journalSection && !journalSection.nextElementSibling?.classList.contains('gate-sample-note')) {
    const note = document.createElement('div');
    note.className = 'gate-sample-note';
    note.innerHTML = `
      <span>Showing 2 of 6 journal prompts.</span>
      <button onclick="showUpgradeModal('Upgrade to unlock all 6 journal prompts and the full 7-day tracker.')">
        Upgrade to unlock
      </button>`;
    journalSection.after(note);
  }

  // ── Save button: keep visible for Day 1 partial save ─────────────────────
  const saveBtn = document.querySelector('.save-btn');
  if (saveBtn) {
    saveBtn.textContent = 'Save Day 1 Entry';
  }

  // ── Top upgrade prompt ────────────────────────────────────────────────────
  const trackerContent = document.querySelector('#page-tracker .content');
  if (trackerContent && !trackerContent.querySelector('.gate-upgrade-prompt')) {
    const p = document.createElement('div');
    p.innerHTML = upgradePrompt(
      'Track your full transformation',
      'Unlock all 7 days, 6 body metrics, wellness tracking, and the full journal.',
      'Unlock tracker — $7.99/mo'
    );
    const firstSection = trackerContent.querySelector('.section-title');
    if (firstSection) firstSection.after(p.firstElementChild);
  }
}


/* ── PLAN BANNER (Task 2) ─────────────────────────────────────────────────── */
function renderPlanBanner() {
  // Remove any existing banners first
  document.querySelectorAll('.plan-banner').forEach(b => b.remove());

  // Check if user dismissed it
  if (localStorage.getItem('planBannerDismissed') === '1' && isLoggedIn()) return;

  const plan = typeof PLANS !== 'undefined' ? PLANS[AUTH.plan] : null;
  const activePageEl = document.querySelector('.page.active .content');
  if (!activePageEl) return;

  const banner = document.createElement('div');
  banner.className = 'plan-banner';

  if (!isLoggedIn() || AUTH.plan === 'free') {
    banner.innerHTML = `
      <span class="plan-banner-text">You're on the Free Plan — unlock the full cleanse.</span>
      <span class="plan-banner-cta" onclick="showUpgradeModal('')">Upgrade →</span>
      <span class="plan-banner-dismiss" onclick="dismissPlanBanner()" title="Dismiss">×</span>`;
  } else {
    const names = {
      basic:    'Basic Plan — 7-Day Full Cleanse',
      seasonal: 'Seasonal Reset Plan — Full Access',
      premium:  'Premium Plan — Full Access + Advanced Cleanse',
      lifetime: 'Lifetime Access — Everything included',
      admin:    'Admin Access — All features unlocked',
      tester:   'Tester Access — All features unlocked',
    };
    const msg = names[AUTH.plan] || plan?.name || 'Active Plan';
    banner.innerHTML = `
      <span class="plan-banner-text">✓ ${msg}</span>
      <span class="plan-banner-dismiss" onclick="dismissPlanBanner()" title="Dismiss">×</span>`;
  }

  // Insert at very top of the page's content area
  activePageEl.insertBefore(banner, activePageEl.firstChild);
}

function dismissPlanBanner() {
  if (isLoggedIn()) localStorage.setItem('planBannerDismissed', '1');
  document.querySelectorAll('.plan-banner').forEach(b => b.remove());
}

/* ── END OF CLEANSE SUMMARY (Task 8) ─────────────────────────────────────── */
function checkCleanseComplete() {
  if (!isLoggedIn()) return false; // stale date while logged out: show normal home
  const day = getCleanseDay();
  return day !== null && day >= 8; // 8 = past day 7
}

function renderCleanseSummary() {
  const homePage = document.getElementById('page-home');
  if (!homePage) return;

  // Calculate stats from tracker data
  let daysLogged = 0;
  for (let d = 1; d <= 7; d++) {
    if (METRIC_IDS.some(id => getTrackerVal('metric', d, id))) daysLogged++;
  }

  const w1 = parseFloat(getTrackerVal('metric', 1, 'weight'));
  const w7 = parseFloat(getTrackerVal('metric', 7, 'weight'));
  let weightChangeStr = '—';
  if (!isNaN(w1) && !isNaN(w7)) {
    const diff = (w7 - w1).toFixed(1);
    weightChangeStr = diff <= 0 ? `−${Math.abs(diff)} lbs` : `+${diff} lbs`;
  }

  let totalEnergy = 0, energyCount = 0;
  for (let d = 1; d <= 7; d++) {
    const v = parseFloat(getTrackerVal('wellness', d, 'item0'));
    if (!isNaN(v) && v > 0) { totalEnergy += v; energyCount++; }
  }
  const avgEnergy = energyCount > 0 ? (totalEnergy / energyCount).toFixed(1) : '—';

  let journalCount = 0;
  for (let d = 1; d <= 7; d++) {
    for (let q = 0; q < 6; q++) {
      if (getTrackerVal('journal', d, `q${q}`)) journalCount++;
    }
  }

  homePage.innerHTML = `
    <div class="cleanse-complete-hero">
      <div class="cleanse-confetti">🏆</div>
      <div class="cleanse-complete-title">Cleanse Complete!</div>
      <div class="cleanse-complete-sub">You finished the 7-Day Organic Vegan Detox & Cleanse.<br>Here's what you achieved.</div>
    </div>
    <div class="content">
      <div class="cleanse-stats-grid mt-20">
        <div class="cleanse-stat-card">
          <div class="cleanse-stat-icon">📅</div>
          <div class="cleanse-stat-value">${daysLogged}<span style="font-size:16px">/7</span></div>
          <div class="cleanse-stat-label">Days Logged</div>
        </div>
        <div class="cleanse-stat-card">
          <div class="cleanse-stat-icon">⚖️</div>
          <div class="cleanse-stat-value" style="font-size:${weightChangeStr.length > 5 ? '22px' : '30px'}">${weightChangeStr}</div>
          <div class="cleanse-stat-label">Weight Change</div>
        </div>
        <div class="cleanse-stat-card">
          <div class="cleanse-stat-icon">⚡</div>
          <div class="cleanse-stat-value">${avgEnergy}<span style="font-size:14px">/10</span></div>
          <div class="cleanse-stat-label">Avg Energy</div>
        </div>
        <div class="cleanse-stat-card">
          <div class="cleanse-stat-icon">📓</div>
          <div class="cleanse-stat-value">${journalCount}</div>
          <div class="cleanse-stat-label">Journal Entries</div>
        </div>
      </div>

      <div class="cleanse-actions">
        <button class="cleanse-share-btn" onclick="shareCleanse()">
          📤 Share My Results
        </button>
        <button class="cleanse-restart-btn" onclick="handleResetCleanse()">
          🔄 Start a New Cleanse
        </button>
      </div>
      <div class="cleanse-note">
        Your past tracker data is saved. Starting a new cleanse will open a fresh 7-day cycle.
      </div>
    </div>`;
}

function shareCleanse() {
  const w1 = parseFloat(getTrackerVal('metric', 1, 'weight'));
  const w7 = parseFloat(getTrackerVal('metric', 7, 'weight'));
  let weightLine = '';
  if (!isNaN(w1) && !isNaN(w7)) {
    const diff = (w7 - w1).toFixed(1);
    weightLine = `\nWeight change: ${diff <= 0 ? '-' : '+'}${Math.abs(diff)} lbs`;
  }

  let totalEnergy = 0, energyCount = 0;
  for (let d = 1; d <= 7; d++) {
    const v = parseFloat(getTrackerVal('wellness', d, 'item0'));
    if (!isNaN(v) && v > 0) { totalEnergy += v; energyCount++; }
  }
  const avgEnergy = energyCount > 0 ? (totalEnergy / energyCount).toFixed(1) : 'N/A';

  const text = `I just completed the 7-Day Organic Vegan Detox & Cleanse! 🌿\n${weightLine}\nAverage energy: ${avgEnergy}/10\n\nFeeling reset and refreshed. Highly recommend this program!`;

  if (navigator.share) {
    navigator.share({ title: '7-Day Detox Complete!', text }).catch(() => copyToClipboard(text));
  } else {
    copyToClipboard(text);
  }
}

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).then(() => {
    alert('Results copied to clipboard! Paste anywhere to share.');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    alert('Results copied! Paste anywhere to share.');
  });
}

function restartCleanse() {
  if (!confirm('Start a new cleanse? Your current tracker data will be archived.')) return;

  // Archive current cleanse data
  const existing = JSON.parse(localStorage.getItem('completedCleanse') || '[]');
  existing.push({
    startDate:   localStorage.getItem('cleanseStartDate'),
    completedAt: new Date().toISOString(),
    tracker:     JSON.parse(localStorage.getItem('detox_tracker') || '{}'),
  });
  localStorage.setItem('completedCleanse', JSON.stringify(existing));

  // Clear current cycle — date picker will appear on reload via maybeShowDatePicker
  localStorage.removeItem('cleanseStartDate');
  localStorage.removeItem('detox_tracker');
  localStorage.removeItem('detox_water');

  // Reload cleanly — DOMContentLoaded will show date picker since no start date
  location.reload();
}

/* ═══════════════════════════════════════════════════════════════════════════
   TASK 4 — HEALTH SAFETY SCREENING
   ═══════════════════════════════════════════════════════════════════════════ */

const HEALTH_QUESTIONS = [
  'I am in generally good health and not currently pregnant or breastfeeding',
  'I do not have Type 1 diabetes or uncontrolled Type 2 diabetes that requires medical supervision',
  'I do not have an active serious heart condition that restricts my diet or activity',
  'I am not taking immunosuppressant medications or other medications that require dietary restrictions',
  'I understand this program is not medical advice and I will consult my doctor if I have any concerns before starting',
];

function maybeShowHealthScreening() {
  if (_getHealthStatus()) return; // done already
  // Don't stack with auth modal or date picker
  const authModal  = document.getElementById('auth-modal');
  const datePicker = document.getElementById('date-picker-overlay');
  if (authModal  && authModal.classList.contains('active'))    return;
  if (datePicker && datePicker.style.display !== 'none')       return;
  setTimeout(showHealthScreening, 450);
}

function showHealthScreening() {
  if (_getHealthStatus()) return;

  const overlay = document.getElementById('health-screening-overlay');
  const content = document.getElementById('health-screening-content');
  if (!overlay || !content) return;

  window._healthAnswers = new Array(HEALTH_QUESTIONS.length).fill(null);

  const questionsHtml = HEALTH_QUESTIONS.map((q, i) => `
    <div class="health-question" id="hq-${i}">
      <div class="health-question-text">${q}</div>
      <button class="health-confirm-btn" id="health-toggle-${i}" onclick="setHealthAnswer(${i})">
        Tap to confirm
      </button>
    </div>`).join('');

  content.innerHTML = `
    <div class="health-icon">🏥</div>
    <h2 class="health-title">Quick Health Check</h2>
    <p class="health-sub">Please confirm each statement applies to you before starting the cleanse.</p>
    <div id="health-questions-list">${questionsHtml}</div>
    <div id="health-proceed-wrap">
      <button class="auth-btn mt-16" id="health-proceed-btn" onclick="submitHealthScreening()" disabled style="opacity:0.5;cursor:default">
        Confirm &amp; Continue
      </button>
      <p style="text-align:center;font-family:var(--font-ui);font-size:11px;color:var(--mid-gray);margin-top:8px;line-height:1.5">
        All statements must be confirmed to begin.<br>Your responses are stored only on this device.
      </p>
      <p style="text-align:center;margin-top:10px">
        <span class="health-concern-link" onclick="acknowledgeHealthWarning()">
          I have a health concern — let me browse first
        </span>
      </p>
    </div>`;

  overlay.style.display = 'flex';
  // Scroll the inner scrollable box to top instantly on each open
  const box = overlay.querySelector('.health-screening-box');
  if (box) box.scrollTop = 0;
}

// Single-toggle confirm (no Yes/No — tap to confirm, tap again to un-confirm)
function setHealthAnswer(index) {
  window._healthAnswers = window._healthAnswers || new Array(HEALTH_QUESTIONS.length).fill(null);
  const current = window._healthAnswers[index];
  window._healthAnswers[index] = (current === true) ? null : true;

  const isConfirmed = window._healthAnswers[index] === true;

  // Update button text and style
  const btn = document.getElementById(`health-toggle-${index}`);
  const qEl = document.getElementById(`hq-${index}`);
  if (btn) {
    btn.textContent = isConfirmed ? '✓ Confirmed' : 'Tap to confirm';
    btn.classList.toggle('confirmed', isConfirmed);
  }
  if (qEl) {
    qEl.classList.toggle('confirmed', isConfirmed);
  }

  // Enable proceed only when all 5 are confirmed
  const allConfirmed = window._healthAnswers.every(a => a === true);
  const proceedBtn   = document.getElementById('health-proceed-btn');
  if (proceedBtn) {
    proceedBtn.disabled      = !allConfirmed;
    proceedBtn.style.opacity = allConfirmed ? '1' : '0.5';
    proceedBtn.style.cursor  = allConfirmed ? 'pointer' : 'default';
  }
}

function submitHealthScreening() {
  localStorage.setItem(_healthKey(), 'true');
  if (window.sbClient && AUTH.userId) {
    window.sbClient.from('profiles')
      .update({ health_screening_complete: true })
      .eq('id', AUTH.userId)
      .then(() => {}).catch(e => console.error('[sync] health screening sync failed:', e));
  }
  const overlay = document.getElementById('health-screening-overlay');
  if (overlay) overlay.style.display = 'none';
  // Proceed to date picker if not yet set (Fix 1: health → date picker)
  startOnboardingFlow();
}

function acknowledgeHealthWarning() {
  localStorage.setItem(_healthKey(), 'warned');
  const overlay = document.getElementById('health-screening-overlay');
  if (overlay) overlay.style.display = 'none';
  const banner = document.getElementById('health-check-banner');
  if (banner) banner.style.display = 'flex';
  // Still proceed to date picker after warning (Fix 1)
  startOnboardingFlow();
}


/* ═══════════════════════════════════════════════════════════════════════════
   SECURE DOWNLOAD — Supabase signed URL helpers
   Fetches a short-lived signed URL from /api/get-download-url and opens it.
   ═══════════════════════════════════════════════════════════════════════════ */

function getAuthToken() {
  // ── CONNECT: SUPABASE ──
  // When Supabase auth is live, replace with:
  //   const { data: { session } } = await supabase.auth.getSession();
  //   return session?.access_token || '';
  // For now, returns whatever access_token Supabase stores on AUTH after sign-in.
  return AUTH?.access_token || AUTH?.user?.access_token || '';
}

async function handleSecureDownload(fileKey, btn) {
  // Step 1 — require login
  if (!isLoggedIn()) {
    showUpgradeModal('Sign in to access your downloads.');
    return;
  }

  // Step 2 — get JWT
  const token = getAuthToken();

  // Step 3 — loading state
  const originalText = btn ? (btn.textContent || btn.innerText) : '';
  if (btn) { btn.textContent = 'Preparing download…'; btn.disabled = true; }

  try {
    if (fileKey === 'guide') {
      // Step 4a — guide: watermarked PDF streamed from /api/download-guide
      const res = await fetch('/api/download-guide', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Download failed. Please try again.');
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'Detox-Cleanse-Guide.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } else if (fileKey === 'spreadsheet') {
      // Step 4b — spreadsheet: personalized xlsx from /api/download-spreadsheet
      const res = await fetch('/api/download-spreadsheet', {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Download failed. Please try again.');
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'Detox-Cleanse-Tracker.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } else {
      // Step 4b — all other files: signed URL from /api/get-download-url
      const res = await fetch('/api/get-download-url', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ file: fileKey }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Download failed. Please try again.');
      }

      // Step 5 — open signed URL in new tab
      window.open(data.url, '_blank');
    }

    // Restore button
    if (btn) { btn.textContent = originalText; btn.disabled = false; }

  } catch (err) {
    console.error('Secure download error:', err);

    // Step 6 — show error, then restore after 3 s
    if (btn) {
      btn.textContent = 'Download failed. Please try again.';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
      }, 3000);
    }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   TASKS 6 & 7 — GUIDE PAGE (DOWNLOAD CARD + RESOURCES)
   PDF.js viewer removed (Fix 1) — replaced with direct download card.
   ═══════════════════════════════════════════════════════════════════════════ */

function renderGuide() {
  const container = document.getElementById('guide-content');
  if (!container) return;

  const hasGuide  = canAccess('guide-pdf');
  // -- CONNECT: SUPABASE STORAGE -- Replace local PDF path with Supabase signed URL in Round 3
  const pdfPath   = (window.APP_CONFIG && window.APP_CONFIG.ASSETS && window.APP_CONFIG.ASSETS.GUIDE_PDF)
                    || 'assets/guide/Guide_Draft_v3.pdf';

  if (!hasGuide) {
    // Locked preview — Free, Basic, Seasonal
    container.innerHTML = `
      <div class="guide-locked-preview">
        <div class="guide-lock-icon">📖</div>
        <div class="guide-lock-title">7-Day Organic Detox &amp; Cleanse — Complete Guide</div>
        <div class="guide-lock-desc">
          The full program guide with meal prep strategies, supplement science, detox protocols,
          and the complete day-by-day reference — all in one beautifully designed PDF.
        </div>
        <div class="guide-tier-note">📖 Available on Premium and Lifetime plans.</div>
        <button class="auth-btn mt-16"
          onclick="showUpgradeModal('The Digital Guide is included with Premium and Lifetime plans.')">
          Unlock with Premium
        </button>
        <div class="guide-preview-link-wrap">
          <span class="guide-preview-link" onclick="showGuidePreviewPlaceholder()">
            Preview first few pages
          </span>
        </div>
      </div>
      ${renderDownloadsHtml()}`;
    return;
  }

  // Unlocked — clean download card (Fix 1: PDF viewer removed due to CORS)
  container.innerHTML = `
    <div class="guide-download-card">
      <div class="guide-download-icon">📖</div>
      <div class="guide-download-title">7-Day Organic Detox &amp; Cleanse Guide</div>
      <div class="guide-download-desc">
        The complete program guide — meal plans, recipes, morning routines, and everything
        you need to complete the cleanse successfully.
      </div>
      <div class="guide-download-meta">Full program guide · PDF format</div>
      <button class="guide-download-btn"
        onclick="handleSecureDownload('guide', this)">⬇ Download Guide PDF</button>
      <div class="guide-preview-link-wrap">
        <span class="guide-preview-link" onclick="showGuidePreviewPlaceholder()">
          Preview first few pages
        </span>
      </div>
    </div>
    ${renderDownloadsHtml()}`;
}

function showGuidePreviewPlaceholder() {
  window.open(
    'https://iuganzmkhkvlqqidbkkw.supabase.co/storage/v1/object/public/public-assets/detox-cleanse-preview.pdf',
    '_blank'
  );
}

// Guide &amp; downloads: returns HTML for the resources section
function renderDownloadsHtml() {
  const hasPremium    = canAccess('downloads-premium');
  const hasBasic      = canAccess('downloads-basic');
  const ASSETS        = (window.APP_CONFIG && window.APP_CONFIG.ASSETS) || {};

  // -- CONNECT: SUPABASE STORAGE -- Move files to Supabase Storage bucket in Round 3
  // Fix 2: corrected file paths (spaces removed, lowercase folder names)
  const spreadsheetPath  = ASSETS.SPREADSHEET   || 'assets/spreadsheet/Detox_Cleanse_v6.xlsx';
  const shoppingPath     = ASSETS.SHOPPING_LIST  || 'assets/shopping-list/Shopping_List_UPDATED.docx';
  const cleansePlanPath  = ASSETS.CLEANSE_PLAN   || 'assets/cleansing-plan/Daily_Cleansing_Plan_CLEAN.docx';
  const guidePdfPath     = ASSETS.GUIDE_PDF      || 'assets/guide/Guide_Draft_v3.pdf';

  function downloadBtn(href, label, cls) {
    return `<a href="${href}" download class="download-btn ${cls || ''}">${label}</a>`;
  }
  // Secure download button — fetches a signed URL from /api/get-download-url
  function secureDownloadBtn(fileKey, label, cls) {
    return `<button onclick="handleSecureDownload('${fileKey}', this)"
      class="download-btn ${cls || ''}">${label}</button>`;
  }
  function lockBtn(msg) {
    return `<div class="download-card-locked">
      🔒 <button class="download-lock-btn" onclick="showUpgradeModal('${msg}')">Unlock</button>
    </div>`;
  }

  const cards = [
    {
      icon:  '📊',
      title: 'Interactive Tracking Spreadsheet',
      desc:  'The complete Excel tracker — log metrics, meals, and progress across multiple cleanses.',
      action: hasPremium
        ? secureDownloadBtn('spreadsheet', '⬇ Download Spreadsheet', '')
        : lockBtn('The interactive spreadsheet is included with Premium and Lifetime plans.'),
    },
    {
      icon:  '📖',
      title: 'Digital Guide PDF',
      desc:  'The full program guide — detox science, supplement guide, meal prep, and daily reference.',
      action: hasPremium
        ? secureDownloadBtn('guide', '⬇ Download Guide', '')
        : lockBtn('The digital guide PDF is included with Premium and Lifetime plans.'),
    },
    {
      icon:  '🛒',
      title: '7-Day Shopping List',
      desc:  'The complete ingredient checklist, organized by store section for quick in-store shopping.',
      action: hasBasic
        ? secureDownloadBtn('shopping-list', '⬇ Download Shopping List', 'download-btn-basic')
        : lockBtn('The shopping list download is available on Basic and above.'),
    },
    {
      icon:  '📋',
      title: 'Daily Cleansing Plan Reference',
      desc:  'A printable one-page daily schedule — times, meals, supplements, and checklist in one view.',
      action: hasBasic
        ? secureDownloadBtn('daily-plan', '⬇ Download Daily Plan', 'download-btn-basic')
        : lockBtn('The daily plan reference is available on Basic and above.'),
    },
  ];

  const cardsHtml = cards.map(c => `
    <div class="download-card">
      <div class="download-card-icon">${c.icon}</div>
      <div class="download-card-info">
        <div class="download-card-title">${c.title}</div>
        <div class="download-card-desc">${c.desc}</div>
        ${c.action}
      </div>
    </div>`).join('');

  return `<div class="downloads-section-title">Tools &amp; Resources</div>${cardsHtml}`;
}


/* ═══════════════════════════════════════════════════════════════════════════
   TASK 2 — AI CLEANSE COACH CHAT
   ═══════════════════════════════════════════════════════════════════════════ */

const COACH = {
  messages: [],    // [{role, content}]
  isLoading: false,
};

try {
  const stored = sessionStorage.getItem('coach_messages');
  if (stored) COACH.messages = JSON.parse(stored);
} catch(e) {}

function initCoachButton() {
  const btn = document.getElementById('coach-chat-btn');
  if (!btn) return;

  if (!isLoggedIn()) {
    btn.style.display = 'none';
    return;
  }

  btn.style.display = 'flex';

  if (canAccess('ai-coach')) {
    btn.classList.remove('locked');
    // Remove lock badge if present
    const lock = btn.querySelector('.coach-btn-lock');
    if (lock) lock.remove();
  } else {
    btn.classList.add('locked');
    if (!btn.querySelector('.coach-btn-lock')) {
      const lock = document.createElement('span');
      lock.className = 'coach-btn-lock';
      lock.textContent = '🔒';
      btn.appendChild(lock);
    }
  }
}

function handleCoachBtnTap() {
  if (!isLoggedIn()) {
    navigateAuth('login');
    document.getElementById('auth-modal').classList.add('active');
    return;
  }
  if (!canAccess('ai-coach')) {
    showUpgradeModal('AI Cleanse Coach is available on Seasonal Reset and above — upgrade to unlock your personal coach.');
    return;
  }
  openCoachChat();
}

function openCoachChat() {
  const modal = document.getElementById('coach-chat-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  // Show welcome message on first open (skip if history exists)
  const msgContainer = document.getElementById('coach-chat-messages');
  if (msgContainer && msgContainer.children.length === 0 && COACH.messages.length === 0) {
    appendCoachMessage('assistant', "Hi! I'm your Cleanse Coach. I'm here to help you through the 7-Day Organic Vegan Detox & Cleanse. What questions do you have?");
    COACH.messages.push({ role: 'assistant', content: "Hi! I'm your Cleanse Coach. I'm here to help you through the 7-Day Organic Vegan Detox & Cleanse. What questions do you have?" });
    try { sessionStorage.setItem('coach_messages', JSON.stringify(COACH.messages)); } catch(e) {}
  }

  // Re-render existing history when modal DOM was reset but session has messages
  if (msgContainer && msgContainer.children.length === 0 && COACH.messages.length > 0) {
    COACH.messages.forEach(msg => appendCoachMessage(msg.role, msg.content));
  }

  // Show daily limit countdown if applicable
  updateCoachLimitDisplay();

  // Focus input
  setTimeout(() => {
    const input = document.getElementById('coach-chat-input');
    if (input) input.focus();
  }, 300);
}

function closeCoachChat() {
  const modal = document.getElementById('coach-chat-modal');
  if (modal) modal.style.display = 'none';
}

async function updateCoachLimitDisplay() {
  const plan = AUTH.plan || 'free';
  const dailyLimit = (window.AI_COACH_DAILY_LIMITS || {})[plan] || 0;
  if (dailyLimit === 0 || dailyLimit >= 999) return;
  const usage = await getCoachUsage();
  const remaining = Math.max(0, dailyLimit - usage.count);
  const el = document.getElementById('coach-limit-display');
  if (!el) return;
  el.textContent = remaining + ' message' + (remaining === 1 ? '' : 's') + ' remaining today. Resets at midnight UTC.';
  el.style.display = remaining > 0 ? 'block' : 'none';
}
window.updateCoachLimitDisplay = updateCoachLimitDisplay;

async function sendCoachMessage() {
  const input = document.getElementById('coach-chat-input');
  const text  = input ? input.value.trim() : '';
  if (!text || COACH.isLoading) return;

  // Rate limit check
  if (typeof API !== 'undefined' && API.isRateLimited()) {
    appendCoachMessage('assistant', "You've reached the session limit — come back tomorrow! Your questions are always welcome. 🌿");
    return;
  }

  // Daily plan limit check
  const plan = AUTH.plan || 'free';
  const dailyLimit = (window.AI_COACH_DAILY_LIMITS || {})[plan] || 0;
  if (dailyLimit > 0) {
    const usage = await getCoachUsage();
    if (usage.count >= dailyLimit) {
      appendCoachMessage('assistant', 'You have reached your daily message limit. It resets at midnight UTC.');
      await updateCoachLimitDisplay();
      return;
    }
  }

  // Show user message
  input.value = '';
  appendCoachMessage('user', text);
  COACH.messages.push({ role: 'user', content: text });
  try { sessionStorage.setItem('coach_messages', JSON.stringify(COACH.messages)); } catch(e) {}

  // Show loading dots
  COACH.isLoading = true;
  const sendBtn = document.querySelector('.coach-chat-send');
  if (sendBtn) sendBtn.disabled = true;

  const dotId = 'coach-dots-' + Date.now();
  const msgContainer = document.getElementById('coach-chat-messages');
  if (msgContainer) {
    const dots = document.createElement('div');
    dots.id = dotId;
    dots.className = 'coach-msg-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';
    msgContainer.appendChild(dots);
    msgContainer.scrollTop = msgContainer.scrollHeight;
  }

  try {
    const reply = await API.sendCoachMessage(COACH.messages);
    COACH.messages.push({ role: 'assistant', content: reply });
    try { sessionStorage.setItem('coach_messages', JSON.stringify(COACH.messages)); } catch(e) {}

    // Remove loading dots
    const dotsEl = document.getElementById(dotId);
    if (dotsEl) dotsEl.remove();

    appendCoachMessage('assistant', reply);

    // Increment daily usage counter
    const afterUsage = await getCoachUsage();
    await updateCoachUsage(afterUsage.count + 1);
    await updateCoachLimitDisplay();
  } catch(err) {
    const dotsEl = document.getElementById(dotId);
    if (dotsEl) dotsEl.remove();

    if (err.message === 'RATE_LIMIT') {
      appendCoachMessage('assistant', "You've reached the session limit — come back tomorrow! Your questions are always welcome. 🌿");
    } else {
      appendCoachMessage('assistant', 'Sorry, I had trouble connecting. Please check your internet and try again.');
    }
  } finally {
    COACH.isLoading = false;
    if (sendBtn) sendBtn.disabled = false;
    if (input)   input.focus();
  }
}

function appendCoachMessage(role, text) {
  const container = document.getElementById('coach-chat-messages');
  if (!container) return;

  const div = document.createElement('div');
  div.className = `coach-msg coach-msg-${role}`;

  // Sanitize text (no HTML injection)
  const safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  div.innerHTML = `<div class="coach-msg-bubble">${safe}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}


/* ── AI COACH USAGE TRACKING ─────────────────────────────────────────────── */

function getTodayUTC() {
  return new Date().toISOString().slice(0, 10);
}

async function getCoachUsage() {
  if (!AUTH.user) return { date: getTodayUTC(), count: 0 };
  try {
    const { data, error } = await window.sbClient
      .from('profiles')
      .select('ai_coach_usage')
      .eq('id', AUTH.userId)
      .single();
    if (error || !data) return { date: getTodayUTC(), count: 0 };
    const usage = data.ai_coach_usage || { date: '', count: 0 };
    if (usage.date !== getTodayUTC()) return { date: getTodayUTC(), count: 0 };
    return usage;
  } catch (e) {
    console.warn('getCoachUsage error:', e);
    return { date: getTodayUTC(), count: 0 };
  }
}

async function updateCoachUsage(newCount) {
  if (!AUTH.user) return;
  const payload = { date: getTodayUTC(), count: newCount };
  try {
    await window.sbClient
      .from('profiles')
      .update({ ai_coach_usage: payload })
      .eq('id', AUTH.userId);
  } catch(e) {
    console.warn('updateCoachUsage error:', e);
  }
}

window.getCoachUsage    = getCoachUsage;
window.updateCoachUsage = updateCoachUsage;

/* ── RESET CLEANSE (Fix 2) ────────────────────────────────────────────────── */

// Full reset: clears start date + health screening → re-runs onboarding flow
// Used by "Reset My Cleanse" button in account screen
async function handleResetCleanse() {
  if (!confirm('Reset your cleanse? This will clear your start date and health screening. Your tracker data and journal entries will be preserved.')) return;

  localStorage.removeItem('cleanseStartDate');
  localStorage.removeItem('detox_water');
  localStorage.removeItem('detox_tracker');
  localStorage.removeItem('detox_selections');
  localStorage.removeItem('detox_prep_checklist');
  localStorage.removeItem(_healthKey());
  localStorage.removeItem('healthScreeningComplete'); // clear legacy key too
  localStorage.removeItem('avoidListCollapsed');

  // Clear all per-cycle keys with these prefixes
  Object.keys(localStorage).forEach(k => {
    if (k.startsWith('firedReminders_') || k.startsWith('challengeComplete_')) {
      localStorage.removeItem(k);
    }
  });

  const banner = document.getElementById('health-check-banner');
  if (banner) banner.style.display = 'none';
  renderTrackerDayTabs();
  showDayToast("Cleanse reset. Let's start fresh!");

  // Await Supabase cleanup before navigating so loadCloudData() can't restore
  // old rows in the race window between reset and startOnboardingFlow().
  if (AUTH && AUTH.userId && window.sbClient) {
    try {
      await window.sbClient.from('gamification').upsert({
        user_id: AUTH.userId,
        points: 0,
        badges: [],
        streak: 0,
        streak_date: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch(e) { console.error('#reset: gamification clear failed', e); }
    try {
      await window.sbClient.from('companion_state').upsert({
        user_id: AUTH.userId,
        state: {},
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    } catch(e) { console.error('#reset: companion_state clear failed', e); }
    try {
      await window.sbClient.from('daily_progress').delete().eq('user_id', AUTH.userId);
    } catch(e) { console.error('#reset: daily_progress clear failed', e); }
    try {
      await window.sbClient.from('body_metrics').delete().eq('user_id', AUTH.userId);
    } catch(e) { console.error('#reset: body_metrics clear failed', e); }
    try {
      await window.sbClient.from('profiles')
        .update({ health_screening_complete: false, cleanse_start_date: null, prep_checklist: { checked: {}, awarded: {} } })
        .eq('id', AUTH.userId);
    } catch(e) { console.error('#reset: profiles clear failed', e); }
  }

  // Clear companion and points state from localStorage so old values don't
  // appear during onboarding or on the Today page after reset.
  localStorage.removeItem('cleanseCompanion');
  localStorage.removeItem('thrivingStreak');
  localStorage.removeItem('thrivingStreakDate');
  localStorage.removeItem('completedCleanse');

  // Reset in-memory STATE so nothing stale leaks into the next render cycle.
  STATE.water         = {};
  STATE.tracker       = {};
  STATE.selections    = {};
  STATE.prepChecklist = normalizePrepChecklist(null);

  // Write a fresh default companion so any display call before the next
  // full loadState() reads zeroed values rather than the just-removed stale object.
  localStorage.setItem('cleanseCompanion', JSON.stringify({
    mood: 'neutral', badges: [], points: 0, streak: 0, growthStage: 1,
    todayPoints: 0, cleanseCount: 0, allTimePoints: 0,
    lastPointDate: null, lastStreakDate: null, lastActiveDay: null,
  }));

  // Navigate only after cleanup is confirmed complete.
  if (typeof closeAuthModal === 'function') closeAuthModal();
  startOnboardingFlow();
}

// Light reset: clears only the start date (keeps health screening status)
// Used by "Wrong day? Reset" link below tracker day tabs
function resetCleanseDate() {
  if (!confirm('Reset your cleanse start date? Your tracker data will be kept.')) return;
  localStorage.removeItem('cleanseStartDate');
  renderTrackerDayTabs();
  setTimeout(showDatePicker, 200);
}

/* ── TRACKER SYNC MSG (Task 7) ────────────────────────────────────────────── */
function updateTrackerSyncMsg() {
  const el = document.getElementById('tracker-sync-msg');
  if (!el) return;
  if (isLoggedIn() && AUTH.plan !== 'free') {
    el.innerHTML = 'Progress synced to your account.';
    el.style.color = 'rgba(216,243,220,0.65)';
  } else {
    el.innerHTML = `Progress saved on this device. <span class="tracker-sync-link" onclick="navigateAuth('login'); document.getElementById('auth-modal').classList.add('active')">Sign in</span> to back up to the cloud.`;
    el.style.color = 'rgba(216,243,220,0.65)';
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   FIX 8 — SERVICE INTEREST QUESTIONNAIRE (Shop page)
   ═══════════════════════════════════════════════════════════════════════════ */

const SURVEY_QS = [
  {
    id: 'q1', text: 'How likely are you to complete the full 7-day cleanse?',
    options: ['Very likely','Somewhat likely','Unsure','Unlikely'],
  },
  {
    id: 'q2', text: "What's your biggest challenge with the cleanse?",
    options: ['Finding time to cook','Buying the right groceries','Staying motivated','Understanding the program','Something else'],
  },
  {
    id: 'q3', text: 'Would you pay for a grocery delivery service that shops your exact cleanse list for you?',
    options: ['Yes definitely','Maybe','Probably not','No thanks'],
  },
  {
    id: 'q4', text: 'Would you be interested in a meal prep service that delivers the cleanse meals ready to eat?',
    options: ['Yes definitely','Maybe','Probably not','No thanks'],
  },
  {
    id: 'q5', text: 'How did you hear about us?',
    options: ['Social media','Search engine','Friend or family','Other'],
  },
];

const SURVEY = { answers: {} };

function renderSurveyCard() {
  // Only for logged-in users, on the shop page
  if (!isLoggedIn()) return;
  if (localStorage.getItem('surveyDismissed') || localStorage.getItem('surveyCompleted')) return;

  const shopList = document.getElementById('shop-list');
  if (!shopList || document.getElementById('survey-card')) return;

  const card = document.createElement('div');
  card.id = 'survey-card';
  card.className = 'survey-card';
  card.innerHTML = `
    <button class="survey-dismiss" onclick="dismissSurvey()" aria-label="Dismiss">×</button>
    <div class="survey-card-icon">💬</div>
    <div class="survey-card-title">Tell us what would help you most</div>
    <div class="survey-card-sub">2 minutes — shapes what we build next</div>
    <button class="survey-open-btn" onclick="openSurveyModal()">Share My Feedback</button>`;

  shopList.after(card);
}

function dismissSurvey() {
  localStorage.setItem('surveyDismissed', '1');
  const card = document.getElementById('survey-card');
  if (card) card.remove();
}

function openSurveyModal() {
  const modal = document.getElementById('survey-modal');
  if (modal) modal.style.display = 'flex';
  SURVEY.answers = {};
  renderSurveyQuestions();
}

function closeSurveyModal() {
  const modal = document.getElementById('survey-modal');
  if (modal) modal.style.display = 'none';
}

function renderSurveyQuestions() {
  const container = document.getElementById('survey-questions');
  if (!container) return;

  container.innerHTML = SURVEY_QS.map(q => `
    <div class="survey-question" id="sq-${q.id}">
      <div class="survey-q-text">${q.text}</div>
      <div class="survey-options">
        ${q.options.map(opt => `
          <button class="survey-option" onclick="selectSurveyOption('${q.id}', this, '${opt.replace(/'/g,"\\'")}')">
            ${opt}
          </button>`).join('')}
      </div>
    </div>`).join('');
}

function selectSurveyOption(questionId, btn, value) {
  SURVEY.answers[questionId] = value;
  // Update option button styles
  const qEl = document.getElementById(`sq-${questionId}`);
  if (qEl) {
    qEl.querySelectorAll('.survey-option').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  }
}

async function submitSurvey() {
  // Require all 5 answers
  const missing = SURVEY_QS.find(q => !SURVEY.answers[q.id]);
  if (missing) {
    const qEl = document.getElementById(`sq-${missing.id}`);
    if (qEl) qEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    qEl?.classList.add('survey-question-error');
    setTimeout(() => qEl?.classList.remove('survey-question-error'), 1200);
    return;
  }

  const submitBtn = document.getElementById('survey-submit-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Sending…'; }

  // -- CONNECT: NETLIFY FORMS -- Enable form detection in Netlify dashboard after deploy
  // Build form-encoded body for Netlify Forms
  const body = new URLSearchParams({
    'form-name': 'service-survey',
    'user-email': (typeof AUTH !== 'undefined' && AUTH.user?.email) || 'unknown',
    ...Object.fromEntries(SURVEY_QS.map(q => [q.text.slice(0, 40), SURVEY.answers[q.id] || ''])),
  });

  try {
    await fetch('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch(e) {
    // Silently continue — still mark complete locally even if network fails
  }

  // Show thank-you
  localStorage.setItem('surveyCompleted', '1');
  const surveyContent = document.getElementById('survey-content');
  if (surveyContent) {
    surveyContent.innerHTML = `
      <div class="survey-thankyou">
        <div style="font-size:40px;margin-bottom:14px">🙏</div>
        <div class="survey-thankyou-msg">Thank you! Your feedback helps us build what you actually need.</div>
      </div>`;
  }
  setTimeout(() => {
    closeSurveyModal();
    const card = document.getElementById('survey-card');
    if (card) card.remove();
  }, 3000);
}

/* ═══════════════════════════════════════════════════════════════════════════
   SCHEDULER — TASKS A–E: DAILY REMINDERS
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── TASK A: SCHEDULE DATA & STORAGE ─────────────────────────────────────── */

const SCHEDULE_DEFAULTS = {
  morning_routine:  { label: 'Morning Routine',    description: 'Time to start your morning detox routine',      icon: '🌅', enabled: true, time: '07:00', sound: 'chime', category: 'routine'  },
  water_1:          { label: 'Morning Water',       description: 'Drink your first 2 glasses of water',           icon: '💧', enabled: true, time: '08:00', sound: 'water', category: 'water'    },
  water_2:          { label: 'Midday Water',         description: 'Stay hydrated — 2 more glasses',                icon: '💧', enabled: true, time: '12:00', sound: 'water', category: 'water'    },
  water_3:          { label: 'Afternoon Water',      description: 'Keep the hydration going',                      icon: '💧', enabled: true, time: '15:00', sound: 'water', category: 'water'    },
  breakfast:        { label: 'Breakfast',            description: 'Time to prepare your morning meal',             icon: '🍓', enabled: true, time: '08:30', sound: 'chime', category: 'meal'     },
  mid_morning_juice:{ label: 'Mid-Morning Juice',    description: 'Your detox juice is due',                       icon: '🥤', enabled: true, time: '10:30', sound: 'chime', category: 'meal'     },
  lunch:            { label: 'Lunch',                description: 'Time for your cleanse lunch',                   icon: '🥗', enabled: true, time: '12:30', sound: 'chime', category: 'meal'     },
  afternoon_snack:  { label: 'Afternoon Snack',      description: 'Your scheduled snack time',                     icon: '🍎', enabled: true, time: '15:30', sound: 'chime', category: 'meal'     },
  dinner:           { label: 'Dinner',               description: 'Time to prepare your cleanse dinner',           icon: '🥦', enabled: true, time: '18:30', sound: 'chime', category: 'meal'     },
  evening_drink:    { label: 'Evening Drink',        description: 'Your evening detox drink',                      icon: '🫖', enabled: true, time: '20:00', sound: 'chime', category: 'meal'     },
  journal_checkin:  { label: 'Journal Check-In',     description: 'Time to log your daily journal entry',          icon: '📓', enabled: true, time: '21:00', sound: 'chime', category: 'wellness' },
  end_of_day:       { label: 'End of Day Review',    description: 'Review your day and prep for tomorrow',         icon: '🌙', enabled: true, time: '21:30', sound: 'chime', category: 'wellness' },
};

function getSchedule() {
  try {
    const saved = localStorage.getItem('cleanseSchedule');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults so new keys added in future updates appear automatically
      const merged = JSON.parse(JSON.stringify(SCHEDULE_DEFAULTS));
      Object.keys(parsed).forEach(k => {
        if (merged[k]) merged[k] = Object.assign({}, merged[k], parsed[k]);
      });
      return merged;
    }
  } catch(e) {}
  return JSON.parse(JSON.stringify(SCHEDULE_DEFAULTS));
}

function saveSchedule(schedule) {
  try { localStorage.setItem('cleanseSchedule', JSON.stringify(schedule)); } catch(e) {}
}

/* ── TASK B: SCHEDULER ENGINE ─────────────────────────────────────────────── */

let _reminderQueue        = [];
let _reminderBannerActive = false;

function playReminderSound(type) {
  if (type === 'water') { playWaterSound(); return; }
  // Chime: 3-note ascending C4, E4, G4
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [261.63, 329.63, 392.00].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * 0.18;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.28);
    });
    setTimeout(() => { try { ctx.close(); } catch(e) {} }, 900);
  } catch(e) {}
}

function showReminderBanner(reminder) {
  if (_reminderBannerActive) { _reminderQueue.push(reminder); return; }
  _reminderBannerActive = true;

  const old = document.getElementById('reminder-banner');
  if (old) old.remove();

  const banner = document.createElement('div');
  banner.id = 'reminder-banner';
  banner.className = 'reminder-banner';
  banner.innerHTML = `
    <span class="reminder-banner-icon">${reminder.icon}</span>
    <div class="reminder-banner-text">
      <div class="reminder-banner-label">${reminder.label}</div>
      <div class="reminder-banner-desc">${reminder.description}</div>
    </div>
    <button class="reminder-banner-close" onclick="dismissReminderBanner()" aria-label="Dismiss">×</button>`;
  document.body.appendChild(banner);

  // Two rAFs ensure the element is painted before the class is added
  requestAnimationFrame(() => requestAnimationFrame(() => banner.classList.add('show')));

  banner._autoTimer = setTimeout(dismissReminderBanner, 8000);
}

function dismissReminderBanner() {
  const banner = document.getElementById('reminder-banner');
  if (!banner) { _reminderBannerActive = false; _drainReminderQueue(); return; }
  clearTimeout(banner._autoTimer);
  banner.classList.remove('show');
  setTimeout(() => {
    if (banner.parentNode) banner.remove();
    _reminderBannerActive = false;
    _drainReminderQueue();
  }, 380);
}

function _drainReminderQueue() {
  if (_reminderQueue.length > 0) {
    const next = _reminderQueue.shift();
    setTimeout(() => showReminderBanner(next), 400);
  }
}

const _TILE_BLINK_MAP = {
  breakfast:         '#home-card-breakfast',
  mid_morning_juice: '#home-card-juice',
  lunch:             '#home-card-lunch',
  afternoon_snack:   '#home-card-snack',
  dinner:            '#home-card-dinner',
  evening_drink:     '#home-card-evening',
  water_1:           '.water-tracker',
  water_2:           '.water-tracker',
  water_3:           '.water-tracker',
  morning_routine:   '.page-hero',
};

function triggerTileBlink(reminderKey) {
  const selector = _TILE_BLINK_MAP[reminderKey];
  if (!selector) return;
  const el = document.querySelector(selector);
  if (!el) return;
  el.classList.remove('tile-notify');
  void el.offsetWidth; // force reflow to restart animation
  el.classList.add('tile-notify');
  setTimeout(() => el.classList.remove('tile-notify'), 2400);
}

function initScheduler() {
  // Request browser notification permission on first user interaction
  if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
    document.addEventListener('click', function _reqNotif() {
      try { Notification.requestPermission(); } catch(e) {}
      document.removeEventListener('click', _reqNotif);
    }, { once: true });
  }
  checkReminders();
  setInterval(checkReminders, 60000);
}

function checkReminders() {
  if (!isLoggedIn()) return;
  const now        = new Date();
  const timeStr    = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  const dateStr    = toLocalDateStr(now);
  const storageKey = 'firedReminders_' + dateStr;

  let firedToday = [];
  try { firedToday = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch(e) {}

  const schedule = getSchedule();
  Object.entries(schedule).forEach(([key, reminder]) => {
    if (!reminder.enabled) return;
    if (reminder.time !== timeStr) return;
    if (firedToday.includes(key)) return;

    showReminderBanner(reminder);
    playReminderSound(reminder.sound);
    triggerTileBlink(key);

    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(reminder.label, { body: reminder.description, icon: '/favicon.ico' });
      }
    } catch(e) {}

    firedToday.push(key);

    // Award daily complete bonus when end-of-day reminder fires
    if (key === 'end_of_day') {
      const companion = getCompanion();
      if (companion.pointsByDay && companion.pointsByDay[STATE.activeDay] > 0) {
        setTimeout(() => awardPoints(POINTS_DAILY_COMPLETE, 'daily'), 9000);
      }
    }
  });

  try { localStorage.setItem(storageKey, JSON.stringify(firedToday)); } catch(e) {}
}

/* ── TASK C: SETTINGS PANEL ──────────────────────────────────────────────── */

const _SCHED_CATEGORIES = [
  { id: 'routine',  label: '🌅 Daily Routine',    keys: ['morning_routine'] },
  { id: 'water',    label: '💧 Water & Hydration', keys: ['water_1','water_2','water_3'] },
  { id: 'meal',     label: '🍽 Meals & Nutrition', keys: ['breakfast','mid_morning_juice','lunch','afternoon_snack','dinner','evening_drink'] },
  { id: 'wellness', label: '🌿 Wellness',          keys: ['journal_checkin','end_of_day'] },
];

function to12Hour(time24) {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2,'0')} ${period}`;
}

function updateTime12Hr(key, val) {
  const span = document.querySelector(`.time-12hr[data-time-key="${key}"]`);
  if (span) span.textContent = to12Hour(val);
}

function openSchedulerSettings() {
  console.log('openSchedulerSettings called', document.getElementById('reminders-panel'));
  const schedule = getSchedule();
  const isPaid   = isLoggedIn() && canAccess('day1-full');
  const panel    = document.getElementById('reminders-panel');
  if (!panel) return;
  panel.innerHTML = _buildSchedulerPanelHTML(schedule, isPaid);
  panel.classList.add('open');
  const overlay = document.getElementById('reminders-overlay');
  if (overlay) overlay.classList.add('active');
}

function _buildSchedulerPanelHTML(schedule, isPaid) {
  const allEnabled = Object.values(schedule).every(r => r.enabled);

  const sections = _SCHED_CATEGORIES.map(cat => {
    const rows = cat.keys.map(key => {
      const r = schedule[key] || SCHEDULE_DEFAULTS[key];
      const lockIcon = isPaid ? '' : `<span class="sched-lock-icon" onclick="showTimeLockToast()">🔒</span>`;
      return `
        <div class="sched-row">
          <div class="sched-row-left">
            <span class="sched-icon">${r.icon}</span>
            <div class="sched-info"><div class="sched-label">${r.label}</div></div>
          </div>
          <div class="sched-row-right">
            ${lockIcon}
            <div class="sched-time-wrap">
              <span class="time-12hr" data-time-key="${key}">${to12Hour(r.time)}</span>
              <input type="time" class="sched-time" value="${r.time}" data-key="${key}"
                ${isPaid ? `oninput="updateTime12Hr('${key}',this.value)"` : 'disabled onclick="showTimeLockToast()"'}>
            </div>
            <label class="sched-toggle">
              <input type="checkbox" class="sched-enable-cb" data-key="${key}" ${r.enabled ? 'checked' : ''}>
              <span class="sched-slider"></span>
            </label>
          </div>
        </div>`;
    }).join('');
    return `<div class="sched-category">${cat.label}</div>${rows}`;
  }).join('');

  return `
    <div class="reminders-panel-header">
      <button class="reminders-panel-back" onclick="closeSchedulerSettings()">‹ Back</button>
      <span class="reminders-panel-title">🔔 Daily Reminders</span>
    </div>
    <div class="reminders-panel-body">
      ${sections}
      <div class="sched-footer">
        <div class="sched-master-row">
          <span class="sched-master-label">Enable All Reminders</span>
          <label class="sched-toggle">
            <input type="checkbox" id="sched-master-cb" ${allEnabled ? 'checked' : ''}
              onchange="onMasterToggleChange(this.checked)">
            <span class="sched-slider"></span>
          </label>
        </div>
        <button class="sched-save-btn" onclick="saveSchedulerSettings()">Save Settings</button>
        <button class="sched-reset-btn" onclick="resetScheduleToDefaults()">Reset to Defaults</button>
      </div>
    </div>`;
}

function onMasterToggleChange(checked) {
  document.querySelectorAll('.sched-enable-cb').forEach(cb => { cb.checked = checked; });
}

function showTimeLockToast() {
  showDayToast('Upgrade to Basic to customize reminder times');
}

function saveSchedulerSettings() {
  const schedule = getSchedule();
  document.querySelectorAll('.sched-time').forEach(input => {
    const key = input.dataset.key;
    if (key && schedule[key]) schedule[key].time = input.value;
  });
  document.querySelectorAll('.sched-enable-cb').forEach(cb => {
    const key = cb.dataset.key;
    if (key && schedule[key]) schedule[key].enabled = cb.checked;
  });
  saveSchedule(schedule);

  const btn = document.querySelector('.sched-save-btn');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ Reminders saved!';
    btn.style.background = 'var(--md-green)';
    setTimeout(() => {
      btn.textContent = orig;
      btn.style.background = '';
      closeSchedulerSettings();
    }, 1500);
  } else {
    closeSchedulerSettings();
  }
}

function resetScheduleToDefaults() {
  const panel  = document.getElementById('reminders-panel');
  const footer = panel && panel.querySelector('.sched-footer');
  if (!footer) return;
  footer.innerHTML = `
    <div style="text-align:center;padding:8px 0;font-family:var(--font-ui);font-size:14px;color:var(--dk-green)">
      Reset all reminders to default times?
    </div>
    <button class="sched-save-btn" onclick="_confirmResetDefaults()">Yes, Reset</button>
    <button class="sched-reset-btn" onclick="openSchedulerSettings()">Cancel</button>`;
}

function _confirmResetDefaults() {
  saveSchedule(JSON.parse(JSON.stringify(SCHEDULE_DEFAULTS)));
  openSchedulerSettings();
  showDayToast('Reset to defaults');
}

function closeSchedulerSettings() {
  const panel = document.getElementById('reminders-panel');
  if (panel) panel.classList.remove('open');
  const overlay = document.getElementById('reminders-overlay');
  if (overlay) overlay.classList.remove('active');
}

/* ── TASK E: TODAY'S SCHEDULE SECTION ────────────────────────────────────── */

function renderTodaySchedule() {
  const existing = document.getElementById('today-schedule-section');
  if (existing) existing.remove();
  if (!isLoggedIn()) return;

  const schedule   = getSchedule();
  const now        = new Date();
  const timeStr    = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  const dateStr    = toLocalDateStr(now);
  const storageKey = 'firedReminders_' + dateStr;

  let firedToday = [];
  try { firedToday = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch(e) {}

  const isCollapsed = localStorage.getItem('scheduleCollapsed') !== 'false';

  const sorted = Object.entries(schedule)
    .filter(([, r]) => r.enabled)
    .sort((a, b) => a[1].time.localeCompare(b[1].time));

  const nextKey = (sorted.find(([k, r]) => !firedToday.includes(k) && r.time >= timeStr) || [])[0];

  const rowsHtml = sorted.map(([key, r]) => {
    const isPast = r.time < timeStr || firedToday.includes(key);
    const isNext = key === nextKey;
    return `
      <div class="sched-time-row${isPast ? ' past' : ''}">
        ${isNext ? '<span class="sched-next-dot"></span>' : '<span style="width:7px;flex-shrink:0;display:inline-block"></span>'}
        <span class="sched-time-val">${to12Hour(r.time)}</span>
        <span style="font-size:1rem">${r.icon}</span>
        <span style="font-size:0.85rem;color:var(--text)">${r.label}</span>
      </div>`;
  }).join('') || '<div style="padding:8px 0;font-size:0.85rem;color:var(--text-muted);font-style:italic">No reminders enabled</div>';

  const section = document.createElement('div');
  section.id = 'today-schedule-section';
  section.className = 'today-schedule' + (isCollapsed ? '' : ' expanded');
  section.innerHTML = `
    <div class="today-schedule-header" onclick="toggleTodaySchedule()">
      <span class="today-schedule-title">🔔 Today's Reminders</span>
      <span class="today-schedule-chevron">▾</span>
    </div>
    <div class="today-schedule-body">${rowsHtml}</div>`;

  const mealsContainer = document.getElementById('home-meals');
  if (mealsContainer) mealsContainer.parentNode.insertBefore(section, mealsContainer);
}

function toggleTodaySchedule() {
  const section = document.getElementById('today-schedule-section');
  if (!section) return;
  const expanded = section.classList.toggle('expanded');
  localStorage.setItem('scheduleCollapsed', expanded ? 'false' : 'true');
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLEANSE COMPANION — TASKS A–G
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── TASK A: COMPANION DATA SYSTEM ─────────────────────────────────────────── */

const COMPANION_DEFAULT = {
  points: 0, todayPoints: 0, pointsByDay: {}, lastPointDate: null,
  streak: 0, lastStreakDate: null,
  badges: [], allTimePoints: 0, cleanseCount: 0,
  mood: 'neutral', growthStage: 1, lastActiveDay: null,
};

const POINTS_WATER_GLASS       = 5;
const POINTS_MEAL_LOGGED       = 10;
const POINTS_JOURNAL_ENTRY     = 20;
const POINTS_CHECKLIST_ITEM    = 3;
const POINTS_DAILY_COMPLETE    = 50;
const POINTS_CHALLENGE_COMPLETE = 30;

function getCompanion() {
  try {
    const saved = localStorage.getItem('cleanseCompanion');
    if (saved) return Object.assign({}, COMPANION_DEFAULT, JSON.parse(saved));
  } catch(e) {}
  return Object.assign({}, COMPANION_DEFAULT);
}

function saveCompanion(state) {
  try { localStorage.setItem('cleanseCompanion', JSON.stringify(state)); } catch(e) {}
  if (!_cloudLoadInProgress) { syncCompanionState(); syncGamification(); }
}

function _calcMood(pts) {
  if (pts <= 0)  return 'sad';
  if (pts < 30)  return 'neutral';
  if (pts < 60)  return 'happy';
  return 'thriving';
}

function awardPoints(amount, reason) {
  if (!isLoggedIn()) return;
  const companion = getCompanion();
  const today     = toLocalDateStr(new Date());
  const day       = STATE.activeDay;

  companion.pointsByDay = companion.pointsByDay || {};
  companion.pointsByDay[day] = (companion.pointsByDay[day] || 0) + amount;

  companion.points        += amount;
  companion.allTimePoints += amount;
  companion.lastPointDate  = today;
  companion.lastActiveDay  = STATE.activeDay;

  // Streak logic
  if (companion.lastStreakDate !== today) {
    const prev = new Date();
    prev.setDate(prev.getDate() - 1);
    const yesterday = toLocalDateStr(prev);
    companion.streak = (companion.lastStreakDate === yesterday) ? companion.streak + 1 : 1;
    companion.lastStreakDate = today;
  }

  companion.mood = _calcMood(companion.pointsByDay[day] || 0);

  // Track thriving streak for badge
  if (companion.mood === 'thriving') {
    const ts = parseInt(localStorage.getItem('thrivingStreak') || '0');
    const tsd = localStorage.getItem('thrivingStreakDate');
    if (tsd !== today) {
      const prev2 = new Date(); prev2.setDate(prev2.getDate() - 1);
      const ts2 = tsd === toLocalDateStr(prev2) ? ts + 1 : 1;
      localStorage.setItem('thrivingStreak', String(ts2));
      localStorage.setItem('thrivingStreakDate', today);
    }
  }

  saveCompanion(companion);
  checkBadgeUnlocks(companion);
  updateCompanionDisplay();
  playCompanionSound('points');
}

/* ── TASK B: BADGE SYSTEM ───────────────────────────────────────────────────── */

const BADGES = [
  { id: 'first_drop',       name: 'First Drop',         description: 'Logged your first glass of water',             emoji: '💧', trigger: 'water_logged_1'   },
  { id: 'hydration_hero',   name: 'Hydration Hero',      description: 'Hit 96oz water goal 3 days in a row',          emoji: '🌊', trigger: 'water_streak_3'   },
  { id: 'clean_eater',      name: 'Clean Eater',         description: 'Logged all meals in a single day',             emoji: '🥗', trigger: 'all_meals_day'    },
  { id: 'journal_warrior',  name: 'Journal Warrior',     description: 'Wrote journal entries 5 days straight',        emoji: '📓', trigger: 'journal_streak_5' },
  { id: 'morning_champion', name: 'Morning Champion',    description: 'Completed morning routine 7 days',             emoji: '🌅', trigger: 'morning_streak_7' },
  { id: 'halfway_there',    name: 'Halfway There',       description: 'Completed Day 3 of the cleanse',               emoji: '🌿', trigger: 'day_3_complete'   },
  { id: 'full_cleanse',     name: 'Full Cleanse',        description: 'Completed all 7 days',                         emoji: '🌳', trigger: 'day_7_complete'   },
  { id: 'streak_3',         name: 'On a Roll',           description: '3-day activity streak',                        emoji: '🔥', trigger: 'streak_3'         },
  { id: 'repeat_cleanser',  name: 'Repeat Cleanser',     description: 'Completed your second cleanse',                emoji: '♻️', trigger: 'cleanse_count_2'  },
  { id: 'plant_parent',     name: 'Plant Parent',        description: 'Kept your companion thriving for 3 days straight', emoji: '🪴', trigger: 'thriving_streak_3' },
];

function checkBadgeUnlocks(companion) {
  const earned  = new Set(companion.badges.map(b => b.id));
  const today   = toLocalDateStr(new Date());
  const day     = getCleanseDay();
  let changed   = false;

  BADGES.forEach(badge => {
    if (earned.has(badge.id)) return;
    let unlocked = false;
    switch(badge.trigger) {
      case 'water_logged_1':    unlocked = companion.allTimePoints >= POINTS_WATER_GLASS; break;
      case 'streak_3':          unlocked = companion.streak >= 3; break;
      case 'day_3_complete':    unlocked = day !== null && day >= 3; break;
      case 'day_7_complete':    unlocked = day === 8; break;
      case 'cleanse_count_2':   unlocked = companion.cleanseCount >= 2; break;
      case 'thriving_streak_3': unlocked = parseInt(localStorage.getItem('thrivingStreak') || '0') >= 3; break;
      default: break;
    }
    if (unlocked) {
      companion.badges.push({ id: badge.id, earnedAt: today });
      showBadgeUnlock(badge);
      changed = true;
    }
  });
  if (changed) saveCompanion(companion);
}

function showBadgeUnlock(badge) {
  const old = document.getElementById('badge-unlock-overlay');
  if (old) old.remove();
  const el = document.createElement('div');
  el.id = 'badge-unlock-overlay';
  el.className = 'badge-unlock-overlay';
  el.innerHTML = `
    <div class="badge-unlock-emoji">${badge.emoji}</div>
    <div class="badge-unlock-name">${badge.name}</div>
    <div class="badge-unlock-desc">${badge.description}</div>`;
  document.body.appendChild(el);
  playCompanionSound('badge');
  setTimeout(() => {
    el.style.transition = 'opacity 0.4s';
    el.style.opacity    = '0';
    setTimeout(() => { if (el.parentNode) el.remove(); }, 450);
  }, 3000);
}

/* ── TASK C: COMPANION SVG — CHUNKY SUNFLOWER IN TERRACOTTA POT ─────────────── */

function renderCompanionSVG(mood, stage) {
  const s       = Math.max(1, Math.min(7, stage || 1));
  const sfClass = `sf-svg sf-${mood} sf-stage-${s}`;
  const cx      = 80; // horizontal center of 160-wide viewBox

  // ── POT (always visible in all stages) ──────────────────────────────────
  const pot = `
    <polygon points="45,185 115,185 108,155 52,155" fill="#c1440e"/>
    <rect x="48" y="148" width="64" height="10" rx="3" fill="#d4521a"/>
    <ellipse cx="68" cy="162" rx="5" ry="13" fill="rgba(255,255,255,0.13)" transform="rotate(-15,68,162)"/>
    <ellipse cx="${cx}" cy="154" rx="28" ry="6" fill="#4a2c0a"/>`;

  // ── STAGE 1: tiny sprout, no face ────────────────────────────────────────
  if (s === 1) {
    return `<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg"
      class="${sfClass}" id="sf-plant" style="cursor:pointer" onclick="tapCompanion()">
      ${pot}
      <g id="sf-stem">
        <path d="M ${cx} 154 Q ${cx-4} 148 ${cx} 139" stroke="#3d7a2a" stroke-width="6" fill="none" stroke-linecap="round"/>
      </g>
      <g id="sf-leaves"></g>
      <circle cx="${cx}" cy="136" r="5" fill="#4a9e2a"/>
      <circle cx="${cx}" cy="134" r="3" fill="#5aba38"/>
      <g id="sf-petals" opacity="0"></g>
      <g id="sf-disc" opacity="0"></g>
      <g id="sf-eyes" opacity="0"></g><g id="sf-mouth" opacity="0"></g>
      <g id="sf-cheeks" opacity="0"></g>
      <g id="sf-brow-left" opacity="0"></g><g id="sf-brow-right" opacity="0"></g>
      <g id="sf-tears" style="display:none"></g>
      <g id="sf-sparkles" style="display:none"></g>
      <g id="sf-cloud" style="display:none"></g>
    </svg>`;
  }

  // ── STAGE 2: seedling with bud, one leaf, no face ────────────────────────
  if (s === 2) {
    const lclr2 = mood === 'sad' ? '#3d7a22' : '#4a9e2a';
    return `<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg"
      class="${sfClass}" id="sf-plant" style="cursor:pointer" onclick="tapCompanion()">
      ${pot}
      <g id="sf-stem">
        <path d="M ${cx} 154 Q ${cx-5} 140 ${cx} 124" stroke="#3d7a2a" stroke-width="6" fill="none" stroke-linecap="round"/>
      </g>
      <g id="sf-leaves">
        <path d="M ${cx+3} 142 C ${cx+31} 133 ${cx+42} 151 ${cx+20} 158 C ${cx+8} 161 ${cx+3} 150 ${cx+3} 142Z" fill="${lclr2}"/>
        <line x1="${cx+3}" y1="142" x2="${cx+25}" y2="156" stroke="#6ab83a" stroke-width="1.5"/>
      </g>
      <g id="sf-petals" opacity="0"></g>
      <g id="sf-disc">
        <circle cx="${cx}" cy="116" r="8" fill="#2d5a1e"/>
        <circle cx="${cx}" cy="113" r="5" fill="#4a9e2a"/>
      </g>
      <g id="sf-eyes" opacity="0"></g><g id="sf-mouth" opacity="0"></g>
      <g id="sf-cheeks" opacity="0"></g>
      <g id="sf-brow-left" opacity="0"></g><g id="sf-brow-right" opacity="0"></g>
      <g id="sf-tears" style="display:none"></g>
      <g id="sf-sparkles" style="display:none"></g>
      <g id="sf-cloud" style="display:none"></g>
    </svg>`;
  }

  // ── STAGES 3–7: full sunflower with face ─────────────────────────────────

  // Disc config by stage
  const SC = {
    3: { dcy: 85, r: 24 },
    4: { dcy: 80, r: 26 },
    5: { dcy: 76, r: 28 },
    6: { dcy: 72, r: 30 },
    7: { dcy: 70, r: 32 },
  };
  const { dcy: discCy, r: discR } = SC[s] || SC[7];

  // Petal config by stage
  const PC = {
    3: { n: 8,  ry: 14, clr: '#f5c518' },
    4: { n: 10, ry: 18, clr: '#f5c518' },
    5: { n: 12, ry: 22, clr: '#fbbf24' },
    6: { n: 12, ry: 24, clr: '#fbbf24' },
    7: { n: 12, ry: 26, clr: '#fbbf24' },
  };
  const pc = PC[s] || PC[7];
  const petalClr = mood === 'sad' ? '#e8b020'
    : mood === 'thriving' ? '#ffd700'
    : mood === 'happy'    ? '#fbbf24'
    : '#f5c518'; // neutral

  // Stem from soil surface to disc bottom
  const stemEndY = discCy + discR;
  const stemMidY = Math.round((154 + stemEndY) / 2);
  const stemPath = `M ${cx} 154 C ${cx-7} ${stemMidY-15} ${cx+7} ${stemMidY+15} ${cx} ${stemEndY}`;

  // Petals (rotated ellipses around disc center)
  const petalRx = 10;
  let petals = '';
  for (let i = 0; i < pc.n; i++) {
    const ang  = (i * 360) / pc.n;
    const pcyE = discCy - discR - Math.round(pc.ry / 2);
    petals += `<ellipse cx="${cx}" cy="${pcyE}" rx="${petalRx}" ry="${pc.ry}" fill="${petalClr}" opacity="0.95" transform="rotate(${ang},${cx},${discCy})"/>`;
    // Stage 7: orange tip overlay
    if (s === 7) {
      const tipCy = discCy - discR - pc.ry + 6;
      petals += `<ellipse cx="${cx}" cy="${tipCy}" rx="5" ry="7" fill="#e07b10" opacity="0.68" transform="rotate(${ang},${cx},${discCy})"/>`;
    }
  }

  // Leaves — scale by stage, angle by mood (base dimensions increased 30%)
  const leafScaleMap = { 3: 0.9, 4: 1.1, 5: 1.2, 6: 1.35, 7: 1.4 };
  const leafScale    = leafScaleMap[s] || 1.0;
  const lW = Math.round(29 * leafScale), lH = Math.round(13 * leafScale);
  const lMidY      = stemEndY + Math.round((154 - stemEndY) * 0.5);
  const leafClr    = mood === 'sad' ? '#3d7a22' : '#4a9e2a';
  const lAng       = mood === 'sad' ? -50 : mood === 'thriving' ? -25 : -35;
  const rAng       = mood === 'sad' ?  50 : mood === 'thriving' ?  25 :  35;

  const mkLeaf = (lx, ly, ang) =>
    `<g transform="rotate(${ang},${lx},${ly})">
        <path d="M ${lx} ${ly} C ${lx+lW} ${ly-lH} ${lx+lW*1.2} ${ly+lH} ${lx} ${ly+lH*0.5} C ${lx-lW*0.3} ${ly+lH} ${lx} ${ly} ${lx} ${ly}Z" fill="${leafClr}"/>
        <line x1="${lx}" y1="${ly}" x2="${lx+Math.round(lW*0.65)}" y2="${ly+Math.round(lH*0.7)}" stroke="#6ab83a" stroke-width="1.5"/>
      </g>`;

  const leaves = mkLeaf(cx-5, lMidY, lAng) + mkLeaf(cx+5, lMidY, rAng);

  // Disc with radial gradient + seed texture dots
  const gid = 'sfg' + s + mood.charAt(0);
  let seedDots = '';
  const dotOrbitR = discR * 0.46;
  for (let i = 0; i < 8; i++) {
    const a   = (i * Math.PI * 2) / 8;
    const dx  = +(dotOrbitR * Math.cos(a)).toFixed(1);
    const dy  = +(dotOrbitR * Math.sin(a)).toFixed(1);
    seedDots += `<circle cx="${cx + dx}" cy="${discCy + dy}" r="2" fill="#8B4513" opacity="0.6"/>`;
  }
  const disc = `
    <defs>
      <radialGradient id="${gid}" cx="40%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#e8a020"/>
        <stop offset="100%" stop-color="#c47a10"/>
      </radialGradient>
    </defs>
    <circle cx="${cx}" cy="${discCy}" r="${discR}" fill="url(#${gid})"/>
    ${seedDots}`;

  // Face geometry
  const eyOff = 9;
  const eyXL  = cx - eyOff, eyXR = cx + eyOff;
  const eyY   = discCy - 8;
  const browY = discCy - 16;
  const mY    = discCy + 8;
  const fClr  = '#2a1200';

  // Eyes — sclera + iris + highlight
  let eyes;
  if (mood === 'thriving') {
    // crescent ^^ : iris with disc-colour lower overlay
    eyes = `
      <ellipse cx="${eyXL}" cy="${eyY}" rx="6" ry="7" fill="white"/>
      <ellipse cx="${eyXR}" cy="${eyY}" rx="6" ry="7" fill="white"/>
      <circle  cx="${eyXL}" cy="${eyY}" r="4" fill="#1a0a00"/>
      <ellipse cx="${eyXL}" cy="${eyY+3.5}" rx="4" ry="3.5" fill="url(#${gid})"/>
      <circle  cx="${eyXR}" cy="${eyY}" r="4" fill="#1a0a00"/>
      <ellipse cx="${eyXR}" cy="${eyY+3.5}" rx="4" ry="3.5" fill="url(#${gid})"/>
      <circle  cx="${eyXL+2}" cy="${eyY-2}" r="1.5" fill="white"/>
      <circle  cx="${eyXR+2}" cy="${eyY-2}" r="1.5" fill="white"/>`;
  } else {
    const sclRy = mood === 'sad' ? 4 : 7;
    const sadLid = mood === 'sad'
      ? `<ellipse cx="${eyXL}" cy="${eyY-2}" rx="6" ry="4" fill="rgba(80,40,0,0.22)"/>
         <ellipse cx="${eyXR}" cy="${eyY-2}" rx="6" ry="4" fill="rgba(80,40,0,0.22)"/>`
      : '';
    eyes = `
      <ellipse cx="${eyXL}" cy="${eyY}" rx="6" ry="${sclRy}" fill="white"/>
      <ellipse cx="${eyXR}" cy="${eyY}" rx="6" ry="${sclRy}" fill="white"/>
      <circle  cx="${eyXL}" cy="${eyY}" r="4" fill="#1a0a00"/>
      <circle  cx="${eyXR}" cy="${eyY}" r="4" fill="#1a0a00"/>
      <circle  cx="${eyXL+2}" cy="${eyY-2}" r="1.5" fill="white"/>
      <circle  cx="${eyXR+2}" cy="${eyY-2}" r="1.5" fill="white"/>
      ${sadLid}`;
  }

  // Eyebrows
  let blPath, brPath;
  if (mood === 'sad') {
    // Outer ends droop DOWN, inner ends UP — classic sad look (not angry)
    blPath = `M ${cx-13} ${browY+4} Q ${cx-9} ${browY+1} ${cx-5} ${browY-2}`;
    brPath = `M ${cx+5}  ${browY-2} Q ${cx+9} ${browY+1} ${cx+13} ${browY+4}`;
  } else if (mood === 'thriving') {
    blPath = `M ${cx-14} ${browY+2} Q ${cx-9} ${browY-6} ${cx-4} ${browY+2}`;
    brPath = `M ${cx+4}  ${browY+2} Q ${cx+9} ${browY-6} ${cx+14} ${browY+2}`;
  } else if (mood === 'happy') {
    blPath = `M ${cx-13} ${browY+1} Q ${cx-8} ${browY-3} ${cx-3} ${browY+1}`;
    brPath = `M ${cx+3}  ${browY+1} Q ${cx+8} ${browY-3} ${cx+13} ${browY+1}`;
  } else {
    blPath = `M ${cx-13} ${browY+2} Q ${cx-8} ${browY} ${cx-3} ${browY+2}`;
    brPath = `M ${cx+3}  ${browY+2} Q ${cx+8} ${browY} ${cx+13} ${browY+2}`;
  }

  // Mouth — teeth ellipse for happy/thriving, then stroke path
  const mW    = mood === 'sad' ? 12 : mood === 'neutral' ? 12 : mood === 'happy' ? 15 : 17;
  const mCP   = mood === 'sad' ? mY-14 : mood === 'neutral' ? mY+1 : mood === 'happy' ? mY+14 : mY+18;
  // Mouth — stroke only, no teeth ellipse (cleaner cartoon look)
  const mouth = `<path d="M ${cx-mW} ${mY} Q ${cx} ${mCP} ${cx+mW} ${mY}" stroke="${fClr}" stroke-width="3" fill="none" stroke-linecap="round"/>`;

  // Cheeks
  const chkOp = (mood === 'happy' || mood === 'thriving') ? '1' : '0';
  const cheeks = `
    <circle cx="${cx-15}" cy="${discCy+5}" r="8" fill="rgba(255,120,100,0.35)" opacity="${chkOp}"/>
    <circle cx="${cx+15}" cy="${discCy+5}" r="8" fill="rgba(255,120,100,0.35)" opacity="${chkOp}"/>`;

  // Tears
  const tearDisp = mood === 'sad' ? 'block' : 'none';
  const tears = `
    <ellipse cx="${eyXL}" cy="${eyY+8}" rx="2.5" ry="4" fill="#5ab4e8" class="sf-tear-left"/>
    <ellipse cx="${eyXR}" cy="${eyY+8}" rx="2.5" ry="4" fill="#5ab4e8" class="sf-tear-right"/>`;

  // Rain cloud (sad)
  const cloudDisp = mood === 'sad' ? 'block' : 'none';
  const cloud = `
    <circle cx="115" cy="52" r="8"  fill="#9ca3af"/>
    <circle cx="122" cy="48" r="10" fill="#9ca3af"/>
    <circle cx="130" cy="52" r="8"  fill="#9ca3af"/>
    <line x1="115" y1="63" x2="113" y2="72" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round" class="sf-rain-1"/>
    <line x1="122" y1="63" x2="120" y2="72" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round" class="sf-rain-2"/>
    <line x1="129" y1="63" x2="127" y2="72" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round" class="sf-rain-3"/>`;

  // Sparkles at 11, 1, 4, 8 o'clock around disc (thriving)
  const sparkleDisp = mood === 'thriving' ? 'block' : 'none';
  const spAng = [300, 30, 120, 240]; // degrees clockwise from top
  const spR2  = discR + 17;
  const spClrs = ['#fbbf24', '#ffffff', '#fbbf24', '#ffffff'];
  const sparkles = spAng.map((a, i) => {
    const rad = a * Math.PI / 180;
    const sx  = +(cx + spR2 * Math.sin(rad)).toFixed(1);
    const sy  = +(discCy - spR2 * Math.cos(rad)).toFixed(1);
    return `<g class="sf-sparkle sf-sparkle-${i}" transform="translate(${sx},${sy})">
        <ellipse rx="1.5" ry="7" fill="${spClrs[i]}"/>
        <ellipse rx="1.5" ry="7" fill="${spClrs[i]}" transform="rotate(90)"/>
      </g>`;
  }).join('');

  // Assemble: cloud first (behind), then pot, stem, leaves, petals, disc+seeds, face, tears, sparkles
  return `<svg viewBox="0 0 160 200" xmlns="http://www.w3.org/2000/svg"
    class="${sfClass}" id="sf-plant" style="cursor:pointer" onclick="tapCompanion()">
    <g id="sf-cloud" style="display:${cloudDisp}">${cloud}</g>
    ${pot}
    <g id="sf-petals">${petals}</g>
    <g id="sf-stem"><path d="${stemPath}" stroke="#3d7a2a" stroke-width="6" fill="none" stroke-linecap="round"/></g>
    <g id="sf-leaves">${leaves}</g>
    <g id="sf-disc">${disc}</g>
    <g id="sf-cheeks">${cheeks}</g>
    <g id="sf-brow-left"><path d="${blPath}" stroke="${fClr}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
    <g id="sf-brow-right"><path d="${brPath}" stroke="${fClr}" stroke-width="3" fill="none" stroke-linecap="round"/></g>
    <g id="sf-eyes">${eyes}</g>
    <g id="sf-mouth">${mouth}</g>
    <g id="sf-tears" style="display:${tearDisp}">${tears}</g>
    <g id="sf-sparkles" style="display:${sparkleDisp}">${sparkles}</g>
  </svg>`;
}

/* ── TASK D: COMPANION SOUNDS ───────────────────────────────────────────────── */

function playCompanionSound(type) {
  if (type === 'water') { playWaterSound(); return; }
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t0  = ctx.currentTime;
    function nt(freq, start, dur, vol) {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      const ts = t0 + start;
      osc.frequency.setValueAtTime(freq, ts);
      gain.gain.setValueAtTime(0.0001, ts);
      gain.gain.exponentialRampToValueAtTime(vol || 0.14, ts + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, ts + dur);
      osc.start(ts);
      osc.stop(ts + dur + 0.05);
    }
    switch(type) {
      case 'happy':    nt(659.25,0,0.18); nt(783.99,0.13,0.18); nt(987.77,0.26,0.22); break;
      case 'thriving': nt(523.25,0,0.14); nt(659.25,0.13,0.14); nt(783.99,0.26,0.14); nt(1046.5,0.39,0.30,0.18); break;
      case 'sad':      nt(440,0,0.22); nt(349.23,0.19,0.22); nt(293.66,0.38,0.28); break;
      case 'neutral':  nt(523.25,0,0.30); break;
      case 'badge':    nt(783.99,0,0.14); nt(880,0.15,0.14); nt(987.77,0.30,0.14); nt(1567.98,0.44,0.35,0.18); break;
      case 'points':   nt(1046.5,0,0.18,0.09); break;
      default:         nt(523.25,0,0.20); break;
    }
    setTimeout(() => { try { ctx.close(); } catch(e) {} }, 1400);
  } catch(e) {}
}

/* ── TASK E: COMPANION WIDGET — stats LEFT, plant RIGHT ────────────────────── */

/* ── DAILY MOTIVATIONAL QUOTES ──────────────────────────────────────────────── */
const CLEANSE_QUOTES = [
  'Every glass of water is a step toward a cleaner you.',
  'Your body is working hard. Trust the process.',
  'Day by day, you\'re becoming a better version of yourself.',
  'The hardest part is starting. You already did that.',
  'Clean eating, clear mind, renewed energy.',
  'You didn\'t come this far to only come this far.',
  'Your future self is grateful you started today.',
  'Small steps every day lead to big changes.',
  'Nourish to flourish.',
  'This cleanse is a gift you\'re giving yourself.',
  'Discipline today, vitality tomorrow.',
  'Listen to your body. It\'s telling you something good.',
  'Every meal is a chance to fuel your best self.',
  'Progress, not perfection.',
  'You are what you repeatedly do. Make it count.',
  'The cleanse is temporary. The benefits are lasting.',
  'Hydration is the foundation of everything.',
  'Your dedication today shapes your health tomorrow.',
  'Seven days to reset. A lifetime to benefit.',
  'Believe in the process. The results are coming.',
];

function getTodayQuote() {
  const idx = Math.floor(Date.now() / 86400000) % CLEANSE_QUOTES.length;
  return CLEANSE_QUOTES[idx];
}

const _MOOD_PHRASES = {
  sad:      'Needs some love today',
  neutral:  'Staying steady',
  happy:    'Feeling good!',
  thriving: 'THRIVING!',
};

/* ── DAY-AWARE COMPANION HELPERS ─────────────────────────────────────────── */

function getDayContext() {
  const day = getCleanseDay();
  if (day === null || day === 8) return 0; // 0 = no active cleanse
  return day; // 1–7
}

function getDayAwareMoodPhrase(mood, day) {
  if (mood === 'sad') {
    if (day >= 1 && day <= 2) return 'Just getting started — hang in there';
    if (day >= 3 && day <= 4) return "The hardest days. You've got this";
    if (day >= 5)             return 'So close to the end. Push through';
    return 'Needs some love today';
  }
  if (mood === 'neutral') {
    if (day === 1) return 'Day 1 — the journey begins!';
    if (day === 2) return 'Day 2 — building momentum';
    if (day === 3) return 'Halfway through the toughest part';
    if (day === 4) return 'Over the hump — keep going';
    if (day === 5 || day === 6) return 'Staying strong';
    if (day === 7) return 'Final day — make it count!';
    return 'Staying steady';
  }
  if (mood === 'happy') {
    if (day === 1) return 'Strong start to Day 1!';
    if (day === 2) return 'Day 2 and feeling it!';
    if (day === 3) return 'Made it to Day 3!';
    if (day === 4 || day === 5) return 'Feeling the cleanse!';
    if (day >= 6) return 'Almost there and thriving!';
    return 'Feeling good!';
  }
  if (mood === 'thriving') {
    if (day === 1) return 'Day 1 energy is incredible!';
    if (day === 2 || day === 3) return 'Already thriving!';
    if (day === 4 || day === 5) return 'Mid-cleanse and THRIVING!';
    if (day === 6) return 'Peak cleanse energy!';
    if (day === 7) return 'Day 7 and THRIVING! 🌺';
    return 'THRIVING!';
  }
  return 'Staying steady';
}

function getDayAwareSpeech(mood, day) {
  if (mood === 'sad') {
    if (day >= 1 && day <= 2) return "Starting out rough? That's normal. Keep going! 💪";
    if (day >= 3 && day <= 4) return `Day ${day} is tough. Most people feel this way. Push through!`;
    if (day >= 5)             return "So close to the finish line. Don't give up now!";
    return 'Log some activity to cheer me up! 💧';
  }
  if (mood === 'neutral') {
    if (day === 1) return "Day 1 — the journey begins! Let's do this together 🌱";
    if (day === 2) return "Day 2, you showed up again. That's what matters!";
    if (day === 3) return "Halfway through the hardest part. You've got this!";
    if (day === 4) return "Day 4 — you're over the hump. Energy is coming!";
    if (day === 5) return 'Day 5 already! The end is in sight 🌿';
    if (day === 6) return 'Almost there. One more push!';
    if (day === 7) return 'FINAL DAY! Make it count! 🌟';
    return 'Ready to start your cleanse? Set your start date!';
  }
  if (mood === 'happy') {
    if (day === 1) return 'Great start! Day 1 and already crushing it 🌱';
    if (day === 2) return 'Day 2 and feeling good — this is how it starts!';
    if (day === 3) return "You made it to Day 3! The hardest part is behind you ✨";
    if (day === 4 || day === 5) return 'Feeling the cleanse now! Keep that momentum going!';
    if (day >= 6) return 'Look at you! Almost done and thriving 🌻';
    return 'Tap to get started on your cleanse journey!';
  }
  if (mood === 'thriving') {
    if (day === 1) return "Incredible Day 1 energy! You're setting the tone 🌺";
    if (day >= 2 && day <= 3) return 'Already thriving! Your body is responding beautifully 🌺✨';
    if (day >= 4 && day <= 5) return 'Mid-cleanse and THRIVING! This is what it feels like! 🌺✨';
    if (day === 6) return 'Day 6 and at your peak! One more day of this amazingness!';
    if (day === 7) return 'DAY 7 AND THRIVING! You did it! 🌺✨🎉';
    return 'Start your cleanse to unlock this energy!';
  }
  return "Keep going, you're doing well!";
}

const _MOOD_PHRASE_COLORS = {
  sad:      '#6b7280',
  neutral:  'var(--dk-green)',
  happy:    'var(--dk-green)',
  thriving: 'var(--amber)',
};

/* ── TASK F: AUTO THOUGHT BUBBLE — MESSAGES BY MOOD ────────────────────────── */
const COMPANION_THOUGHTS = {
  sad: [
    "I'm feeling a little droopy today...",
    "Water would really help right now 💧",
    "Even plants have tough days.",
    "I believe in you, even when it's hard.",
    "Rest if you need to. I'll be here.",
    "Tomorrow is a fresh start 🌱"
  ],
  neutral: [
    "Steady and growing, just like you.",
    "One step at a time.",
    "You're doing better than you think.",
    "Keep going. I'm rooting for you 🌿",
    "Consistency beats perfection.",
    "Today counts. Every day counts."
  ],
  happy: [
    "I can feel your energy today! ✨",
    "Something good is happening here.",
    "You're making this look easy 🌿",
    "This is what progress feels like.",
    "Keep that momentum going!",
    "Proud of you. Seriously."
  ],
  thriving: [
    "WE ARE THRIVING! 🌺",
    "This is peak cleanse energy!",
    "Look at us go! 🌺✨",
    "You're glowing. I'm glowing. We're glowing.",
    "Day [X] and absolutely unstoppable.",
    "This feeling is why we started."
  ]
};

let _lastThoughtIndex        = -1;
let _companionThoughtInterval = null;

function solStageFromWater(count) {
  if (count >= 12) return 4;
  if (count >= 8) return 3;
  if (count >= 4) return 2;
  return 1;
}

function solExpressionFromMood(mood) {
  const map = { sad: 'sleepy', neutral: 'happy', happy: 'happy', thriving: 'celebrate' };
  return map[mood] || 'happy';
}

function renderCompanionWidget() {
  if (!isLoggedIn()) return;
  const old = document.getElementById('companion-widget');
  if (old) old.remove();

  const companion = getCompanion();
  const waterCount = STATE.water[STATE.activeDay] || 0;
  const solStage = solStageFromWater(waterCount);

  const lastBadges = companion.badges.length >= 3
    ? companion.badges.slice(-3).map(b => {
        const def = BADGES.find(x => x.id === b.id);
        return def ? def.emoji : '';
      }).join('')
    : '';

  const w = document.createElement('div');
  w.id = 'companion-widget';
  w.className = 'companion-widget';
  const phraseColor   = _MOOD_PHRASE_COLORS[companion.mood] || _MOOD_PHRASE_COLORS.neutral;
  const currentDay    = getDayContext();
  const currentPhrase = getDayAwareMoodPhrase(companion.mood, currentDay);
  w.innerHTML = `
    <div class="companion-right">
      <div class="companion-svg-wrap" id="companion-svg">
        ${renderSolArt({ stage: solStage, expression: solExpressionFromMood(companion.mood), variant: 'plant' })}
      </div>
      <div class="companion-tap-hint">Tap me!</div>
    </div>
    <div class="companion-left">
      <div class="companion-name">Your Cleanse Companion</div>
      <div class="companion-mood-phrase" id="companion-mood-label" style="color:${phraseColor}">${currentPhrase}</div>
      <div class="companion-stats">
        <div class="companion-stat">
          <span class="stat-val" id="companion-points-today">${(companion.pointsByDay && companion.pointsByDay[STATE.activeDay]) || 0}</span>
          <span class="stat-label">TODAY'S PTS</span>
        </div>
        <div class="companion-stat">
          <span class="stat-val" id="companion-streak">${companion.streak}</span>
          <span class="stat-label">DAY STREAK</span>
        </div>
        <div class="companion-stat companion-stat-gated" id="companion-alltime-wrap">
          <span class="stat-val" id="companion-alltime">${companion.allTimePoints || '--'}</span>
          <span class="stat-label">ALL-TIME PTS</span>
        </div>
      </div>
      <div class="companion-badges-row" id="companion-badges-row">${lastBadges}</div>
      <button class="companion-tap-btn" id="companion-tap-btn" onclick="tapCompanion()">
        Say Hello
      </button>
    </div>
    <div class="companion-quote">
      <div class="companion-quote-label">TODAY'S THOUGHT</div>
      <div class="companion-quote-text">${getTodayQuote()}</div>
    </div>`;

  const grid = document.querySelector('#page-home .home-desktop-grid');
  if (grid && grid.parentNode) grid.parentNode.insertBefore(w, grid);
  const plantSvg = document.querySelector('#companion-svg svg');
  if (plantSvg) {
    plantSvg.style.cursor = 'pointer';
    plantSvg.onclick = tapCompanion;
    plantSvg.classList.add('sf-svg');
    plantSvg.classList.toggle('sf-thriving', companion.mood === 'thriving');
  }
  initCompanionThoughts();
  gateCompanionWidget();
}

function gateCompanionWidget() {
  if (canAccess('checklist-full')) return; // paid users -- no gating

  const pointsEl = document.getElementById('companion-points-today');
  if (pointsEl) pointsEl.style.filter = 'blur(4px)';

  const streakEl = document.getElementById('companion-streak');
  if (streakEl) streakEl.style.filter = 'blur(4px)';

  const alltimeEl = document.getElementById('companion-alltime');
  if (alltimeEl) alltimeEl.style.filter = 'blur(4px)';

  const tapBtn = document.getElementById('companion-tap-btn');
  if (tapBtn) {
    tapBtn.style.opacity = '0.6';
    tapBtn.onclick = () => showUpgradeModal('Unlock your cleanse companion with any paid plan.');
    if (!tapBtn.querySelector('.tap-btn-lock')) {
      const lockSpan = document.createElement('span');
      lockSpan.className = 'tap-btn-lock';
      lockSpan.textContent = '🔒';
      tapBtn.appendChild(lockSpan);
    }
  }

  const tapHint = document.querySelector('#companion-widget .companion-tap-hint');
  if (tapHint) {
    tapHint.style.pointerEvents = 'none';
    tapHint.style.opacity = '0.6';
    if (!tapHint.querySelector('.tap-hint-lock')) {
      const lockSpan = document.createElement('span');
      lockSpan.className = 'tap-hint-lock';
      lockSpan.textContent = '🔒';
      tapHint.appendChild(lockSpan);
    }
  }

  const plantSvg = document.querySelector('#companion-svg svg');
  if (plantSvg) {
    plantSvg.style.cursor = 'default';
    plantSvg.onclick = null;
  }
}

function tapCompanion() {
  const companion = getCompanion();
  const day    = getDayContext();
  const speech = getDayAwareSpeech(companion.mood, day);
  playCompanionSound(companion.mood);

  // Add .sf-tapped to the SVG element itself (not just the wrapper)
  const svgEl = document.querySelector('#companion-svg svg');
  if (svgEl) {
    svgEl.classList.remove('sf-tapped');
    void svgEl.offsetWidth;
    svgEl.classList.add('sf-tapped');
    setTimeout(() => svgEl.classList.remove('sf-tapped'), 600);
  }

  // Show speech bubble above the plant column (companion-right)
  const right = document.querySelector('#companion-widget .companion-right');
  if (right) {
    const old = right.querySelector('.companion-speech');
    if (old) old.remove();
    const bubble = document.createElement('div');
    bubble.className = 'companion-speech';
    bubble.textContent = speech;
    right.insertBefore(bubble, right.firstChild); // above the SVG wrap
    setTimeout(() => {
      bubble.style.transition = 'opacity 0.4s';
      bubble.style.opacity    = '0';
      setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 450);
    }, 2000);
  }
}

function updateCompanionDisplay() {
  if (!isLoggedIn()) return;
  const companion = getCompanion();
  const today = toLocalDateStr(new Date());

  // Recalculate mood for whichever day is currently active, no reset needed,
  // pointsByDay already holds each day's own permanent total
  if (companion.lastActiveDay !== STATE.activeDay) {
    companion.lastActiveDay = STATE.activeDay;
    companion.mood = _calcMood((companion.pointsByDay && companion.pointsByDay[STATE.activeDay]) || 0);
    saveCompanion(companion);
  }

  const svgWrap = document.getElementById('companion-svg');
  if (svgWrap && typeof renderSolArt === 'function') {
    const waterCount = STATE.water[STATE.activeDay] || 0;
    svgWrap.innerHTML = renderSolArt({
      stage: solStageFromWater(waterCount),
      expression: solExpressionFromMood(companion.mood),
      variant: 'plant'
    });
    const solSvg = svgWrap.querySelector('svg');
    if (solSvg) {
      solSvg.style.cursor = 'pointer';
      solSvg.onclick = tapCompanion;
      solSvg.classList.add('sf-svg');
      solSvg.classList.toggle('sf-thriving', companion.mood === 'thriving');
    }
  }

  const el = (id) => document.getElementById(id);
  if (el('companion-points-today')) el('companion-points-today').textContent = (companion.pointsByDay && companion.pointsByDay[STATE.activeDay]) || 0;
  if (el('companion-streak'))       el('companion-streak').textContent       = companion.streak;
  if (el('companion-alltime'))      el('companion-alltime').textContent      = companion.allTimePoints || '--';
  if (el('companion-mood-label')) {
    el('companion-mood-label').textContent = getDayAwareMoodPhrase(companion.mood, getDayContext());
    el('companion-mood-label').style.color = _MOOD_PHRASE_COLORS[companion.mood] || _MOOD_PHRASE_COLORS.neutral;
  }
  if (el('companion-badges-row')) {
    el('companion-badges-row').textContent = companion.badges.length >= 3
      ? companion.badges.slice(-3).map(b => {
          const def = BADGES.find(x => x.id === b.id);
          return def ? def.emoji : '';
        }).join('')
      : '';
  }
}

/* ── TASK F: AUTO THOUGHT BUBBLE — LOGIC ───────────────────────────────────── */

function showAutoThought() {
  // Only fire when user is on the Today page
  if (STATE.activePage !== 'home') return;

  const right = document.querySelector('#companion-widget .companion-right');
  if (!right) return;

  // Don't overlap with the tap speech bubble
  if (right.querySelector('.companion-speech')) return;

  // If a thought is already visible, let it finish — next interval will fire fresh
  if (right.querySelector('.companion-thought')) return;

  // Get mood and pick a non-repeating message
  const companion = getCompanion();
  const mood = companion.mood || 'neutral';
  const pool = COMPANION_THOUGHTS[mood] || COMPANION_THOUGHTS.neutral;

  let idx;
  do {
    idx = Math.floor(Math.random() * pool.length);
  } while (pool.length > 1 && idx === _lastThoughtIndex);
  _lastThoughtIndex = idx;

  // Substitute [X] with current cleanse day number
  let msg = pool[idx];
  const day = getCleanseDay();
  if (day && day >= 1 && day <= 7) {
    msg = msg.replace('[X]', day);
  } else {
    msg = msg.replace('Day [X] and', 'Keep going and');
  }

  // Build thought bubble
  const bubble = document.createElement('div');
  bubble.className = 'companion-thought';
  bubble.textContent = msg;
  right.insertBefore(bubble, right.firstChild);

  // Fade in — double rAF ensures transition fires after first paint
  requestAnimationFrame(() => requestAnimationFrame(() => bubble.classList.add('visible')));

  // Auto-hide after 5 seconds
  setTimeout(() => {
    bubble.classList.remove('visible');
    setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 450);
  }, 5000);
}

function initCompanionThoughts() {
  // Clear any previous interval (safe on widget re-render)
  if (_companionThoughtInterval) {
    clearInterval(_companionThoughtInterval);
    _companionThoughtInterval = null;
  }
  // First thought: 10 seconds after widget loads
  setTimeout(showAutoThought, 10000);
  // Recurring: every 45 seconds
  _companionThoughtInterval = setInterval(showAutoThought, 45000);
}

/* ── TASK G: DAILY CHALLENGE ───────────────────────────────────────────────── */

const DAILY_CHALLENGES = [
  { day: 1,    text: 'Drink all your water before 6pm today',                              bonus: 30 },
  { day: 2,    text: 'Try the ginger variation of your morning juice',                      bonus: 30 },
  { day: 3,    text: 'Write at least 3 sentences in today\'s journal',                      bonus: 30 },
  { day: 4,    text: 'Complete your morning routine before 8am',                            bonus: 30 },
  { day: 5,    text: 'Try a recipe swap you haven\'t used before',                           bonus: 30 },
  { day: 6,    text: 'Log all your body metrics in the tracker today',                       bonus: 30 },
  { day: 7,    text: 'Share your results with someone who needs this cleanse',              bonus: 30 },
  { day: null, text: 'Hit your water goal before noon',                                     bonus: 30 },
  { day: null, text: 'Complete your evening journal entry before 9pm',                      bonus: 30 },
  { day: null, text: 'Try a new recipe swap today',                                         bonus: 30 },
  { day: null, text: 'Log your weight and one other metric today',                          bonus: 30 },
  { day: null, text: 'Drink your first glass of water within 10 minutes of waking',         bonus: 30 },
];

function _getTodayChallenge() {
  const day = getCleanseDay();
  if (day && day >= 1 && day <= 7) {
    const specific = DAILY_CHALLENGES.find(c => c.day === day);
    if (specific) return specific;
  }
  const nulls = DAILY_CHALLENGES.filter(c => c.day === null);
  const parts = toLocalDateStr(new Date()).split('-').map(Number);
  const idx   = (parts[0] + parts[1] + parts[2]) % nulls.length;
  return nulls[idx];
}

function renderDailyChallenge() {
  if (!isLoggedIn()) return;
  const old = document.getElementById('daily-challenge-card');
  if (old) old.remove();

  const ch      = _getTodayChallenge();
  if (!ch) return;
  const today     = toLocalDateStr(new Date());
  const done      = localStorage.getItem('challengeComplete_' + today) === '1';

  const card = document.createElement('div');
  card.id = 'daily-challenge-card';
  card.className = 'daily-challenge-card';
  card.innerHTML = `
    <div class="challenge-header"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.4 6.4L21 9l-5 4.4L17.5 21 12 17.3 6.5 21 8 13.4 3 9l6.6-.6L12 2z"/></svg> Today's Challenge</div>
    <div class="challenge-text">${ch.text}</div>
    <div class="challenge-footer">
      <span class="challenge-points-badge">+${ch.bonus} pts</span>
      <button class="challenge-btn${done ? ' completed' : ''}"
        onclick="${done ? '' : 'completeChallenge()'}"
        ${done ? 'disabled' : ''}>
        ${done ? '✓ Challenge Complete!' : 'Complete Challenge'}
      </button>
    </div>`;

  // Insert after companion widget, before the grid
  const grid   = document.querySelector('#page-home .home-desktop-grid');
  const widget = document.getElementById('companion-widget');
  const anchor = widget ? widget.nextSibling : grid;
  if (grid && grid.parentNode) grid.parentNode.insertBefore(card, anchor);
}

function completeChallenge() {
  const today = toLocalDateStr(new Date());
  localStorage.setItem('challengeComplete_' + today, '1');
  syncDailyProgress(today);
  awardPoints(POINTS_CHALLENGE_COMPLETE, 'challenge');
  const btn = document.querySelector('#daily-challenge-card .challenge-btn');
  if (btn) { btn.textContent = '✓ Challenge Complete!'; btn.classList.add('completed'); btn.disabled = true; }
}

/* ═══════════════════════════════════════════════════════════════════════════
   FOODS TO AVOID — TASKS H–J
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── TASK H: AVOID LIST DATA ────────────────────────────────────────────────── */

const FOODS_TO_AVOID = [
  { item: 'Coffee & Caffeine',       icon: '☕', note: 'Yes, this means coffee. Your morning lemon water will surprise you — most people stop missing it by Day 3.' },
  { item: 'Alcohol',                 icon: '🍷', note: 'Any alcohol will counteract the detox process. Save the celebration for Day 8.' },
  { item: 'Meat & Poultry',          icon: '🥩', note: 'All animal proteins except the pre-cleanse salmon meal are excluded during the 7 days.' },
  { item: 'Dairy Products',          icon: '🧀', note: 'Milk, cheese, yogurt, and butter are all excluded. Almond milk is fine.' },
  { item: 'Bread & Grains',          icon: '🍞', note: 'All bread, pasta, rice, and refined grains are excluded for the 7 days.' },
  { item: 'Added Salt',              icon: '🧂', note: 'Avoid adding salt to anything. Sea salt is used sparingly in specific recipes only.' },
  { item: 'Refined Sugar',           icon: '🍬', note: 'No added sugar, candy, or artificial sweeteners. Fruit is fine.' },
  { item: 'Fried & Processed Foods', icon: '🍟', note: 'Nothing fried or packaged. If it has more than 5 ingredients on the label, skip it.' },
  { item: 'Soda & Sugary Drinks',    icon: '🥤', note: 'All sodas, sports drinks, and fruit juices with added sugar. Water and herbal tea only.' },
  { item: 'Eggs',                    icon: '🥚', note: 'Excluded for the full 7 days.' },
];

/* ── TASK I: AVOID CARD ON TODAY PAGE ──────────────────────────────────────── */

function renderAvoidCard() {
  const old = document.getElementById('avoid-card');
  if (old) old.remove();

  const day        = getCleanseDay();
  const isEarly    = !day || day <= 2;
  const savedState = localStorage.getItem('avoidListCollapsed');
  const collapsed  = savedState !== null ? savedState === 'true' : !isEarly;

  const itemsHtml = FOODS_TO_AVOID.map((f, i) => `
    <div class="avoid-item" id="avoid-item-${i}" onclick="toggleAvoidItem(${i})">
      <span>${f.icon}</span> <span>${f.item}</span>
    </div>`).join('');

  const notesHtml = FOODS_TO_AVOID.map((f, i) =>
    `<div class="avoid-item-note" id="avoid-note-${i}" style="display:none">${f.note}</div>`
  ).join('');

  const subtitleHtml = isEarly
    ? `<div class="avoid-subtitle">Keep this in mind every day — especially the first few days.</div>`
    : '';

  const card = document.createElement('div');
  card.id = 'avoid-card';
  card.className = 'avoid-card';
  card.innerHTML = `
    <div class="avoid-header" onclick="toggleAvoidCard()">
      <span class="avoid-title">🚫 Things to Avoid During Your Cleanse</span>
      <span class="avoid-chevron" id="avoid-chevron">${collapsed ? '▾' : '▴'}</span>
    </div>
    ${subtitleHtml}
    <div id="avoid-body" style="display:${collapsed ? 'none' : 'block'}">
      <div class="avoid-grid">${itemsHtml}</div>
      <div id="avoid-notes-area">${notesHtml}</div>
      <div class="avoid-footer-note">The pre-cleanse salmon meal on Night Before Day 1 is the only exception to the no-meat rule.</div>
    </div>`;

  // Insert inside .home-desktop-main, immediately before #home-meals
  const mealsEl = document.getElementById('home-meals');
  if (mealsEl && mealsEl.parentNode) mealsEl.parentNode.insertBefore(card, mealsEl);
}

function toggleAvoidCard() {
  const body    = document.getElementById('avoid-body');
  const chevron = document.getElementById('avoid-chevron');
  if (!body) return;
  const hidden = body.style.display === 'none';
  body.style.display = hidden ? 'block' : 'none';
  if (chevron) chevron.textContent = hidden ? '▴' : '▾';
  localStorage.setItem('avoidListCollapsed', hidden ? 'false' : 'true');
}

function toggleAvoidItem(index) {
  const item   = document.getElementById('avoid-item-' + index);
  if (!item) return;
  const isOpen = item.classList.contains('expanded');
  // Close all
  FOODS_TO_AVOID.forEach((_, i) => {
    const it = document.getElementById('avoid-item-' + i);
    const nt = document.getElementById('avoid-note-' + i);
    if (it) it.classList.remove('expanded');
    if (nt) nt.style.display = 'none';
  });
  // Toggle open if it was closed
  if (!isOpen) {
    item.classList.add('expanded');
    const note = document.getElementById('avoid-note-' + index);
    if (note) note.style.display = 'block';
  }
}

/* ── TASK J: AVOID BANNER ON RECIPES PAGE ──────────────────────────────────── */

function renderAvoidBanner() {
  const old = document.getElementById('avoid-recipes-banner');
  if (old) old.remove();
  if (sessionStorage.getItem('avoidRecipesBannerDismissed') === '1') return;

  const banner = document.createElement('div');
  banner.id = 'avoid-recipes-banner';
  banner.className = 'avoid-recipes-banner';
  banner.innerHTML = `
    <span>🚫 No coffee, dairy, meat, alcohol, salt, or added sugar during the cleanse.
      <span class="avoid-recipes-see-list" onclick="showAvoidModal()">See full list</span>
    </span>
    <button class="avoid-recipes-dismiss" onclick="dismissAvoidBanner()" aria-label="Dismiss">×</button>`;

  const content = document.querySelector('#page-recipes .content');
  if (content) content.insertBefore(banner, content.firstChild);
}

function dismissAvoidBanner() {
  sessionStorage.setItem('avoidRecipesBannerDismissed', '1');
  const b = document.getElementById('avoid-recipes-banner');
  if (b) b.remove();
}

function showAvoidModal() {
  const existing = document.getElementById('avoid-modal');
  if (existing) { existing.remove(); return; }

  const itemsHtml = FOODS_TO_AVOID.map(f => `
    <div class="avoid-modal-item">
      <span class="avoid-modal-icon">${f.icon}</span>
      <div>
        <div class="avoid-modal-name">${f.item}</div>
        <div class="avoid-modal-note">${f.note}</div>
      </div>
    </div>`).join('');

  const modal = document.createElement('div');
  modal.id = 'avoid-modal';
  modal.className = 'avoid-modal-overlay';
  modal.innerHTML = `
    <div class="avoid-modal-backdrop" onclick="showAvoidModal()"></div>
    <div class="avoid-modal-sheet">
      <div class="avoid-modal-header">
        <span class="avoid-modal-title">🚫 Avoid During Your Cleanse</span>
        <button class="avoid-modal-close" onclick="showAvoidModal()">×</button>
      </div>
      <div class="avoid-modal-body">${itemsHtml}</div>
    </div>`;
  document.body.appendChild(modal);
}

/* ── INIT ─────────────────────────────────────────────────────────────────── */

/* ── WINDOW SCOPE EXPORTS (Fix 2) ────────────────────────────────────────── */
// Explicit window assignments guarantee inline onclick handlers can reach
// these functions even on tablets or in contexts where the script runner
// doesn't automatically hoist top-level declarations onto window.
window.handleResetCleanse       = handleResetCleanse;
window.openSchedulerSettings    = openSchedulerSettings;
window.startOnboardingFlow      = startOnboardingFlow;
window.markBundlePurchased      = markBundlePurchased;
window.showUpgradeModal         = showUpgradeModal;
window.dismissPlanBanner        = dismissPlanBanner;
window.shareCleanse             = shareCleanse;
window.restartCleanse           = restartCleanse;
window.navigate                 = navigate;
window.updateDayProgress        = updateDayProgress;
window.toggleCheck              = toggleCheck;
window.togglePreCleanse         = togglePreCleanse;
window.toggleMealCard           = toggleMealCard;
window.renderShop               = renderShop;
window.handleEmailCapture       = handleEmailCapture;
window.randomize                = randomize;
window.toggleRecipeCard         = toggleRecipeCard;
window.saveDay                  = saveDay;
window.saveJournalEntry         = saveJournalEntry;
window.setTrackerDay            = setTrackerDay;
window.setWellness              = setWellness;
window.selectMood               = selectMood;
window.showDayToast             = showDayToast;
window.setCleanseStart          = setCleanseStart;
window.showHealthScreening      = showHealthScreening;
window.setHealthAnswer          = setHealthAnswer;
window.submitHealthScreening    = submitHealthScreening;
window.acknowledgeHealthWarning = acknowledgeHealthWarning;
window.onSlotChange             = onSlotChange;
window.onShopGroupChange        = onShopGroupChange;
window.toggleWater              = toggleWater;
window.showAutoThought          = showAutoThought;
window.updateWHRDisplay         = updateWHRDisplay;
window.handleSecureDownload     = handleSecureDownload;

/* ═══════════════════════════════════════════════════════════════════════════
   CLOUD SYNC — Supabase
   All functions are async and non-blocking. Errors are caught and warned —
   the UI never crashes from a sync failure.

   Requires: window.sbClient (set in auth.js), isLoggedIn() (auth.js global),
             AUTH.user.id (auth.js global), STATE / helper fns (this file).
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Upserts one day's water, meals, journal, and challenge status to Supabase.
 * @param {string} date  YYYY-MM-DD local date string for the day to sync.
 */
async function syncDailyProgress(date) {
  const sb = window.sbClient;
  if (!sb || !isLoggedIn() || !date) return;
  try {
    const startStr = localStorage.getItem('cleanseStartDate');
    if (!startStr) return;
    const dayNum = Math.round((parseDateLocal(date) - parseDateLocal(startStr)) / 86400000) + 1;
    if (dayNum < 1 || dayNum > 7) return;

    // Collect tracker entries for this day (metrics, wellness, mood)
    const mealsData   = {};
    const journalData = {};
    Object.entries(STATE.tracker).forEach(([k, v]) => {
      const segment = parseInt((k.split('_')[1]) || '0');
      if (k.match(/^(metric|wellness|mood)_/) && segment === dayNum) mealsData[k]   = v;
      if (k.match(/^journal_/)                && segment === dayNum) journalData[k] = v;
    });

    // Include recipe-swap selections for this day (key pattern: "day{N}_...")
    const dayTag = `day${dayNum}_`;
    const selections = {};
    Object.entries(STATE.selections).forEach(([k, v]) => {
      if (k.startsWith(dayTag)) selections[k] = v;
    });
    if (Object.keys(selections).length) mealsData.selections = selections;

    const { error } = await sb.from('daily_progress').upsert({
      user_id:            AUTH.user.id,
      cleanse_date:       date,
      day_number:         dayNum,
      water_glasses:      STATE.water[dayNum] || 0,
      meals_data:         mealsData,
      journal_data:       journalData,
      challenge_complete: localStorage.getItem(`challengeComplete_${date}`) === '1',
    }, { onConflict: 'user_id,cleanse_date' });

    if (error) console.warn('[sync] daily_progress:', error.message);
  } catch(e) {
    console.warn('[sync] syncDailyProgress error:', e);
  }
}

/**
 * Upserts body metrics for a specific tracker day to Supabase.
 * Photos are kept local only until Supabase Storage is wired in a future session.
 * @param {number} dayNumber  Cleanse day number 1–7.
 */
async function syncBodyMetrics(dayNumber) {
  const sb = window.sbClient;
  if (!sb || !isLoggedIn() || !dayNumber) return;
  try {
    const metrics = {};
    const prefix  = `metric_${dayNumber}_`;
    Object.entries(STATE.tracker).forEach(([k, v]) => {
      if (k.startsWith(prefix)) metrics[k.slice(prefix.length)] = v;
    });

    const { error } = await sb.from('body_metrics').upsert({
      user_id:    AUTH.user.id,
      day_number: dayNumber,
      metrics:    metrics,
      photos:     null, // photos stored separately in Supabase Storage bucket "photos"
    }, { onConflict: 'user_id,day_number' });

    if (error) console.warn('[sync] body_metrics:', error.message);
  } catch(e) {
    console.warn('[sync] syncBodyMetrics error:', e);
  }
}

/**
 * Upserts the user's points, badges, and streak to Supabase.
 */
async function syncGamification() {
  const sb = window.sbClient;
  if (!sb || !isLoggedIn()) return;
  try {
    const companion = getCompanion();
    const { error } = await sb.from('gamification').upsert({
      user_id:     AUTH.user.id,
      points:      companion.points || 0,
      badges:      companion.badges || [],
      streak:      companion.streak || 0,
      streak_date: companion.lastStreakDate || null,
    }, { onConflict: 'user_id' });

    if (error) console.warn('[sync] gamification:', error.message);
  } catch(e) {
    console.warn('[sync] syncGamification error:', e);
  }
}

/**
 * Upserts the full companion state object to Supabase.
 */
async function syncCompanionState() {
  const sb = window.sbClient;
  if (!sb || !isLoggedIn()) return;
  try {
    const { error } = await sb.from('companion_state').upsert({
      user_id: AUTH.user.id,
      state:   getCompanion(),
    }, { onConflict: 'user_id' });

    if (error) console.warn('[sync] companion_state:', error.message);
  } catch(e) {
    console.warn('[sync] syncCompanionState error:', e);
  }
}

/**
 * Fetches all user data from Supabase and restores it to localStorage + STATE.
 * Called once on login, inside auth.js _initSupabaseSession().
 * The _cloudLoadInProgress flag prevents saveCompanion() from echoing
 * freshly-fetched data straight back to the database.
 */
async function loadCloudData() {
  const sb = window.sbClient;
  if (!sb || !isLoggedIn()) return;
  _cloudLoadInProgress = true;
  try {
    const userId = AUTH.user.id;

    const [
      { data: dailyRows    },
      { data: metricRows   },
      { data: gamRow       },
      { data: companionRow },
      { data: cleanseRows  },
      { data: profileRow   },
    ] = await Promise.all([
      sb.from('daily_progress').select('*').eq('user_id', userId),
      sb.from('body_metrics').select('*').eq('user_id', userId),
      sb.from('gamification').select('*').eq('user_id', userId).maybeSingle(),
      sb.from('companion_state').select('*').eq('user_id', userId).maybeSingle(),
      sb.from('past_cleanses').select('*').eq('user_id', userId),
      sb.from('profiles').select('health_screening_complete, cleanse_start_date, prep_checklist, plan').eq('id', userId).maybeSingle(),
    ]);

    // ── Daily progress: water, tracker, journal, challenge completion, selections
    if (dailyRows && dailyRows.length) {
      dailyRows.forEach(row => {
        const day = row.day_number;
        if (day && row.water_glasses != null) STATE.water[day] = row.water_glasses;
        if (row.cleanse_date && row.challenge_complete) {
          localStorage.setItem(`challengeComplete_${row.cleanse_date}`, '1');
        }
        const tracker = row.meals_data || {};
        Object.entries(tracker).forEach(([k, v]) => {
          if (k !== 'selections' && /^(metric|wellness|mood)_/.test(k)) STATE.tracker[k] = v;
        });
        const sel = (tracker.selections) || {};
        Object.entries(sel).forEach(([k, v]) => { STATE.selections[k] = v; });
        const journal = row.journal_data || {};
        Object.entries(journal).forEach(([k, v]) => {
          if (/^journal_/.test(k)) STATE.tracker[k] = v;
        });
      });
      saveTracker();
      saveWater();
      saveSelections();
    }

    // ── Body metrics
    if (metricRows && metricRows.length) {
      metricRows.forEach(row => {
        const day = row.day_number;
        Object.entries(row.metrics || {}).forEach(([field, val]) => {
          STATE.tracker[`metric_${day}_${field}`] = val;
        });
        // PHOTOS: stored in Supabase Storage under photos/{userId}/{day}.jpg — loaded on demand via /api/photo-url
      });
      saveTracker();
    }

    // ── Gamification (partial restore — companion_state wins below if present)
    if (gamRow) {
      const companion = getCompanion();
      if (gamRow.points    != null) companion.points         = gamRow.points;
      // FIX 2: allTimePoints must also be seeded from gamRow.points so Today PTS and All-Time PTS
      // diverge correctly. companion_state will override this below if a full row is present.
      if (gamRow.points    != null && gamRow.points > (companion.allTimePoints || 0))
        companion.allTimePoints = gamRow.points;
      if (gamRow.badges)             companion.badges         = gamRow.badges;
      if (gamRow.streak    != null) companion.streak          = gamRow.streak;
      if (gamRow.streak_date)        companion.lastStreakDate  = gamRow.streak_date;
      localStorage.setItem('cleanseCompanion', JSON.stringify(companion));
      if (gamRow.streak)       localStorage.setItem('thrivingStreak',     String(gamRow.streak));
      if (gamRow.streak_date)  localStorage.setItem('thrivingStreakDate', gamRow.streak_date);
    }

    // ── Companion state (full object — takes precedence over gamRow partial,
    // except pointsByDay, which is merged by taking the higher value per day.
    // This guards against a stale cloud snapshot winning a race against a
    // same-device sync that has not landed in Supabase yet.)
    if (companionRow && companionRow.state) {
      const localBefore = getCompanion();
      const cloudState = companionRow.state;
      const mergedPointsByDay = Object.assign({}, cloudState.pointsByDay || {});
      Object.keys(localBefore.pointsByDay || {}).forEach(day => {
        const localVal = localBefore.pointsByDay[day] || 0;
        const cloudVal = mergedPointsByDay[day] || 0;
        if (localVal > cloudVal) mergedPointsByDay[day] = localVal;
      });
      cloudState.pointsByDay = mergedPointsByDay;
      localStorage.setItem('cleanseCompanion', JSON.stringify(cloudState));
    }

    // ── Past cleanses
    if (cleanseRows && cleanseRows.length) {
      const history = cleanseRows.map(r => ({
        startDate:   r.start_date,
        completedAt: r.end_date,
        ...(r.summary || {}),
      }));
      localStorage.setItem('completedCleanse', JSON.stringify(history));
    }

    // ── Health screening status
    if (profileRow?.health_screening_complete) {
      localStorage.setItem(_healthKey(), 'true');
    }

    // ── Cleanse start date (restores across devices / after localStorage clear)
    if (profileRow?.cleanse_start_date) {
      localStorage.setItem('cleanseStartDate', profileRow.cleanse_start_date);
      localStorage.setItem('cleanseUserId', userId);
    }

    // ── Prep checklist
    if (profileRow?.prep_checklist) {
      const normalized = normalizePrepChecklist(profileRow.prep_checklist);
      STATE.prepChecklist = normalized;
      localStorage.setItem('detox_prep_checklist', JSON.stringify(normalized));
    }

    // ── Plan (database row is authoritative after a Stripe checkout webhook write)
    if (profileRow && profileRow.plan) {
      AUTH.plan = profileRow.plan;
    }

    _cloudDataLoaded = true;

  } catch(e) {
    console.warn('[sync] loadCloudData error:', e);
  } finally {
    _cloudLoadInProgress = false;
    if (isLoggedIn()) updateCompanionDisplay();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Snapshot the raw home structure before any render call so renderHome()
  // can restore it if renderCleanseSummary() has replaced page-home's innerHTML.
  window._homePageTemplate = document.getElementById('page-home')?.innerHTML;
  loadState();
  initAuth();

  // Auto-set active day from cleanse start date
  const autoDay = getCleanseDay();
  if (autoDay && autoDay <= 7) STATE.activeDay = autoDay;

  // Check if cleanse is complete — show summary instead of normal home
  if (checkCleanseComplete()) {
    renderCleanseSummary();
  } else {
    renderHome();
  }

  renderRecipesPage();
  renderTracker();
  renderShop('all');
  renderGuide();               // Task 6 & 7: guide + downloads page
  navigate('home');
  updateTrackerSyncMsg();
  renderPlanBanner();
  initCoachButton();           // Task 2: AI coach button visibility

  // Sync progress bar to auto-detected day
  if (autoDay && autoDay <= 7) updateDayProgress(autoDay);

  if (typeof renderTesterBadge === 'function') renderTesterBadge();

  // Restore health banner if user previously acknowledged a warning
  if (_getHealthStatus() === 'warned') {
    const banner = document.getElementById('health-check-banner');
    if (banner) banner.style.display = 'flex';
  }

  // Fix 1: single entry point for the full onboarding sequence
  // New users: health screening → date picker
  // Returning users: skips straight through (both checks pass)
  if (isLoggedIn()) startOnboardingFlow();
  if (isLoggedIn()) initScheduler();
  if (isLoggedIn()) updateCompanionDisplay();

  // Handle Stripe checkout success redirect
  const _checkoutParams = new URLSearchParams(window.location.search);
  if (_checkoutParams.get('checkout') === 'success') {
    window.history.replaceState({}, '', window.location.pathname);
    if (typeof showUpgradeModal === 'function') showUpgradeModal('');
    const sub = document.querySelector('#auth-pricing .auth-sub');
    if (sub) sub.textContent = 'Payment successful! Your plan will update within a few seconds. Please sign out and back in to see your new access.';
  }

  const coachBtn = document.getElementById('coach-chat-btn');
  if (coachBtn && typeof renderSolArt === 'function') {
    coachBtn.innerHTML = renderSolArt({ stage: 4, expression: 'happy', variant: 'coach' });
  }
});