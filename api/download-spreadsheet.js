/* ═══════════════════════════════════════════════════════════════════════════
   download-spreadsheet.js  —  Vercel serverless function: personalized xlsx

   Fetches the tracker spreadsheet from Supabase Storage, adds a License
   sheet as the first sheet and a print header to every other sheet, then
   streams the result to the browser.

   POST (no body required)
   Authorization: Bearer <jwt>

   Returns the personalized xlsx. Free plan users receive 403.

   -- CONNECT: VERCEL ENV --
   SUPABASE_URL              — project URL (Settings → API)
   SUPABASE_SERVICE_ROLE_KEY — service role secret (Settings → API)

   -- SUPABASE STORAGE SETUP --
   Bucket: downloads (private)
   Path:   spreadsheets/detox-cleanse.xlsx
   ═══════════════════════════════════════════════════════════════════════════ */

const { createClient } = require('@supabase/supabase-js');
const ExcelJS          = require('exceljs');

/* Plans that include spreadsheet download access */
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
  const plan  = user.user_metadata?.plan || 'free';

  /* ── Plan gate ──────────────────────────────────────────────────────────── */
  if (!ALLOWED_PLANS.has(plan)) {
    return res.status(403).json({ error: 'Spreadsheet download requires Basic plan or above.' });
  }

  /* ── Block 1A — Generate signed URL ────────────────────────────────────── */
  let signedUrl;
  try {
    const { data: signedData, error: signError } = await supabase.storage
      .from('downloads')
      .createSignedUrl('spreadsheets/detox-cleanse.xlsx', 60);

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

  /* ── Block 1B — Fetch xlsx from signed URL ──────────────────────────────── */
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

  /* ── Personalize with ExcelJS ───────────────────────────────────────────── */
  let buffer;
  try {
    const purchaseDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const licenseText  = `Licensed to: ${name} | ${email} | ${purchaseDate}`;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    /* ── Modification A: License sheet as first sheet ─────────────────────── */
    const licenseSheet = workbook.addWorksheet('License', { state: 'visible' });
    workbook.orderSheet(licenseSheet, 0);

    licenseSheet.mergeCells('A1:H1');
    const titleCell = licenseSheet.getCell('A1');
    titleCell.value     = '7-Day Organic Detox & Cleanse';
    titleCell.font      = { bold: true, size: 16, color: { argb: 'FF1B4332' } };
    titleCell.alignment = { horizontal: 'center' };

    licenseSheet.mergeCells('A2:H2');
    const subCell = licenseSheet.getCell('A2');
    subCell.value     = 'Interactive Progress Tracker';
    subCell.font      = { size: 12, color: { argb: 'FF666666' } };
    subCell.alignment = { horizontal: 'center' };

    licenseSheet.mergeCells('A4:H4');
    const licenseCell = licenseSheet.getCell('A4');
    licenseCell.value     = licenseText;
    licenseCell.font      = { size: 11, color: { argb: 'FF666666' } };
    licenseCell.alignment = { horizontal: 'center' };

    licenseSheet.mergeCells('A6:H6');
    const termsCell = licenseSheet.getCell('A6');
    termsCell.value     = 'This file is licensed for personal use only. Redistribution or sharing is prohibited.';
    termsCell.font      = { size: 10, color: { argb: 'FF999999' }, italic: true };
    termsCell.alignment = { horizontal: 'center', wrapText: true };

    licenseSheet.getColumn('A').width = 80;

    /* ── Modification B: Print header on every non-License sheet ──────────── */
    workbook.worksheets.forEach(sheet => {
      if (sheet.name === 'License') return;
      sheet.headerFooter = {
        oddHeader: `&C&8Licensed to: ${name} | ${email} | ${purchaseDate}`,
      };
    });

    buffer = await workbook.xlsx.writeBuffer();
  } catch (err) {
    console.error('download-spreadsheet: ExcelJS error:', err.message || err);
    return res.status(500).json({ error: 'Could not process spreadsheet. Please try again.' });
  }

  /* ── Stream personalized xlsx to browser ────────────────────────────────── */
  res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="Detox-Cleanse-Tracker.xlsx"');
  res.send(Buffer.from(buffer));
};
