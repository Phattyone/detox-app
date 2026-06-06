# Detox & Cleanse Ecosystem Correction Punch List

Generated: 2026-05-29

Scope: cross-source content audit of `data/recipes.js`, `js/auth.js`, `assets/guide/Guide_Draft_v3.docx`, `assets/spreadsheet/Detox_Cleanse_v6.xlsx`, `assets/shopping-list/Shopping_List_UPDATED.docx`, and `assets/cleansing-plan/Daily_Cleansing_Plan_CLEAN.docx`. This is a correction reference only. No source files were modified to produce it.

---

## PRIORITY 1 — CRITICAL (Fix before launch)

### Shopping List Gaps

Ingredients used in `recipes.js` recipes that are missing from one or more shopping lists. "Missing from" notes which lists lack the item. The app shop list is `SHOP_DATA` in `recipes.js`; the spreadsheet list is the `Shopping List` tab in `Detox_Cleanse_v6.xlsx`; the printed list is `Shopping_List_UPDATED.docx` (mirrored in the guide).

| # | Ingredient | Used in (recipes.js) | Missing from | Recommended quantity to add |
|---|------------|----------------------|--------------|------------------------------|
| 1 | **Cayenne pepper** | Lunch Warm Steamed Veggie Salad; all 3 dinners (Steamed, Sauteed, Raw dipping sauce) | App shop list and spreadsheet list (present only in docx) | 1 jar / shaker (lasts multiple cleanses) |
| 2 | **Cauliflower** | Lunch Warm Steamed Veggie Salad ("broccoli or cauliflower"); Dinner cruciferous slot | App shop list and spreadsheet list (present in docx) | 1 to 2 heads |
| 3 | **Fresh ginger** | Apple Carrot Ginger Juice; Citrus Beet Juice | Printed docx shopping list (present in app + spreadsheet) | 1 piece, 3 to 4 inch |
| 4 | **Collard greens / Swiss chard** | Lunch Dark Leafy Green swap (Collard Ribbons, Chard); Dinner Dark Leafy Green swap (Collard Greens, Chard) | App shop list and spreadsheet list (docx covers as "Kale, Chard & Collards") | 2 to 3 bunches (or combine into a "Kale, Chard & Collards 3 to 4 bunches" line) |
| 5 | **Vegetable broth** | Dinner ("Warm vegetable broth is a fully acceptable substitute"); Evening / juice-pulp tip | App shop list and spreadsheet list (present in docx) | 1 container, low-sodium or sodium-free |
| 6 | **Fennel stalks** | Afternoon Snack Crunchy Vegetable swap | All three lists (no list anywhere) | 1 bulb with stalks/fronds |
| 7 | **Cilantro / Mint** | Mid-Morning Juice Herb swaps (spreadsheet `__DATA__` slot: Parsley / Cilantro / Fresh Mint) | All three lists (no list anywhere). Note: these swap slots exist in the spreadsheet but NOT in `recipes.js`, see P1 cross-reference below | 1 bunch each |
| 8 | **Sea salt and black pepper** | Pre-Cleanse Meal (salmon, asparagus, black rice) | App shop list and spreadsheet list (present in docx) | 1 small container each, pre-cleanse only |

Cross-reference for #7: the spreadsheet offers Root Vegetable (Carrot/Beet) and Juice Herb (Parsley/Cilantro/Fresh Mint) swap slots on the Mid-Morning Juice tab, and a Green Smoothie Base swap (Kale/Spinach/Beet Greens/Chard) on the Breakfast tab. `recipes.js` has none of these swap slots. Either add the slots to the app or remove them from the spreadsheet so the two systems offer the same options. Whichever way it is reconciled, the herb/produce above must appear on the shopping list if the swaps stay.

### Orphan Shopping List Items (on list, no recipe uses them)

| # | Item | Listed in | Issue |
|---|------|-----------|-------|
| 9 | **High Lignin Flax Seed Oil** | `Shopping_List_UPDATED.docx` ("for dressings") | No recipe uses flax oil. Every dressing uses extra virgin olive oil; flax is consumed as ground flax seed. Remove, or add a recipe that uses it. |
| 10 | **Yellow Onion** | `Shopping_List_UPDATED.docx` | Every recipe that uses onion specifies red onion (lunch salads, raw plate). Remove yellow onion, or change a recipe to call for it. |

