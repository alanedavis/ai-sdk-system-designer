---
name: plan-from-soul
description: Generate a build plan from a grilled soul. Runs the existing requirements → architecture → coding-prompt pipeline over each endorsed idea, folding in the sharpened soul so the build reflects what you grilled out. Use after a /grill-with-docs session, when the user wants to build the plan from the soul, turn the soul into a build plan, or runs /plan-from-soul.
---

<what-to-do>

Turn the grilled soul into per-idea build plans. Concretely:

1. **Check the inputs exist.** The build reads `refine/pitches.json` (from the refine step) and the soul. Prefer the grilled `refine/soul-final.md`; if it's missing, the engine falls back to the un-grilled `refine/soul-draft.md` — in that case, tell the user the soul hasn't been grilled yet and offer to run `/grill-with-docs` first before building. If `refine/pitches.json` is missing, tell them to run `/refine-idea` (or `npm run refine <audio>`) first.

2. **Run the build:** `npm run build-plan`. This runs the existing pipeline — `deriveRequirements` (with the soul folded in as context) → `designArchitecture` → `buildCodingPrompt` — over every *endorsed* idea, and writes one Markdown file per accepted build to `builds/`.

3. **Report the result.** Summarize what was written to `builds/` vs. skipped (mirroring the console `=== BUILD PLAN ===` output), and point the user at the generated files. Each build carries requirements + architecture + a copy-paste-ready coding prompt (DEV); in PROD (`NODE_ENV=production`) just the coding prompt.

</what-to-do>

<supporting-info>

- The whole flow: **record → `/refine-idea` → `/grill-with-docs` → `/plan-from-soul`**.
- This skill is the back half; it deliberately does NOT transcribe or extract — it consumes what `/refine-idea` produced plus the grilled soul.
- The soul is passed to `deriveRequirements` as `context`, so decisions sharpened during grilling (a narrowed audience, a dropped feature, a monetization call) flow into the requirements rather than the raw pitch alone.
- Only *endorsed* ideas are built; the rest are reported as skipped with their status.

</supporting-info>
