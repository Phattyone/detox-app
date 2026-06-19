/* ═══════════════════════════════════════════════════════════════════════════
   download-guide.js  —  Vercel serverless function: watermarked guide PDF

   Fetches the guide PDF from Supabase Storage, stamps every page with the
   user's name and email in the footer, and streams the result to the browser.

   POST (no body required)
   Authorization: Bearer <jwt>

   Returns the watermarked PDF as application/pdf with Content-Disposition:
   attachment. Free plan users receive 403.

   -- CONNECT: VERCEL ENV --
   SUPABASE_URL              — project URL (Settings → API)
   SUPABASE_SERVICE_ROLE_KEY — service role secret (Settings → API)

   -- SUPABASE STORAGE SETUP --
   Bucket: downloads (private)
   Path:   guides/detox-cleanse-guide.pdf
   ═══════════════════════════════════════════════════════════════════════════ */

const { createClient }                   = require('@supabase/supabase-js');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/* Plans that include guide download access */
const ALLOWED_PLANS = new Set(['basic', 'seasonal', 'premium', 'lifetime']);

module.exports = async function handler(req, res) {

  /* ── CORS preflight ─────────────────────────────────────────────────────── */
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin',  '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ── Validate Authorization header ─────────────────────────────────────── */
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Authorization required. Please sign in and try again.' });
  }

  /* ── Read config from server environment ────────────────────────────────── */
  const supabaseUrl    = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('download-guide: missing Supabase env vars');
    return res.status(500).json({ error: 'Service not configured.' });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  /* ── Validate JWT and get user info ─────────────────────────────────────── */
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session. Please sign in again.' });
  }

  const email = user.email || '';
  const name  = user.user_metadata?.name || email;
  const plan  = user.user_metadata?.plan || 'free';

  /* ── Plan gate ──────────────────────────────────────────────────────────── */
  if (!ALLOWED_PLANS.has(plan)) {
    return res.status(403).json({ error: 'Guide download requires Basic plan or above.' });
  }

  /* ── Fetch PDF from Supabase Storage ────────────────────────────────────── */
  let arrayBuffer;
  try {
    const storageUrl = supabaseUrl +
      '/storage/v1/object/authenticated/downloads/guides/detox-cleanse-guide.pdf';

    const pdfResponse = await fetch(storageUrl, {
      headers: { 'Authorization': 'Bearer ' + serviceRoleKey },
    });

    if (!pdfResponse.ok) {
      console.error('download-guide: storage fetch failed:', pdfResponse.status, await pdfResponse.text());
      throw new Error('Failed to fetch PDF');
    }

    arrayBuffer = await pdfResponse.arrayBuffer();
  } catch (err) {
    console.error('download-guide: storage fetch failed:', err.message || err);
    return res.status(500).json({ error: 'Could not retrieve guide. Please try again.' });
  }

  /* ── Stamp watermark with pdf-lib ───────────────────────────────────────── */
  let pdfBytes;
  try {
    const pdfDoc  = await PDFDocument.load(arrayBuffer);
    const font    = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages   = pdfDoc.getPages();
    const watermarkText = `Licensed to: ${name} | ${email}`;
    const fontSize      = 9;
    const color         = rgb(0.5, 0.5, 0.5);

    pages.forEach(page => {
      const { width } = page.getSize();
      const textWidth  = font.widthOfTextAtSize(watermarkText, fontSize);
      page.drawText(watermarkText, {
        x:    (width - textWidth) / 2,
        y:    20,
        size: fontSize,
        font,
        color,
      });
    });

    pdfBytes = await pdfDoc.save();
  } catch (err) {
    console.error('download-guide: pdf-lib error:', err.message || err);
    return res.status(500).json({ error: 'Could not process guide. Please try again.' });
  }

  /* ── Stream watermarked PDF to browser ──────────────────────────────────── */
  res.setHeader('Content-Type',        'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Detox-Cleanse-Guide.pdf"');
  res.setHeader('Content-Length',      pdfBytes.length);
  res.status(200).send(Buffer.from(pdfBytes));
};
