/* ═══════════════════════════════════════════════════════════════════════════
   download-spreadsheet.js  —  Vercel serverless function: personalized xlsx

   Fetches the tracker spreadsheet from Supabase Storage, adds a License
   sheet, watermarks row 1 of every working sheet, applies correct cell
   protection settings, and streams the result to the browser.

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
const ExcelJS          = require('exceljs');

/* Plans that include spreadsheet download access */
const ALLOWED_PLANS = new Set(['basic', 'seasonal', 'premium', 'lifetime']);

/* ── Per-sheet protection config ────────────────────────────────────────── */
const SHEET_CONFIG = {
  'Pre-Cleanse Meal': {
    unlock:       ['A3:G3', 'A6:G6', 'C9', 'C10', 'A26:G26'],
    hideFormulas: ['D9', 'E9', 'D10', 'E10'],
  },
  'Morning Routine': {
    unlock:       ['A3:G3', 'A6:G6', 'C9', 'G9', 'A10:G10', 'A25:G25'],
    hideFormulas: ['D9', 'E9'],
  },
  'Breakfast': {
    unlock:       ['A3:G3', 'A6:G6', 'C9', 'C10', 'C11', 'A12:G12', 'A26:G26'],
    hideFormulas: ['D9', 'E9', 'D10', 'E10', 'D11', 'E11'],
  },
  'Mid-Morning Juice': {
    unlock:       ['A3:G3', 'A6:G6', 'C9', 'C10', 'G10', 'C11', 'A12:G12', 'A26:G26'],
    hideFormulas: ['D9', 'E9', 'D10', 'E10', 'D11', 'E11'],
  },
  'Lunch': {
    unlock:       ['A3:G3', 'A6:G6', 'C9', 'C10', 'C11', 'A12:G12', 'A26:G26'],
    hideFormulas: ['D9', 'E9', 'D10', 'E10', 'D11', 'E11'],
  },
  'Afternoon Snack': {
    unlock:       ['A3:G3', 'A6:G6', 'C9', 'G9', 'C10', 'A11:G11', 'A25:G25'],
    hideFormulas: ['D9', 'E9', 'D10', 'E10'],
  },
  'Dinner': {
    unlock:       ['A3:G3', 'A6:G6', 'C9', 'C10', 'C11', 'A12:G12', 'A26:G26'],
    hideFormulas: ['D9', 'E9', 'D10', 'E10', 'D11', 'E11'],
  },
  'Evening': {
    unlock:       ['A3:G3', 'A6:G6', 'C9', 'A10:G10', 'A26:G26'],
    hideFormulas: ['D9', 'E9'],
  },
};

const WEEKLY_HIDDEN_FORMULAS = [
  'J6','J7','J8','J9','J10','J11','J12','J13',
  'J16','J20','J21','J22','J23','J24','J25','J26','J27',
];

const PROTECTION_OPTIONS = {
  selectLockedCells:   false,
  selectUnlockedCells: false,
  formatCells:         true,
  formatColumns:       true,
  formatRows:          true,
  insertRows:          true,
  insertColumns:       true,
  insertHyperlinks:    true,
  deleteRows:          true,
  deleteColumns:       true,
  sort:                true,
  autoFilter:          true,
  pivotTables:         true,
};

/* ── Helper: unlock a cell range string (e.g. "A3:G3" or "C9") ─────────── */
function unlockRange(ws, rangeStr) {
  const parts = rangeStr.split(':');
  if (parts.length === 1) {
    ws.getCell(parts[0]).protection = { locked: false };
    return;
  }
  const tl = ws.getCell(parts[0]);
  const br = ws.getCell(parts[1]);
  for (let r = tl.row; r <= br.row; r++) {
    for (let c = tl.col; c <= br.col; c++) {
      ws.getCell(r, c).protection = { locked: false };
    }
  }
}