### Almond Serving Size Contradiction

- Recipes say: **12 to 15 almonds** (`recipes.js` snack section; spreadsheet Afternoon Snack tab; guide pre-cleanse prep instructions).
- Food Reference says: **20 to 25 almonds** ("approximately one ounce or twenty to twenty-five almonds is the standard serving").
- The protein claim ("approximately six grams per one-ounce serving" and "primary protein source during the cleanse") only holds at the 1 oz / 20 to 25 count. At 12 to 15 almonds the serving is roughly half an ounce and about 3 g protein.
- Recommendation: **standardize to 20 to 25 almonds (1 oz)** to support the protein claim.
- Files to update: `data/recipes.js` snack section (slot instruction + steps + tips), guide Food Reference chapter (already 20 to 25, leave as anchor), spreadsheet Afternoon Snack row, `Daily_Cleansing_Plan_CLEAN.docx` snack entry.

### Breakfast Option Count

- App and spreadsheet: **3 breakfast recipes** (Berry Prune Smoothie Bowl, Tropical Fruit Salad with Prune Sauce, Green Citrus Smoothie).
- Guide condensed sample plan (Ch. 5): **2 options** (smoothie bowl or fruit salad).
- `Daily_Cleansing_Plan_CLEAN.docx`: **2 options** (Fresh Fruit Salad or Homemade Fruit Smoothie), missing the Smoothie Bowl entirely. (Note: the guide's full-plan insert lists 3 but names the third "Homemade Fruit Smoothie" rather than "Green Citrus Smoothie.")
- Recommendation: standardize to the **3 named recipes** used by the app and spreadsheet, with identical names everywhere.
- Files to update: Guide Ch. 5 condensed plan, guide full-plan insert (rename third option), `Daily_Cleansing_Plan_CLEAN.docx`.

---

## PRIORITY 2 — HIGH (Fix before marketing launch)

### Water Goal Standardization

Conflicting statements of the same one-gallon target:

- Guide "How to Use": "approximately one gallon per day. That's nearly **eleven 12-oz glasses**." (132 oz)
- Guide Ch. 5: "**Eight checkboxes**, each representing a large glass. Fill them all." (implies 8)
- `Daily_Cleansing_Plan_CLEAN.docx` water tracker row: **seven** checkboxes (☐1 to ☐7) plus a "~8+ glasses" note.
- Spreadsheet Weekly Tracker: "Goal: 1 Gallon Per Day (**8+ large glasses**)."

A "glass" is treated as 12 oz in one place and 16 oz in another, and the printed tracker shows 7 boxes.

- Recommendation: **standardize to 12 glasses at 8 oz each = 96 oz total** to match the app tracker, and make the checkbox count match (12 boxes).
- Files and locations to update:
  - Guide "How to Use This Guide" section (the "eleven 12-oz glasses" sentence).
  - Guide Ch. 5 ("Eight checkboxes" sentence).
  - `Daily_Cleansing_Plan_CLEAN.docx` Daily Water Tracker table (checkbox count + "~8+ glasses" note).
  - `Detox_Cleanse_v6.xlsx` Weekly Tracker "Daily Water Tracker" header and any glass-count note.
  - `recipes.js` / app tracker copy if the goal is referenced in UI strings.

### Progress Tracker Metric Mismatch

- Spreadsheet Weekly Tracker body metrics: Weight, BMI, Body Fat %, Muscle %, **Bone %**, Water %, Waist (no Hips).
- Guide tracking table: Weight, Waist, **Hips**, Body Fat %, Muscle %, Water %, BMI (no Bone %).
- The guide's own Ch. 7 prose discusses bone percentage, then omits it from its table.
- Recommendation: **add both Bone % and Hips to all tracker tables** so no metric is lost, and keep the metric rows in the same order across sources.
- Files to update: `assets/guide/Guide_Draft_v3.docx` (tracking table), `Detox_Cleanse_v6.xlsx` Weekly Tracker, and the app tracker in the codebase if it renders a fixed metric set.

### Weight Loss Claim Ranges

Three different ranges appear in the guide:

- Author's note: "I lost between **twelve and twenty pounds** each time."
- Day-by-day (Day 7): "the scale is typically down between **seven and fifteen pounds**."
- Sustaining chapter: "the **ten-plus pounds** you lose in a week."

- Recommendation: pick one honest, defensible range and use it throughout. Suggested: **"approximately 7 to 15 pounds for most people, with some experiencing more"** (the most conservative phrasing already in the guide), and reframe the author's personal 12 to 20 as a personal anecdote rather than a typical-result claim.
- Files to update: `assets/guide/Guide_Draft_v3.docx` (author note, day-by-day Day 7, sustaining chapter, and any marketing copy that quotes a number).

### Mid-Morning Naming

The same eating occasion is labeled inconsistently:

- App (`recipes.js`) and spreadsheet tab: **"Mid-Morning Juice."**
- `Daily_Cleansing_Plan_CLEAN.docx` table header: **"Mid-Morning Snack."**
- Guide Ch. 5: **"the mid-morning snack and juice."**

- Recommendation: **standardize to "Mid-Morning Juice"** to match the app and spreadsheet.
- Files to update: `Daily_Cleansing_Plan_CLEAN.docx` (🥤 section header), `assets/guide/Guide_Draft_v3.docx` (Ch. 5 enumeration and any other reference).

---

## PRIORITY 3 — MODERATE (Fix at next guide revision)

### Recipe Name Variations (app vs spreadsheet)

| App (`recipes.js`) | Spreadsheet | Recommended (more descriptive) |
|--------------------|-------------|--------------------------------|
| Steamed Kale and Squash Bowl | Steamed Kale and Butternut Squash Bowl | **Steamed Kale and Butternut Squash Bowl** |
| Sauteed Collards and Broccoli | Sauteed Collards and Broccoli with Garlic | **Sauteed Collards and Broccoli with Garlic** |
| Celery and Almonds with Tea | Celery and Almonds with Herbal Tea | **Celery and Almonds with Herbal Tea** |

- Recommendation: adopt the more descriptive spreadsheet version in all sources (update `recipes.js` titles to match).

### Equipment List Divergence

- App and spreadsheet one-time equipment include: box grater, 12-inch stainless skillet, portable kitchen scale, portable cooler.
- `Shopping_List_UPDATED.docx` equipment list includes: good chef's knife + cutting board, food prep containers, smartphone, camera, and omits the portable cooler that the guide chapter recommends.
- Recommendation: reconcile to **one master equipment list** used by all three (app, spreadsheet, printed list), including the cooler, grater, skillet, kitchen scale, knife/board, and prep containers.
- Files to update: `data/recipes.js` (`SHOP_DATA` onetime), `Detox_Cleanse_v6.xlsx` Shopping List Section 1, `Shopping_List_UPDATED.docx` Equipment & Supplies table.

### Other Wording Issues

- Guide Ch. 9 calls Citrus Beet juice "the best thing you've ever put in a **blender**." It is made in a **juicer**. Correct to juicer.
- Exercise caution window: `recipes.js` morning note says avoid intense training "the first **3 days**"; guide Ch. 3 says "the first **three to four days**." Pick one (recommend "first 3 to 4 days").
- Guide Ch. 5 says the day has "**six eating occasions**" then lists **seven** (morning routine, breakfast, mid-morning juice, lunch, afternoon snack, dinner, evening routine). Correct the count to seven, or collapse the enumeration to genuinely six.

---

## PRIORITY 4 — MINOR (Fix when convenient)

- "Apple Carrot Ginger" (app) vs "Apple Carrot Ginger Juice" (spreadsheet) — align suffix.
- "Afternoon Snack" (app/spreadsheet) vs "Mid-Afternoon Snack" (`Daily_Cleansing_Plan_CLEAN.docx` 🍎 header) — align label.
- Frozen berries quantity: "Frozen Berries (2 bags)" (docx) vs "Organic Frozen Mixed Berries (2 lb)" (app) vs "Organic Frozen Berries (2 lb)" (spreadsheet) — align unit and wording.
- Garlic quantity: "Garlic (1 head)" (app/spreadsheet) vs "Garlic (1 to 2 heads)" (docx) — align quantity.
- Lemons quantity: "bag of 6 to 8" (app/spreadsheet) vs "Lemons (3 to 6)" (docx); Limes "6 to 8" vs "2 to 4" — align quantities.
- Smart scale metric order differs between docx ("Weight, BMI, Body Fat %, Muscle %, Bone %, Water %") and app ("weight, BMI, body fat %, muscle %, water %, bone %") — align order.
- Avoid-list capitalization differs between `Daily_Cleansing_Plan_CLEAN.docx` (lowercase "causes…") and the guide's embedded copy (capitalized "Causes…") — align casing.
- Psyllium absorbency: guide Food Reference says "up to **fifty times** its own weight"; guide Ch. 1 says "**many times** its own weight" — align the figure.
- Free plan card markets "Night-before checklist" without qualification, but `ACCESS.free` grants only `checklist-2` (first 2 of 6 items). Consider labeling the free benefit "Night-before checklist (2 items)" to match the account screen.
- Snack tea naming: "detox tea" vs "herbal tea" vs "detox herbal tea" used interchangeably across plan, app, and guide — pick consistent terminology.

---

## AFFILIATE TAG REMINDER

`AFFILIATE_TAG` is still the placeholder `"YOUR_TAG-20"`. While it stays as the placeholder, the `amazonUrl()` helper returns every link untagged, so all 71+ Amazon links are not earning commission. Update before launch.

Location note: the audit found `AFFILIATE_TAG` defined at the top of **`data/recipes.js`** (not `js/auth.js`). Update it there. Confirm the live tag format is `yourtag-20`.

---

## FILES REQUIRING UPDATES

Master list of files and the priority items affecting each.

**`js/auth.js`**
- AFFILIATE TAG REMINDER (location correction only — the tag itself lives in `data/recipes.js`).
- (No P1 to P4 content items. The three earlier bundle/tester/seasonal fixes are already applied.)

**`data/recipes.js`**
- P1: Shopping List Gaps #1 to #8 (add to `SHOP_DATA`), Orphans #9 to #10 (remove or justify).
- P1: Almond Serving Size (snack slot, steps, tips).
- P1: Breakfast / juice / smoothie swap-slot parity with spreadsheet (cross-reference #7).
- P2: Water Goal (any UI copy), Mid-Morning Naming (labels already "Mid-Morning Juice", confirm).
- P3: Recipe Name Variations (update three titles), Equipment List Divergence (`SHOP_DATA` onetime).
- P3: Exercise caution window ("first 3 days").
- P4: minor quantity/label alignments, AFFILIATE_TAG.

**`assets/guide/Guide_Draft_v3.docx`**
- P1: Breakfast Option Count (Ch. 5 condensed plan + full-plan insert).
- P1: Almond Serving Size (Food Reference is the anchor; verify consistency).
- P2: Water Goal (How to Use + Ch. 5), Progress Tracker Metric Mismatch (tracking table), Weight Loss Claim Ranges (author note, Day 7, sustaining), Mid-Morning Naming (Ch. 5).
- P3: Citrus Beet "blender" to "juicer", exercise window, "six eating occasions" count.
- P4: psyllium absorbency figure, avoid-list capitalization, smart scale metric order.

**`assets/spreadsheet/Detox_Cleanse_v6.xlsx`**
- P1: Shopping List Gaps (Shopping List tab — add cayenne, cauliflower, broth, collards/chard, fennel, sea salt/pepper), swap-slot parity (Breakfast Green Smoothie Base; Juice Root Vegetable + Juice Herb), Almond Serving Size (Afternoon Snack row).
- P2: Water Goal (Weekly Tracker), Progress Tracker Metric Mismatch (add Hips; keep Bone %), Mid-Morning Naming (confirm tab label).
- P3: Recipe Name Variations (confirm descriptive names are the standard), Equipment List Divergence (Section 1).
- P4: minor quantity/label alignments.

**`assets/shopping-list/Shopping_List_UPDATED.docx`**
- P1: add ginger; remove or justify orphans #9 (flax seed oil) and #10 (yellow onion); align grouped greens line; add sea salt/pepper note consistency.
- P3: Equipment List Divergence (add cooler, grater, skillet, kitchen scale; reconcile knife/containers/smartphone/camera).
- P4: minor quantity/label alignments (frozen berries, garlic, lemons/limes, smart scale order).

**`assets/cleansing-plan/Daily_Cleansing_Plan_CLEAN.docx`**
- P1: Breakfast Option Count (add the Smoothie Bowl as a third option), Almond Serving Size (snack entry).
- P2: Water Goal (Daily Water Tracker table), Mid-Morning Naming (🥤 header).
- P4: "Mid-Afternoon Snack" label, avoid-list capitalization.

---

End of punch list.
