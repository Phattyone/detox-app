/* ═══════════════════════════════════════════════════════════════════════════
   API.JS  —  External API client (Anthropic AI Coach)
   ═══════════════════════════════════════════════════════════════════════════
   SECURITY: The Anthropic key is NEVER in this file.
   All calls route through netlify/functions/ai-proxy.js.
   ═══════════════════════════════════════════════════════════════════════════ */

const API = {

  /* ── AI Coach system prompt (Task 2) ──────────────────────────────────── */
  COACH_SYSTEM_PROMPT: `You are a knowledgeable and encouraging coach for the 7-Day Organic Vegan Detox & Cleanse program. You help users understand and succeed with the program.

You can answer questions about:
- The 7-day meal plan and daily routines
- Recipes, ingredients, and meal swaps
- Supplements and their benefits
- What to expect during the cleanse (energy, detox symptoms, hunger)
- The morning routine and night-before checklist
- Water intake and hydration
- Shopping, equipment, and preparation
- Motivation and staying on track

For any question involving prescription medications, serious medical conditions, pregnancy, eating disorders, diabetes, heart conditions, or symptoms that concern the user, always respond with: 'That's an important health question that I'm not qualified to answer. Please consult your doctor or healthcare provider before continuing with the cleanse.'

Never claim to be a doctor, nutritionist, or licensed medical professional. Never provide specific medical advice or diagnoses.

For questions completely unrelated to the detox and cleanse program, respond with: 'I'm your detox cleanse coach — I'm best at helping with questions about the 7-day program. Is there something about the cleanse I can help with?'

Keep responses concise, warm, and practical. Use encouraging language. Responses should be 2-4 sentences for simple questions, slightly longer for complex ones. Never use bullet points in responses — write in a natural conversational tone.`,

  /* ── Session-level rate limiting ─────────────────────────────────────── */
  _SESSION_KEY: 'detox_chat_session_count',

  getSessionCount() {
    return parseInt(sessionStorage.getItem(this._SESSION_KEY) || '0');
  },

  incrementSessionCount() {
    const n = this.getSessionCount() + 1;
    sessionStorage.setItem(this._SESSION_KEY, String(n));
    return n;
  },

  isRateLimited() {
    const limit = (window.APP_CONFIG && window.APP_CONFIG.CHAT_SESSION_LIMIT) || 20;
    return this.getSessionCount() >= limit;
  },

  getRemainingMessages() {
    const limit = (window.APP_CONFIG && window.APP_CONFIG.CHAT_SESSION_LIMIT) || 20;
    return Math.max(0, limit - this.getSessionCount());
  },

  /* ── Send a message to the AI coach ─────────────────────────────────── */
  async sendCoachMessage(conversationHistory) {
    // Rate limit check
    if (this.isRateLimited()) {
      throw new Error('RATE_LIMIT');
    }

    const endpoint = (window.APP_CONFIG && window.APP_CONFIG.AI_PROXY_ENDPOINT)
      || '/.netlify/functions/ai-proxy';

    // Keep only the last 6 messages for context (controls cost)
    const recentMessages = conversationHistory.slice(-6).map(m => ({
      role:    m.role,
      content: m.content,
    }));

    const payload = {
      model:      'claude-haiku-4-5',
      max_tokens: 300,
      system:     this.COACH_SYSTEM_PROMPT,
      messages:   recentMessages,
    };

    let response;
    try {
      response = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
    } catch(netErr) {
      throw new Error('Network error — check your connection and try again.');
    }

    if (!response.ok) {
      let msg = 'Something went wrong. Please try again.';
      try {
        const errData = await response.json();
        if (errData.error && typeof errData.error === 'string') msg = errData.error;
        else if (errData.error && errData.error.message)        msg = errData.error.message;
      } catch(e) { /* use default */ }
      throw new Error(msg);
    }

    const data = await response.json();

    // Increment AFTER successful response
    this.incrementSessionCount();

    const text = data.content && data.content[0] && data.content[0].text;
    if (!text) throw new Error('No response received. Please try again.');

    return text;
  },
};
