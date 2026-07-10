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
   Path:   guides/Detox-Cleanse-Guide.pdf
   ═══════════════════════════════════════════════════════════════════════════ */

const { createClient }                   = require('@supabase/supabase-js');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { encryptPDF }                      = require('@pdfsmaller/pdf-encrypt');

/* Plans that include guide download access */
const ALLOWED_PLANS = new Set(['premium', 'lifetime']);

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
  const name  = user.user_metadata?.full_name || user.user_metadata?.name || email;

  const { data: profileRow, error: profileError } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single();

  if (profileError) {
    console.error('download-guide: profile lookup failed:', profileError.message);
    return res.status(500).json({ error: 'Could not verify plan. Please try again.' });
  }

  const plan = profileRow?.plan || 'free';

  /* ── Plan gate ──────────────────────────────────────────────────────────── */
  if (!ALLOWED_PLANS.has(plan)) {
    return res.status(403).json({ error: 'Guide download requires Premium plan or above.' });
  }

  /* ── Block 1A — Generate signed URL ────────────────────────────────────── */
  let signedUrl;
  try {
    const { data: signedData, error: signError } = await supabase.storage
      .from('downloads')
      .createSignedUrl('guides/Detox-Cleanse-Guide-Digital.pdf', 60);

    if (signError || !signedData?.signedUrl) {
      console.error('download-guide: signed URL failed:', signError);
      return res.status(500).json({ error: 'Could not generate download link.' });
    }

    signedUrl = signedData.signedUrl;
    console.log('download-guide: signed URL ok');
  } catch (err) {
    console.error('download-guide: signed URL exception:', err.message);
    return res.status(500).json({ error: 'Could not generate download link.' });
  }

  /* ── Block 1B — Fetch PDF from signed URL ───────────────────────────────── */
  let arrayBuffer;
  try {
    const pdfResponse = await fetch(signedUrl);
    console.log('download-guide: PDF fetch status:', pdfResponse.status);

    if (!pdfResponse.ok) {
      const errText = await pdfResponse.text();
      console.error('download-guide: PDF fetch failed:', pdfResponse.status, errText);
      return res.status(500).json({ error: 'Could not retrieve guide. Please try again.' });
    }

    arrayBuffer = await pdfResponse.arrayBuffer();
    console.log('download-guide: PDF bytes received:', arrayBuffer.byteLength);
  } catch (err) {
    console.error('download-guide: PDF fetch exception:', err.message);
    return res.status(500).json({ error: 'Could not retrieve guide. Please try again.' });
  }

  /* ── Stamp watermark with pdf-lib ───────────────────────────────────────── */
  let pdfBytes;
  try {
    const pdfDoc  = await PDFDocument.load(arrayBuffer);
    const font    = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages   = pdfDoc.getPages();
    const purchaseDate  = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const watermarkText = `Licensed to: ${name} | ${email} | ${purchaseDate}`;
    const fontSize      = 11;
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

    const watermarkedBytes = await pdfDoc.save();

    // Apply RC4 encryption — owner-only password, no open prompt
    const encryptedBytes = await encryptPDF(
      new Uint8Array(watermarkedBytes),
      '',
      {
        ownerPassword:   'DetoxProtect2026',
        algorithm:       'RC4',
        allowPrinting:   true,
        allowModifying:  false,
        allowCopying:    false,
        allowAnnotating: false,
      }
    );
    pdfBytes = Buffer.from(encryptedBytes);
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
