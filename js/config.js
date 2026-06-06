/* ═══════════════════════════════════════════════════════════════════════════
   CONFIG.JS  —  App configuration and environment setup
   ═══════════════════════════════════════════════════════════════════════════

   SECURITY NOTE: The Anthropic API key is NEVER stored in this file
   or any browser-side JS file. All AI calls route through the Netlify
   serverless proxy in netlify/functions/ai-proxy.js, which reads the
   key securely from the server environment.

   LOCAL DEVELOPMENT:
   ─────────────────
   1. Install Netlify CLI:  npm install -g netlify-cli
   2. Run locally:          netlify dev  (in this directory)
   3. Netlify Dev reads .env.local automatically and makes it available
      to the serverless function at netlify/functions/ai-proxy.js
   4. The browser calls /.netlify/functions/ai-proxy — same in local + prod

   -- CONNECT: NETLIFY ENV --
   Before deploying, add ANTHROPIC_API_KEY to Netlify environment variables:
   Netlify Dashboard → Site Settings → Environment Variables → Add variable
   Variable name: ANTHROPIC_API_KEY
   Variable value: your key from console.anthropic.com
   ═══════════════════════════════════════════════════════════════════════════ */

window.APP_CONFIG = {

  /* ── AI proxy endpoint ────────────────────────────────────────────────────
     Both local (netlify dev) and production use the same path.
     The Netlify function handles CORS and key injection server-side.       */
  AI_PROXY_ENDPOINT: '/.netlify/functions/ai-proxy',

  /* ── Chat rate limiting ───────────────────────────────────────────────── */
  CHAT_SESSION_LIMIT: 20,         // max messages per browser session

  /* ── App version ──────────────────────────────────────────────────────── */
  VERSION: '2.0.0',

  /* ── Asset paths ──────────────────────────────────────────────────────── */
  ASSETS: {
    GUIDE_PDF:       'assets/guide/Guide_Draft_v3.pdf',
    SPREADSHEET:     'assets/spreadsheet/Detox_Cleanse_v6.xlsx',
    SHOPPING_LIST:   'assets/shopping list/Shopping_List_UPDATED.docx',
    CLEANSE_PLAN:    'assets/Cleansing Plan Ref Sheet/Daily_Cleansing_Plan_CLEAN.docx',
  },

  /* ── PDF.js CDN worker path ───────────────────────────────────────────── */
  PDF_WORKER_SRC: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
};
