# Organic Detox & Cleanse, Design Direction v1.0

This document is the single source of truth for the visual redesign. Paste it into the Claude Project instructions for organicdetoxcleanse.com so every implementation session inherits it. Nothing in the current app gets removed; every existing element is preserved and optimized per the rules below.

Approved direction: fun, warm, and engaging, executed with consistent custom craft instead of borrowed emoji. Editorial serif headers over deep green, playful custom icons, one illustrated character named Sunny (working name) who is both the growing companion and the coach.

---

## 1. Brand personality

Warm, encouraging, a little playful, never clinical and never childish. The app should feel like a friendly guide who happens to have great taste. Gamification stays (points, streaks, challenges, growth) but every game element is drawn in the brand's own visual language.

---

## 2. Color system

### Tokens

| Token | Hex | Role |
|---|---|---|
| forest | #1B4332 | Primary brand. Headers, primary buttons, plan banner, chat header |
| pine | #0F2E21 | Darkest shade. Bottom nav, button hover states |
| cream | #FAF5EA | App background |
| card | #FFFFFF | Card surfaces |
| ink | #22382E | Primary text |
| ink-soft | #5C7266 | Secondary text, captions |
| sage | #DCEBDD | Soft green fills, icon chips, checklist backgrounds |
| sage-deep | #74A57F | Success, completed states, checkboxes, secondary accents |
| gold | #D9A441 | Achievement and accent. Points, badges, day highlights, coach button, ESSENTIAL tags |
| gold-soft | #F3E3C2 | Gold tint fills, time chips |
| petal | #E9B94D | Sunny's petals, celebratory sparkles |
| terra | #C96F4A | Energy accent. Challenge cards, Sunny's pot, urgent nudges. Use sparingly |
| terra-soft | #F7E4DA | Terra tint fills |
| water | #7FB6C4 | Water fills only |
| water-soft | #DCEEF2 | Water tint fills |

### Usage rules

1. Green owns action. Primary CTAs are forest, hover pine. There is exactly one forest primary button per view section.
2. Gold owns achievement. Points, streaks, unlocks, the coach button, day-complete markers. Gold is never a CTA background for commerce actions.
3. Terra owns energy and appears at most twice per screen. Challenge card and one accent maximum. Retire orange from Shop Now buttons, My Account, ESSENTIAL badges, and the mood selector (see page sections).
4. Progress always runs light green to dark green (sage-deep to forest). Never green to orange.
5. Water blue appears only in hydration UI.
6. Off-palette colors are prohibited. The navy Pre-Cleanse Meal card becomes forest with a gold-soft eyebrow.

### Book cover and print alignment

The digital guide cover and all print formats (Lulu coil, KDP paperback, IngramSpark hardcover) adopt the same tokens: forest field, cream title panel or cream type, gold accent rule or seal, optional Sunny mark on the spine or back. Interior headers use forest and gold on cream. If the current cover uses colors outside this table, update it at the next print revision; digital PDF cover updates immediately with the app redesign so app and guide match at launch.

---

## 3. Typography

| Role | Face | Usage |
|---|---|---|
| Display | Fraunces (weights 500 to 700) | Page titles, card headings, stat numbers, pull quotes. Italic for taglines and thoughts |
| Body and UI | Nunito (weights 600 to 800) | Everything else. Rounded and friendly, matches the texting-familiar feel |
| Labels | Nunito 800, 10 to 11px, letter-spacing .18em, uppercase | Eyebrows and section labels |

Scale: page title clamp(30px, 7vw, 38px); card heading 16 to 19px Fraunces 600; body 13 to 14.5px Nunito 600 to 700; captions 11 to 12.5px.

Rule: Fraunces is seasoning, not the meal. Body copy is never set in the serif.

---

## 4. Iconography

1. No emoji anywhere in UI. Emoji remain acceptable inside user-generated content only (journal entries, chat messages typed by users).
2. One custom SVG family: rounded terminals, 2 to 2.2px strokes at 24px artboard, friendly proportions. Filled two-tone variants (sage chip background plus colored glyph) for meal and feature icons; outline variants for nav and inline icons.
3. Icon chips: 42px rounded square, sage background, glyph in forest, petal, terra, or leaf greens per subject.
4. Every icon in the app comes from this family. If a new screen needs a new glyph, it is drawn to these specs, never pulled from a generic set unmodified.
5. Nav icons: sun (Today), bowl (Recipes), bars with gold dot (Tracker), open book (Guide), basket (Shop). Active state is gold with a 4px dot.

---

## 5. Sunny, the character

Reference: sunny-character-sheet.html (growth stages, expression library, coach button spec, tap-me demo).

### Identity

One character, two jobs. Sunny the companion is the plant users grow all day. Sunny the coach is the same face answering questions in chat. Never introduce a second character.

### Companion behaviors (Today page)

