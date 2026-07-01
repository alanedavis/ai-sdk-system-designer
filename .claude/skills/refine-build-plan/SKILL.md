---
name: refine-build-plan
description: Turn a brainstorm recording into build plans, end to end, in one skill. Transcribes the audio (diarized), extracts the distinct ideas, drafts the "soul" of each (why it exists, who it's for, whether to monetize, rough cost, features), grills that soul — and its brand identity — with you until the idea is sharp and cohesive, then generates a per-idea build plan. Use when the user wants to refine a recorded idea, process an audio brainstorm, "refine this recording", turn a recording into a build plan, or runs /refine-build-plan.
---

<what-to-do>

This is the whole idea-refiner flow in one skill: **recording → transcribe → extract → draft soul → grill → build plan**. Two engines do the heavy lifting (`npm run refine` and `npm run build-plan`); your job is to run them and to conduct the interactive grill in between.

### 1. Find the audio file

Use the path the user gave. If none, look in `recordings/` and offer the most recent audio file (`.m4a`, `.wav`, `.mp3`, `.flac`, `.ogg`); confirm before proceeding. If `recordings/` is empty, ask where the recording is.

### 2. Refine — transcribe → extract → draft the soul

Run `npm run refine <audio-path>`. This transcribes (diarized), extracts pitches, and writes three fixed-path artifacts: `refine/transcript.txt`, `refine/pitches.json`, and `refine/soul-draft.md`. It needs `ASSEMBLYAI_API_KEY` in `.env`; if the run fails on a missing key, point the user to `.env.example`.

Then **read `refine/soul-draft.md`** and give a short, honest summary of each endorsed idea's soul (purpose · audience · monetization · cost) and how many ideas were extracted vs. skipped. Don't dump the whole file — highlight the soul and the sharpest open questions. Only *endorsed* ideas get a soul (same gate the build uses); if nothing was endorsed, say so plainly rather than inventing enthusiasm.

### 3. Grill — sharpen the soul interactively

Interview the user relentlessly about the draft until you reach shared understanding. Work one idea at a time.

**First, force a cohesive core.** Before the soul dimensions are worth grilling, the idea has to *be one thing* — a direction a brand could stand on, not a pile of features. Make the user say, in one sentence a stranger could repeat, what this is and the single thing that makes it *it*. If the idea is loose, sprawling, or "it does a bit of everything," that is the first thing to grill — don't let it slide to keep the conversation pleasant. See **Force a cohesive core (brand identity)** below.

**Then** work the draft's baked-in order — **identity → purpose → audience → monetization → cost → features** — and attack the open questions listed under each idea. For each question, provide your recommended answer. **Ask one question at a time, waiting for feedback before continuing.** If a question can be answered by exploring the codebase, explore instead. See **During the grill** below for how to sharpen language and update docs.

As decisions harden, write the sharpened version to `refine/soul-final.md` using the same structure as the draft, leading each idea with a crisp **identity line** (what it is, for whom, and the one thing that makes it *it*). This file is what makes the grill count — the build reads it (falling back to the draft if it's absent), so a sharpened identity flows into the requirements, not just a sharpened feature list.

**When the interview converges** — you have no more sharp questions and `refine/soul-final.md` is written:

1. Recap what changed during grilling (the decisions that hardened: a narrowed audience, a dropped feature, a monetization call).
2. Explicitly ask: **"Any remaining questions about the direction or features before we build?"** Wait for the answer. If the user raises something, resolve it and re-check. If they're satisfied, confirm you're about to build, then continue.

### 4. Build — generate the plan

Run `npm run build-plan`. This runs the pipeline — `deriveRequirements` (with the grilled soul folded in as `context`) → `designArchitecture` → `buildCodingPrompt` — over every *endorsed* idea, and writes one Markdown file per accepted build to `builds/`.

Then **report the result**: summarize what was written to `builds/` vs. skipped (mirroring the console `=== BUILD PLAN ===` output), and point the user at the generated files. Each build carries requirements + architecture + a copy-paste-ready coding prompt (DEV); in PROD (`NODE_ENV=production`) just the coding prompt.

</what-to-do>

<supporting-info>

- The flow is one command from a recording: **record → `/refine-build-plan`**. It pauses only for the interactive grill in step 3 — everything else is automated.
- Fixed artifact paths (defined in `src/paths.ts`): `refine/transcript.txt`, `refine/pitches.json`, `refine/soul-draft.md`, and — after grilling — `refine/soul-final.md`. The two engines hand off through these, so there are no arguments to thread between the transcribe/extract half and the build half.
- The soul draft is a *starting point*, not a spec. It's deliberately opinionated so the grill has something concrete to attack.
- "Soul" = the human/business core: the **identity** (the one cohesive thing it is), **why** it exists, **who** it's for, whether/how to **monetize**, rough **cost**, and the **features** that serve the why — plus open questions to grill.
- Direction is two things at once: a sound **architecture** *and* a cohesive **brand identity**. A build plan on a loose, everything-to-everyone idea is a fast way to build the wrong thing — grill the idea into one identity before pointing it at a stack.
- The grilled soul is passed to `deriveRequirements` as `context`, so decisions sharpened during grilling (a narrowed audience, a dropped feature, a monetization call) flow into the requirements rather than the raw pitch alone.
- Only *endorsed* ideas are built; the rest are reported as skipped with their status.

## During the grill

### Domain awareness

While exploring the codebase, look for existing documentation. Most repos have a single context:

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-event-sourced-orders.md
│       └── 0002-postgres-for-write-model.md
└── src/
```

If a `CONTEXT-MAP.md` exists at the root, the repo has multiple contexts and the map points to where each one lives (each with its own `CONTEXT.md` and `docs/adr/`). Create files lazily — only when you have something to write. If no `CONTEXT.md` exists, create one when the first term is resolved. If no `docs/adr/` exists, create it when the first ADR is needed.

### Force a cohesive core (brand identity)

Architecture is only half the direction — the idea also needs a **cohesive identity** a brand could be built on. Point people not just toward a sound stack but toward *one recognizable thing*. Refuse to move past a loose or over-broad idea; grill it into a center of gravity first. Watch for these smells and name them out loud:

- **Kitchen sink** — "it does X *and* Y *and* Z." Ask which one is the spine; the rest are features or later spin-offs, not the identity. Two unrelated cores means two products — make them pick one or split it.
- **No center of gravity** — every answer is "depends who's using it." Force a *primary* audience and a *primary* job. A brand can't point at everyone.
- **Me-too framing** — "like [big app] but…". Make them finish the sentence with the single difference that would make someone switch. If there isn't one, the identity is missing — that's the gap, not the feature set.
- **Adjective soup** — "simple, powerful, fun, enterprise-grade." Make them keep the one adjective the product would die defending; the rest is noise.

Push until you can state a crisp **identity line** — what it is, for whom, and the one thing that makes it *it* — plus a working name or tagline if one emerges. Then cut any feature that doesn't serve that line; scope that fights the identity is what you grill *out*, not preserve. If the user insists the breadth genuinely *is* the point, don't paper over it — say so plainly and record it as a deliberate trade-off (often ADR-worthy), so the build reflects a chosen bet rather than an unresolved blur.

### Challenge against the glossary

When the user uses a term that conflicts with the existing language in `CONTEXT.md`, call it out immediately. "Your glossary defines 'cancellation' as X, but you seem to mean Y — which is it?"

### Sharpen fuzzy language

When the user uses vague or overloaded terms, propose a precise canonical term. "You're saying 'account' — do you mean the Customer or the User? Those are different things."

### Discuss concrete scenarios

When domain relationships are being discussed, stress-test them with specific scenarios that probe edge cases and force the user to be precise about the boundaries between concepts.

### Cross-reference with code

When the user states how something works, check whether the code agrees. If you find a contradiction, surface it: "Your code cancels entire Orders, but you just said partial cancellation is possible — which is right?"

### Update CONTEXT.md inline

When a term is resolved, update `CONTEXT.md` right there — don't batch these up. Use the format in [CONTEXT-FORMAT.md](./CONTEXT-FORMAT.md). `CONTEXT.md` is a glossary and nothing else — totally devoid of implementation details; not a spec, a scratch pad, or a place for implementation decisions.

### Offer ADRs sparingly

Only offer to create an ADR when all three are true: (1) **hard to reverse**, (2) **surprising without context**, and (3) **the result of a real trade-off**. If any is missing, skip it. Use the format in [ADR-FORMAT.md](./ADR-FORMAT.md).

</supporting-info>
