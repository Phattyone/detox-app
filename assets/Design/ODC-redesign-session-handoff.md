# Handoff: Visual Redesign Session, Organic Detox & Cleanse

Context for picking this up in the project chat. This session started as a casual inquiry and turned into a full design pass. Nothing has been implemented yet, everything below is proposed and awaiting your approval before any code changes.

---

## What happened this session

1. Reviewed the live site (organicdetoxcleanse.com) via screenshots: Today, Recipes, Tracker, Guide, Shop, and the coach chat widget.
2. Identified the core tension: strong editorial bones (deep green, serif display type, good information architecture) undercut by emoji-as-UI, a fragmented companion/coach identity, header spacing bugs, and inconsistent color usage.
3. Corrected course after you clarified: you like the emoji and playful feel and asked for it originally. The goal is not stripping personality out, it's executing the same fun, engaging tone in custom-drawn assets instead of borrowed clipart and emoji, so it looks intentionally yours rather than templated.
4. Built an interactive HTML mock of the Today page reflecting the new direction (custom icon set, filling water glasses tied to companion growth, refined color use, new benefit pills, polished coach panel).
5. You reviewed it and gave specific approvals and course corrections (below).
6. Built a Sunny character sheet: four growth stages, nine expressions, coach button spec, and a live tap-me demo showing random expression plus speech bubble behavior.
7. Wrote the full design direction document (v1.0), which is the source of truth for implementation. It explicitly preserves every existing element on every page; nothing gets cut, only restyled.
8. Explained the Claude Design vs Claude Code split, and which Anthropic models to use for which phase of work.

---

## Files produced (attach these in the project chat)

1. **ODC-design-direction-v1.md**, the full design doc. This is the one to paste into permanent project instructions once approved.
2. **sunny-character-sheet.html**, interactive reference for Sunny's growth stages, expression library, and coach button spec.
3. **odc-today-mock.html**, the working interactive mock of the redesigned Today page.

Re-upload all three into the project so they persist there.

---

## Decisions locked in (do not re-litigate without new reasoning)

- **Keep the fun.** Playful tone, emoji-adjacent warmth, points, streaks, challenges, all preserved. The fix is craft and consistency, not sterilization.
- **One character, two separate behaviors.** Sunny is both the growing companion and the coach, same face everywhere. Tapping Sunny on the Today page triggers a random expression plus speech bubble and never opens chat. Chat opens only via the "Say Hello" button or the floating coach button.
- **Coach button:** whole flower face edge to edge on gold background, 3px solid white border. Previous leaf icon was too subdued, this replaces it.
- **Keep all 12 individual water glasses.** No merged progress bar. Tapping fills them and drives Sunny's growth stage.
- **Five benefit pills approved:** Feel Lighter, Clearer Skin, Sharper Focus, Deeper Sleep, Less Bloating. The "Lose over 10 lbs" claim and exclamation points are dropped for both tone and FTC exposure reasons.
- **Color discipline approved**, full hex table is in section 2 of the direction doc. Progress bar stays green to green (light to dark), not green to orange.
- **Checklist:** checkmark plus dimming, no strikethrough.
- **No page loses features.** The doc's page-by-page section (7) explicitly lists every current element on Today, Recipes, Tracker, Guide, and Shop, and specifies how each is optimized, not removed. Flagged as important: your instruction was to "not automatically leave out the elements of each page but rather optimize them with redesign as necessary."
- **Book cover and print materials** need to be updated to match the new palette. Digital PDF cover updates alongside the app; print formats (Lulu, KDP, IngramSpark) queue for the next print revision rather than an immediate reprint.
- **No em-dashes or en-dashes anywhere**, including code comments. The doc specifies adding a CI lint check for this.

---

## Open items, still needs your input

1. **Sunny's name.** "Sunny" is a placeholder used throughout the doc and character sheet. Alternatives floated: Bloom, Sol, Petal, Sprout. Needs a final decision before Phase 3 implementation, since the name gets hardcoded into copy and component naming.
2. **Higher-fidelity Sunny artwork.** The character sheet uses hand-coded SVG shapes, good enough to validate the concept and behavior, but not necessarily final art quality. Option: take section 5 of the direction doc into Claude Design, generate 3-4 illustrated style directions, pick one, then have it produce final assets for all four growth stages and nine expressions. This is optional and low-risk since it happens outside your codebase.
3. **Book cover redesign itself hasn't been started**, only the requirement to match the new palette has been noted. Needs its own pass.

---

## Implementation plan when you're ready (from the direction doc, section 10)

Work happens on a `design-refresh` branch in Claude Code, previewed on a Vercel preview URL before anything touches production. Rollback is just deleting the branch.

- **Phase 1**: color tokens, typography, base button/card components, ampersand bug fixes ("Guide &Downloads" and "All Products& Supplies" both need the missing space), em-dash sweep.
- **Phase 2**: replace all emoji across all five pages and nav with the new custom SVG icon family.
- **Phase 3**: build the Sunny component (growth stages, expressions, tap-me behavior, coach button and panel).
- **Phase 4**: page-by-page pass applying section 7's optimizations to Today, Recipes, Tracker, Guide, Shop.
- **Phase 5**: align the digital guide cover to the new palette.

Model guidance (full table in doc section 11): Fable 5 for judgment calls and the Supabase RLS account-bleeding bug, Sonnet 4.6 in Claude Code for the fully-specified Phase 1/2/4 work, Opus 4.8 for the novel Sunny component logic, Haiku 4.5 or Sonnet for mechanical sweeps like the em-dash lint, Claude Design for any art generation.

---

## Recommended first message in the project chat

Something like: "Continuing the visual redesign work from another chat, here's the handoff and the three files. Let's pick up at [open item you want to resolve first, e.g. Sunny's name, or generating better art in Claude Design, or starting Phase 1 in Claude Code]."

That gives the project chat full context without re-deriving any of this from scratch.