1. Growth is driven by water intake and completed steps: Sprout (0 to 3 glasses), Bud (4 to 7), Bloom (8 to 11), Full Bloom (12 or full-day completion). Resets to sprout each morning. This preserves the existing mechanic exactly.
2. Tap me: tapping Sunny plays a random expression with a speech bubble line. Pool of at least 8 expression-and-line pairs, no immediate repeats, bubble auto-dismisses after about 2.5 seconds. Tapping NEVER opens the chat.
3. Idle sway animation, 4 to 5 second ease loop, disabled under prefers-reduced-motion.
4. Contextual states: thirsty face when water is below pace for the time of day, sleepy on the evening routine card, celebrating on day completion.

### Coach behaviors (chat)

1. Entry points: the Say Hello button and the floating coach button only.
2. Floating button: whole flower face edge to edge on gold, 3px solid white border, 54px (46px compact), shadow 0 6px 18px rgba(15,46,33,.35). Chat header avatar is the same face at 34px with a 2px white border.
3. Greeting is two short sentences maximum, followed by 2 or 3 tappable suggestion chips.
4. Quota line: "N questions left today". No UTC, no reset-time jargon.
5. Disclaimer: "Wellness guidance, not medical advice". Always visible in the chat footer.
6. While generating, show the thinking expression.

### Expression library (implemented as swappable face groups on one SVG)

Happy (default), Delighted, Wink, Star Eyes, Celebrating, Sleepy, Thirsty, Thinking, Surprised. New expressions must reuse the same head, petals, and stroke weights.

### Name

Sunny is the working name. Alternatives to consider later: Bloom, Sol, Petal, Sprout. Whatever is chosen appears identically in companion card, chat header, and copy.

---

## 6. Component rules

