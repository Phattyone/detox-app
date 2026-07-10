/* ═══════════════════════════════════════════════════════════════════════════
   download-spreadsheet.js  —  Vercel serverless function: personalized xlsx

   Fetches the pre-built template from Supabase Storage (which already has
   the License sheet, protection settings, and {{LICENSE_TEXT}} placeholders),
   then does a raw zip-level find-and-replace on the XML internals so the
   file structure is never parsed or rewritten by a spreadsheet library.

   POST (no body required)
   Authorization: Bearer <jwt>

   Returns the personalized xlsx. Free plan users receive 403.

   -- CONNECT: VERCEL ENV --
   SUPABASE_URL              — project URL (Settings → API)
   SUPABASE_SERVICE_ROLE_KEY — service role secret (Settings → API)

   -- SUPABASE STORAGE SETUP --
   Bucket: downloads (private)
   Path:   spreadsheets/detox-cleanse-source.xlsx
   ═══════════════════════════════════════════════════════════════════════════ */

const { createClient } = require('@supabase/supabase-js');
const JSZip            = require('jszip');

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
    console.error('download-spreadsheet: missing Supabase env vars');
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
    console.error('download-spreadsheet: profile lookup failed:', profileError.message);
    return res.status(500).json({ error: 'Could not verify plan. Please try again.' });
  }

  const plan = profileRow?.plan || 'free';

  /* ── Plan gate ──────────────────────────────────────────────────────────── */
  if (!ALLOWED_PLANS.has(plan)) {
    return res.status(403).json({ error: 'Spreadsheet download requires Premium plan or above.' });
  }

  /* ── Build license text ─────────────────────────────────────────────────── */
  const purchaseDate = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year:  'numeric',
  });
  const licenseText = `Licensed to: ${name} | ${email} | ${purchaseDate}`;

  /* ── Block 1A — Generate signed URL ────────────────────────────────────── */
  let signedUrl;
  try {
    const { data: signedData, error: signError } = await supabase.storage
      .from('downloads')
      .createSignedUrl('spreadsheets/detox-cleanse-source.xlsx', 60);

    if (signError || !signedData?.signedUrl) {
      console.error('download-spreadsheet: signed URL failed:', signError);
      return res.status(500).json({ error: 'Could not generate download link.' });
    }

    signedUrl = signedData.signedUrl;
    console.log('download-spreadsheet: signed URL ok');
  } catch (err) {
    console.error('download-spreadsheet: signed URL exception:', err.message);
    return res.status(500).json({ error: 'Could not generate download link.' });
  }

  /* ── Block 1B — Fetch template from signed URL ──────────────────────────── */
  let arrayBuffer;
  try {
    const xlsxResponse = await fetch(signedUrl);
    console.log('download-spreadsheet: xlsx fetch status:', xlsxResponse.status);

    if (!xlsxResponse.ok) {
      const errText = await xlsxResponse.text();
      console.error('download-spreadsheet: xlsx fetch failed:', xlsxResponse.status, errText);
      return res.status(500).json({ error: 'Could not retrieve spreadsheet. Please try again.' });
    }

    arrayBuffer = await xlsxResponse.arrayBuffer();
    console.log('download-spreadsheet: xlsx bytes received:', arrayBuffer.byteLength);
  } catch (err) {
    console.error('download-spreadsheet: xlsx fetch exception:', err.message);
    return res.status(500).json({ error: 'Could not retrieve spreadsheet. Please try again.' });
  }

  /* ── Personalize via raw zip XML replacement ────────────────────────────── */
  let outputBuffer;
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);

    // XML-escape the license text so it is safe inside XML string values
    const escaped = licenseText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    const placeholder = '{{LICENSE_TEXT}}';

    // Scan every XML/rels file in the zip and replace the placeholder
    const fileNames = Object.keys(zip.files);
    for (const fileName of fileNames) {
      if (!fileName.endsWith('.xml') && !fileName.endsWith('.rels')) continue;
      const content = await zip.files[fileName].async('string');
      if (!content.includes(placeholder)) continue;
      zip.file(fileName, content.split(placeholder).join(escaped));
      console.log(`download-spreadsheet: replaced placeholder in ${fileName}`);
    }

    outputBuffer = await zip.generateAsync({
      type:               'nodebuffer',
      compression:        'DEFLATE',
      compressionOptions: { level: 6 },
    });

    console.log('download-spreadsheet: output buffer size:', outputBuffer.length);
  } catch (err) {
    console.error('download-spreadsheet: zip error:', err.message || err);
    return res.status(500).json({ error: 'Could not process spreadsheet. Please try again.' });
  }

  /* ── Stream personalized xlsx to browser ────────────────────────────────── */
  res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Detox-Cleanse-Tracker.xlsx"');
  res.send(outputBuffer);
};