/* ── Helper: mark a formula cell as locked + hidden ─────────────────────── */
function hideFormula(ws, addr) {
  ws.getCell(addr).protection = { locked: true, hidden: true };
}

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
    /* ── Step 2: License variables ────────────────────────────────────────── */
    const purchaseDate = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const licenseText  = `Licensed to: ${name} | ${email} | ${purchaseDate}`;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    /* ── Step 3: Add License sheet as first tab ───────────────────────────── */
    const licenseSheet = workbook.addWorksheet('License', { state: 'visible' });

    // Move License to first position
    const sheets = workbook._worksheets.filter(Boolean);
    const others = sheets.filter(s => s.name !== 'License');
    workbook._worksheets = [undefined, licenseSheet, ...others];
    workbook._worksheets.filter(Boolean).forEach((s, i) => { s.id = i + 1; });

    const merge = (range) => licenseSheet.mergeCells(range);

    merge('A1:H1');
    const r1 = licenseSheet.getCell('A1');
    r1.value     = '7-Day Organic Detox & Cleanse';
    r1.font      = { bold: true, size: 20, color: { argb: 'FF1B4332' } };
    r1.alignment = { horizontal: 'center' };

    merge('A2:H2');
    const r2 = licenseSheet.getCell('A2');
    r2.value     = 'Interactive Spreadsheet';
    r2.font      = { italic: true, size: 13, color: { argb: 'FF666666' } };
    r2.alignment = { horizontal: 'center' };

    // row 3: blank

    merge('A4:H4');
    const r4 = licenseSheet.getCell('A4');
    r4.value     = 'organicdetoxcleanse.com';
    r4.font      = { size: 11, color: { argb: 'FF1B4332' } };
    r4.alignment = { horizontal: 'center' };

    // row 5: blank

    merge('A6:H6');
    const r6 = licenseSheet.getCell('A6');
    r6.value     = 'License & Terms of Use';
    r6.font      = { bold: true, size: 12, color: { argb: 'FF333333' } };
    r6.alignment = { horizontal: 'center' };

    // row 7: blank

    merge('A8:H8');
    const r8 = licenseSheet.getCell('A8');
    r8.value     = licenseText;
    r8.font      = { size: 11, color: { argb: 'FF444444' } };
    r8.alignment = { horizontal: 'center' };

    // row 9: blank

    merge('A10:H10');
    const r10 = licenseSheet.getCell('A10');
    r10.value     = 'This spreadsheet is licensed for personal use only.';
    r10.font      = { size: 10, color: { argb: 'FF666666' } };
    r10.alignment = { horizontal: 'center' };

    merge('A11:H11');
    const r11 = licenseSheet.getCell('A11');
    r11.value     = 'Redistribution, sharing, or resale of this file is strictly prohibited. This file is traceable to the original purchaser.';
    r11.font      = { size: 10, color: { argb: 'FFCC0000' } };
    r11.alignment = { horizontal: 'center', wrapText: true };

    // row 12: blank

    merge('A13:H13');
    const r13 = licenseSheet.getCell('A13');
    r13.value     = 'For support visit organicdetoxcleanse.com';
    r13.font      = { size: 10, italic: true, color: { argb: 'FF666666' } };
    r13.alignment = { horizontal: 'center' };

    licenseSheet.getColumn('A').width = 80;

    /* ── Step 4: Append license text to row 1 of every working sheet ──────── */
    workbook.worksheets.forEach(ws => {
      if (ws.name === 'License' || ws.name === '__DATA__') return;
      const cell = ws.getCell('A1');
      let currentText = '';
      if (typeof cell.value === 'string') {
        currentText = cell.value;
      } else if (cell.value && cell.value.richText) {
        currentText = cell.value.richText.map(r => r.text).join('');
      }
      cell.value     = currentText + '\n' + licenseText;
      cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
      cell.font      = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } };
    });

    /* ── Step 5: Print header on all working sheets ───────────────────────── */
    workbook.worksheets.forEach(ws => {
      if (ws.name === 'License' || ws.name === '__DATA__') return;
      ws.headerFooter = {
        oddHeader: `&C&8${licenseText}`,
      };
    });

    /* ── Step 6: Re-apply protection settings ─────────────────────────────── */

    // Meal and routine sheets
    for (const [sheetName, config] of Object.entries(SHEET_CONFIG)) {
      const ws = workbook.getWorksheet(sheetName);
      if (!ws) continue;

      // Unlock input/dropdown cells
      for (const range of config.unlock) {
        unlockRange(ws, range);
      }
      // Hide formula cells (locked + hidden)
      for (const addr of config.hideFormulas) {
        hideFormula(ws, addr);
      }

      await ws.protect('DetoxProtect2026', PROTECTION_OPTIONS);
    }

    // Shopping List — unlock all cells in columns A-J rows 3 to maxRow
    const shoppingWs = workbook.getWorksheet('Shopping List');
    if (shoppingWs) {
      const maxRow = Math.max(shoppingWs.rowCount, 50);
      for (let r = 3; r <= maxRow; r++) {
        for (let c = 1; c <= 10; c++) { // A=1 through J=10
          shoppingWs.getCell(r, c).protection = { locked: false };
        }
      }
      await shoppingWs.protect('DetoxProtect2026', PROTECTION_OPTIONS);
    }

    // Weekly Tracker
    const trackerWs = workbook.getWorksheet('Weekly Tracker');
    if (trackerWs) {
      const maxRow = Math.max(trackerWs.rowCount, 35);

      // Columns C-I (3-9) rows 6-13
      for (let r = 6; r <= 13; r++) {
        for (let c = 3; c <= 9; c++) {
          trackerWs.getCell(r, c).protection = { locked: false };
        }
      }
      // Column A all rows
      for (let r = 1; r <= maxRow; r++) {
        trackerWs.getCell(r, 1).protection = { locked: false };
      }
      // Column K all rows
      for (let r = 1; r <= maxRow; r++) {
        trackerWs.getCell(r, 11).protection = { locked: false };
      }
      // Hide formula cells
      for (const addr of WEEKLY_HIDDEN_FORMULAS) {
        hideFormula(trackerWs, addr);
      }

      await trackerWs.protect('DetoxProtect2026', PROTECTION_OPTIONS);
    }

    // __DATA__ — veryHidden + basic protection
    const dataWs = workbook.getWorksheet('__DATA__');
    if (dataWs) {
      dataWs.state = 'veryHidden';
      await dataWs.protect('DetoxProtect2026', PROTECTION_OPTIONS);
    }

    /* ── Step 7: Workbook structure protection ────────────────────────────── */
    workbook.views = [{ lockStructure: true }];

    /* ── Step 8: Write buffer ─────────────────────────────────────────────── */
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