1. Cards: white, 16px radius, shadow 0 2px 10px rgba(27,67,50,.08), 18px padding. Section labels are the uppercase Nunito label style with a 14px icon.
2. Buttons: primary is forest pill, white Nunito 800 text; hover pine plus 1px lift. Secondary is white with 1.5px sage-deep border. Terra outline buttons only inside challenge cards.
3. Pills and chips: 999px radius. Benefit pills are gold-outline with 13px icons. Time chips are gold-soft with forest text. Point chips are terra (challenge) or gold (rewards).
4. Benefit pills content: Feel Lighter, Clearer Skin, Sharper Focus, Deeper Sleep, Less Bloating. No exclamation marks, no numeric weight-loss claims.
5. Checklists: 22px rounded checkbox, sage-deep fill when done, row dims to 55% opacity. No strikethrough anywhere.
6. Water tracker: 12 glass SVGs, 8oz each, tap to fill with a spring ease. Count shown as "N / 96 oz". Microcopy links water to Sunny's growth. Always 12 individual glasses, never a merged bar.
7. Day timeline: 46x54px rounded tiles; done is sage-deep with a gold check dot; today is forest with a gold outline ring.
8. Bottom nav: pine floating pill, 22px radius, gold active state.
9. Toasts: forest pill, gold-soft text, drop from top, 2.2 second dwell.
10. Forms and inputs: 1.5px borders (#DCE5DA), sage-deep focus border, 999px radius for single-line inputs, 12px radius for text areas.

---

## 7. Page-by-page optimization

Every element listed exists today and is kept. Changes are visual and copy only unless marked.

### Today

Keep: header, benefit pills, day timeline, progress bar, plan banner, companion card with points, streak, all-time, today's thought, challenge card, water goal, night-before meal card, prep checklist, meal plan accordions, things to avoid, reminders, bottom nav, coach.
Optimize: all emoji to icon family; companion becomes Sunny with tap-me expressions; pills to the five approved; progress bar green to green; pre-cleanse meal card from navy to forest; checklist loses strikethrough; challenge card uses terra pair with white terra-outline complete button; meal accordions get icon chips and gold-soft time chips.

### Recipes & Swaps

Keep: restriction notice bar, meal generator, all 8 meal section cards, swap dropdowns, expand-to-recipe flow.
Optimize: title spacing verified; restriction bar becomes terra-soft with terra icon and text (it is a rule, not an error, so no harsh red); Generate Random Day Plan keeps forest fill and gains a custom two-die glyph from the icon family; each meal section gets its icon chip; "Do NOT Skip This" on Evening Routine becomes a gold "Key step" chip, keeping the emphasis without shouting.

### Tracker (Your Results)

Keep: plan banner, summary stats, day selector, all body metric fields, BMI, body fat, muscle, water, waist, hips, bone, weight-to-BMI helper, progress photos grid, all wellness sliders, the 1 to 10 scales, mood row, every journal prompt, symptoms field.
Optimize: mood selector emojis become five Sunny faces (thirsty/sad through celebrating), which is a signature moment that makes the tracker feel unmistakably yours; sliders styled with sage track and forest thumb, selected value in a gold ring; metric inputs get unit suffixes inside the field; photo grid slots get a camera glyph from the icon family and a gold ring on filled days; journal prompts keep all questions with Fraunces italic prompt headers.

### Guide & Downloads

Keep: hero, plan banner, featured guide card with premium unlock and preview link, all four resource cards (spreadsheet, PDF, shopping list, daily plan reference), locked and unlocked states.
Optimize: fix "Guide &Downloads" to "Guide & Downloads" (bug); featured card gets a proper cover thumbnail rendered from the new cover art instead of a book emoji; locked state uses a gold lock glyph with "Unlock" as a gold-outline button; download buttons are forest primaries with a download glyph; "beautifully designed PDF" copy softens to "the complete program in one place".

### Shop (All Products & Supplies)

Keep: category filter tabs, email capture for the shopping list, cost-expectation notice, one-time equipment section with comparison dropdowns, every product row, ESSENTIAL and OPTIONAL badges, groceries and supplements and delivery sections, external links.
Optimize: fix "All Products& Supplies" to "All Products & Supplies" (bug); Shop Now buttons change from orange to forest primary; ESSENTIAL badges change from orange to gold, OPTIONAL to sage; product rows get icon chips from the family; email capture card stays forest with a gold Send button; "Pick one" tags become gold-soft chips.

### Global

My Account pill: cream outline on forest, not orange. Fix every header ampersand spacing. Audit all copy for em-dashes and en-dashes and replace them (see section 8). Sunny's coach button appears on every page in the same position.

---

## 8. Copy rules

1. No em-dashes and no en-dashes anywhere: UI copy, code comments, commit messages, guide content, marketing pages. Use commas, periods, or restructured sentences. Add a lint check: grep for the two characters in CI and fail the build if found in source.
2. Voice: encouraging friend, plain verbs, sentence case for body, uppercase only for the label style. Contractions welcome.
3. Claims: no specific weight-loss numbers, no "join thousands" until the user base supports it, no disease or cure language. Benefits phrased as feelings and experiences.
4. Buttons say what they do: "Download shopping list", not "Submit".
5. Sunny's lines are short, warm, and occasionally funny. One idea per bubble.
6. Errors explain and direct, never apologize vaguely. Empty states invite the next action.

---

## 9. Motion and accessibility

1. All animation respects prefers-reduced-motion.
2. Motion budget per screen: Sunny's idle sway, one interaction spring (water fill or button lift), one entrance (toast or panel). Nothing else moves.
3. Touch targets 44px minimum. Focus states visible (2px gold outline offset 2px).
4. Contrast: ink on cream and white passes AA; gold text never sits on cream at sizes below 14px bold; white on sage-deep only at 14px bold and up.
5. Sunny always has aria-labels describing state ("Sunny, your companion, currently blooming").

---

## 10. Implementation plan (Claude Code)

Work on a branch (design-refresh), deploy to a Vercel preview URL, compare against production, merge only after approval. Rollback is a branch delete.

Phase 1, foundations: token CSS variables, typography, global button and card and pill components, header ampersand fixes, em-dash sweep plus CI lint.
Phase 2, iconography: build the SVG icon component library, replace all emoji across all five pages and nav.
Phase 3, Sunny: implement the character component with growth stages, expressions, tap-me pool, contextual states; restyle the coach button and chat panel.
Phase 4, page passes: Today, Recipes, Tracker (including Sunny-face mood row), Guide, Shop, per section 7.
Phase 5, print alignment: regenerate the digital guide cover to the token palette; queue print cover updates for the next revision.

Constraint block to include verbatim in every Claude Code prompt:
"Follow the Design Direction v1.0 tokens and rules exactly. No emoji in UI. No em-dashes or en-dashes anywhere including comments. No colors outside the token table. No new fonts. Do not remove existing features or fields; restyle them. All animation respects prefers-reduced-motion."

---

## 11. Model selection guide

Use the strongest model where judgment is expensive and a cheaper model where the spec does the thinking.

| Task | Model | Why |
|---|---|---|
| Design direction, architecture, tradeoff decisions, this document's future revisions | Fable 5 (chat) | Judgment-heavy, low volume, highest leverage |
| Supabase RLS account-bleeding bug | Fable 5 or Opus 4.8 in Claude Code | Security bug with data exposure. Never economize here |
| Sunny component and expression system | Opus 4.8 in Claude Code | Novel interactive component with state logic, worth the stronger model once |
| Phase 1, 2, 4 implementation (tokens, icon swaps, page restyles) | Sonnet 4.6 in Claude Code | Fully specified by this doc; Sonnet executes specs excellently and fast |
| Copy sweeps, em-dash lint, ampersand fixes, alt text | Sonnet 4.6 or Haiku 4.5 | Mechanical, verifiable, high volume |
| Character sheet variations, higher-fidelity Sunny art | Claude Design | Visual generation is its job; feed it the character sheet and section 5 as the brief |
| Guide cover redesign | Fable 5 for the brief, Claude Design for the art | Brief needs judgment, generation does not |

Rules of thumb: if the task is "make a decision", spend Fable 5. If the task is "execute this decision", spend Sonnet. If a mistake would touch user data, money, or security, spend the strongest model available regardless of task size. Your Fable 5 allocation goes furthest when everything it decides is written down (like this doc) so cheaper models can execute without re-deciding.

---

Version 1.0, approved direction as of this session. Amend by editing this file, not by verbal drift in implementation sessions.
