# AI SDK System Designer

An **idea refiner**. Record a brainstorm on a single mic — with your partner, a friend, anyone — talk for as long as you want, then let the pipeline transcribe it, pull out the distinct ideas, **find the soul of each one** (why it exists, who it's for, whether to monetize, what it costs, what it does), grill that soul with you until it's sharp, and only then turn it into a concrete build plan.

Built on the [Vercel AI SDK](https://sdk.vercel.ai) with Anthropic's Claude models, using structured (schema-constrained) output so every result is typed end to end. Speech-to-text is the one exception — Anthropic has no STT model, so Step 0 brings its own diarization-capable provider ([AssemblyAI](https://www.assemblyai.com)).

---

## The idea-refiner flow

The headline flow goes **recording → soul → build plan**, in four moves:

```
  🎙  record on one mic            recordings/brainstorm.m4a
        │
   /refine-idea   (npm run refine) ── transcribe (diarized) → extract ideas → draft the soul
        │                              writes → refine/transcript.txt · pitches.json · soul-draft.md
        ▼
  /grill-with-docs  ──────────────── interrogate the draft one idea at a time until the soul is sharp
        │                              you write → refine/soul-final.md
        ▼
  /plan-from-soul  (npm run build-plan) ── requirements → architecture → coding prompt, per idea
        │                              writes → builds/<idea>.md
        ▼
  📦  one build plan per endorsed idea
```

**"Soul"** = the human/business core the feature list alone never captures: the **why** (the problem it kills), the **who** (who it's for, and who it's *not*), whether and how to **monetize**, a rough **cost**, the **features** that serve the why, and the **open questions** worth grilling. It's auto-drafted, then sharpened by you in a `/grill-with-docs` session — the draft carries baked-in instructions so the grill knows exactly what to attack.

The three CLI steps hand off through files at **fixed paths** under `refine/` (defined in [`src/paths.ts`](src/paths.ts)), so each skill always knows where to read and write — no arguments to thread between runtimes.

> You can also skip the recording and run the **original transcript-first pipeline** directly (`npm start`) — see [What the extraction does](#what-the-extraction-does) below.

---

## What the extraction does

Given a transcript — either produced by Step 0 or dropped in as text like `transcripts/demo-1.txt` (**Zoom AI Companion** format: a header block followed by `Speaker  HH:MM:SS` timestamped turns) — the pipeline identifies each distinct project idea discussed and extracts it in one of two levels of detail:

- **Minimal** — just the pitch `name` and a one–two sentence `summary`. A fast sanity pass.
- **Full** — everything in minimal, plus:
  - **status** — where the group landed: `endorsed` · `rejected` · `parked` · `discussed` · `proposed`. Inferred from how people reacted, not just what they said outright (e.g. sarcasm or a low-energy subject change reads as a *rejection*, not a *park*).
  - **confidence** — `clear` or `tentative`, based on how firmly the pitch was put forward.
  - **points** — the distinct things raised, each typed as `feature` · `constraint` · `question` · `tangent`.
  - **sourceQuotes** — the verbatim line(s) that justify the status call.

Everything past extraction runs on **endorsed pitches only**.

---

## Project layout

```
.
├── src/
│   ├── refine.ts              # CLI — record → soul draft   (npm run refine <audio>)
│   ├── build.ts               # CLI — grilled soul → builds (npm run build-plan)
│   ├── main.ts                # CLI — transcript → builds   (npm start), the original flow
│   ├── plan.ts                # Shared build pipeline + Markdown export (used by main.ts & build.ts)
│   ├── paths.ts               # Fixed artifact paths for the refine → grill → build handoff
│   └── pipeline/
│       ├── transcribe.ts      # Step 0   — transcribeAudio()      (AssemblyAI, diarized)
│       ├── extract.ts         # Step 1   — extractPitches()
│       ├── soul.ts            # Step 1.5 — deriveSoul()
│       ├── requirements.ts    # Step 2   — deriveRequirements()
│       ├── design.ts          # Step 3   — designArchitecture()
│       ├── codingPrompt.ts    # Step 4   — buildCodingPrompt()
│       └── shared.ts          # Model IDs + Zod schemas (pitch / soul / requirements / architecture)
├── .claude/skills/
│   ├── refine-idea/           # Skill — drives the record → soul-draft half
│   └── plan-from-soul/        # Skill — drives the soul → build half
├── transcripts/
│   └── demo-1.txt             # Sample brainstorm transcript (Zoom AI Companion format)
├── recordings/                # Your raw audio (gitignored) — drop recordings here
├── refine/                    # Generated — transcript · pitches.json · soul-draft/final.md (gitignored)
├── builds/                    # Generated — one Markdown file per accepted build (gitignored)
├── demo-builds/               # Committed sample run of demo-1.txt (DEV mode)
├── package.json
├── tsconfig.json
└── README.md
```

---

## Getting started

### 1. Prerequisites

- **Node.js 18+** (developed on Node 23). No global TypeScript needed — `tsx` runs the `.ts` files directly.

### 2. Install

```bash
npm install
```

### 3. Configure your API key

Copy the example env file and drop in your key:

```bash
cp .env.example .env
```

```
ANTHROPIC_API_KEY=sk-ant-...
ASSEMBLYAI_API_KEY=...          # only needed for `npm run refine` (Step 0 transcription)
```

`.env` is gitignored and loaded automatically at startup via Node's native `--env-file` (wired into the npm scripts) — no `dotenv` dependency required. The `ASSEMBLYAI_API_KEY` ([get one here](https://www.assemblyai.com/dashboard/api-keys)) is only consulted by Step 0; the transcript-first flow (`npm start`) needs just the Anthropic key.

### 4. Run

**The idea-refiner flow** (recording → build plan):

```bash
npm run refine recordings/brainstorm.m4a   # Step 0–1.5: transcribe → extract → draft the soul
#   … then run /grill-with-docs to sharpen the soul into refine/soul-final.md …
npm run build-plan                          # Step 2–4: soul → requirements · architecture · coding prompt
```

In Claude Code, the two skills wrap those commands and manage the handoff: **`/refine-idea`** → **`/grill-with-docs`** → **`/plan-from-soul`**.

**The transcript-first flow** (skip the recording):

```bash
npm start          # read transcripts/demo-1.txt → builds/
npm run dev        # watch mode — re-runs on file changes
npm run typecheck  # tsc --noEmit, no run
```

Both flows write one Markdown file per accepted build to `builds/` and print a short build-plan summary (what was written vs. skipped). In DEV each file carries the full chain (requirements · architecture · coding prompt); in PROD (`NODE_ENV=production`) it carries just the coding prompt.

---

## DEV vs PROD output

The detailed render adapts to `NODE_ENV`:

- **DEV** (default) — every pitch is shown in full, including rejected ones.
- **PROD** (`NODE_ENV=production`) — rejected pitches are collapsed to a single header line and sunk to the bottom, so the signal (what the group actually wants) stays up top:

  ```
  Product Ethics Scanner  [rejected · clear]
  ```

```bash
NODE_ENV=production npm start
```

---

## Pipeline functions

The pipeline runs as a chain of stages, each a single function in `src/pipeline/` (with its
schema + `.describe()` annotations in `shared.ts`). Everything past extraction runs on
**endorsed pitches only** — `rejected`, `parked`, `discussed`, and `proposed` pitches are
reported as excluded, never fed forward. Each function is explained below alongside
**representative** output from `demo-1.txt` — the wording varies run to run since it's
model-generated, but the shape and the status calls are stable.

### `transcribeAudio`

**Step 0.** Audio file → a speaker-attributed transcript in the same `Speaker  HH:MM:SS` shape
`extractPitches` consumes, so a raw recording goes end-to-end without a manual export step.
Returns a `string`. _(AssemblyAI — not Claude)_

```ts
import { transcribeAudio } from './pipeline/transcribe';

const transcript = await transcribeAudio('recordings/brainstorm.m4a');
const pitches = await extractPitches(transcript, { mode: 'full' });
```

| Option             | Type      | Default        | Description                                                                 |
| ------------------ | --------- | -------------- | --------------------------------------------------------------------------- |
| `model`            | `string`  | `'best'`       | AssemblyAI speech model (`best` · `nano` · `slam-1` · `universal`).         |
| `diarize`          | `boolean` | `true`         | Attribute each turn to a speaker (`Speaker A` / `Speaker B` …).             |
| `speakersExpected` | `number`  | _(auto)_       | Optional hint for how many distinct speakers to expect.                     |
| `language`         | `string`  | _(autodetect)_ | Optional ISO-639-1 language hint.                                           |

> **Why not the AI SDK here?** Anthropic has no speech-to-text model, and — as of
> `@ai-sdk/assemblyai` 3.0.2 — the AI SDK's `experimental_transcribe` normalizes results to
> word-level `segments` and **drops AssemblyAI's diarized `utterances`**, so speaker labels
> can't survive that path. To keep "who spoke," Step 0 calls AssemblyAI's own SDK directly and
> reads `utterances`, folding `{ speaker, text, start }` into the line format Step 1 expects.
> Speaker labels arrive as generic `Speaker A` / `Speaker B`; mapping them to real names stays
> out of scope — `extractPitches` doesn't rely on speaker turns.

### `extractPitches`

**Step 1.** Transcript → typed pitches. Overloaded so the return type follows the `mode` you
pass — `Pitch[]` for minimal, `DetailedPitch[]` for full. _(Sonnet)_

```ts
import { extractPitches } from './pipeline/extract';

// Minimal — returns Pitch[]
const pitches = await extractPitches(transcript);

// Full — returns DetailedPitch[]
const detailed = await extractPitches(transcript, { mode: 'full' });
```

| Option         | Type                  | Default     | Description                                                                                                                                   |
| -------------- | --------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`         | `'minimal' \| 'full'` | `'minimal'` | Level of detail to extract.                                                                                                                    |
| `model`        | `string`              | `SONNET`    | Anthropic model ID (see `shared.ts`: `SONNET`, `OPUS`, `HAIKU`).                                                                               |
| `keepRejected` | `boolean`             | `false`     | When `false`, pitches with `status: 'rejected'` are dropped from the result. Only meaningful in `full` mode (minimal pitches have no status). |

> **Note:** `keepRejected` controls *inclusion* at the data layer; the DEV/PROD distinction controls *verbosity* at the render layer. The demo's detailed pass passes `keepRejected: true` so rejected pitches survive extraction and can be rendered at the bottom.

**Minimal** (`extractPitches(transcript)`) — name + summary for every pitch:

```
=== MINIMAL ===
• Reading Buddy — A kids' app that listens to a child read aloud and gently helps when they get stuck, tracking finished books on a shelf that fills up.
• On-Demand Dog Walking — A nearby vetted walker grabs your dog's walk, with a live GPS breadcrumb trail of the route and photos at the end.
• Product Ethics Scanner — Point your phone at any product to see recalls, where it's made, and whether the company behind it is sketchy.
• Music Finder — Search songs by precise musical attributes (e.g. F minor at 92 BPM), aimed at DJs and producers building sets that flow.
```

**Detailed — DEV** (`extractPitches(transcript, { mode: 'full', keepRejected: true })`) —
full block per pitch; rejected ones sink to the bottom but keep their detail:

```
=== DETAILED ===

Reading Buddy  [endorsed · clear]
  An app that listens to a kid read aloud and offers gentle hints when they stumble, with a shelf that fills up as books are finished.
  - (feature) A friendly character follows along and gives a hint when the child gets stuck.
  - (constraint) The listening has to run on-device — it can't depend on the network.
  - (constraint) COPPA: kids' voice data can never leave the device.
    "I'm into this one. This one feels real."
    "Same. I'd build this."

On-Demand Dog Walking  [endorsed · clear]
  On-demand walking where a nearby walker grabs the job, with a live GPS trail of the route and photos at the end.
  - (feature) Live GPS breadcrumb trail plus same-walker-every-time as the wedge over clunky incumbents.
  - (constraint) Insurance baked in and vetted walkers — core to the product, not a nice-to-have.
  - (question) Who's liable if the dog gets loose during a walk?
    "if you nail the trust piece, you win the category. I'm in. Let's keep this one."

Music Finder  [parked · tentative]
  A finder for songs by specific musical attributes like key and BPM, for DJs and producers building cohesive playlists.
  - (feature) Query songs by precise attributes, e.g. "songs in F minor at 92 BPM."
  - (question) Is the market real beyond a few thousand bedroom producers?
    "Let's not kill it, but let's not start it either. Park it, circle back once we've actually shipped something?"

Product Ethics Scanner  [rejected · clear]
  Point your phone at any product to surface recalls, origin, and whether the company behind it is ethically sketchy.
  - (feature) Scan any product — not just food — for curated ethics and recall info.
  - (question) How is it meaningfully different from Google Lens?
    "Doesn't Google Lens kind of already do that?"
    "Sure, sure. No, it could be cool. (pause) What was the other one you had?"
```

**Detailed — PROD** (`NODE_ENV=production npm start`) — identical until the bottom, where
the rejected pitch collapses to a single header line:

```
...
Music Finder  [parked · tentative]
  A finder for songs by specific musical attributes like key and BPM, for DJs and producers building cohesive playlists.
  - (feature) Query songs by precise attributes, e.g. "songs in F minor at 92 BPM."
  - (question) Is the market real beyond a few thousand bedroom producers?
    "Let's not kill it, but let's not start it either. Park it, circle back once we've actually shipped something?"

Product Ethics Scanner  [rejected · clear]
```

> With the default `keepRejected: false`, the Product Ethics Scanner would be dropped
> entirely rather than shown at the bottom.

### `deriveSoul`

**Step 1.5.** Takes one **endorsed** pitch and drafts its **soul** — the human and business
core beneath the feature list. This is the auto-drafted starting point a `/grill-with-docs`
session then interrogates. Returns `Soul`
(`{ purpose, audience, monetization, cost, features, openQuestions }`). Deliberately
opinionated, not diplomatic — a hedged draft is a failed draft. _(Opus — the reasoning-heavy
stage, like `designArchitecture`)_

```ts
import { deriveSoul } from './pipeline/soul';

// pitch is a DetailedPitch with status: 'endorsed'
const soul = await deriveSoul(pitch);
```

| Option  | Type     | Default | Description                                                      |
| ------- | -------- | ------- | ---------------------------------------------------------------- |
| `model` | `string` | `OPUS`  | Anthropic model ID (see `shared.ts`: `SONNET`, `OPUS`, `HAIKU`). |

Representative output for **Reading Buddy** (abridged):

```
purpose      — Kills the dead-air moment when a struggling early reader stalls on a word and
               feels stupid. A patient, non-judgmental listener when no adult is free to sit
               with 25 kids one-on-one.
audience      — A 5–8 year old below-grade reader; bought by a K–2 teacher/reading specialist
               or a parent. NOT for fluent readers (that's a library app) or pre-readers.
monetization  — willMonetize: true · per-classroom/school site license (parents secondary).
               Deliberately not ad-supported — ads on a COPPA-exposed kids' product are a
               legal and trust nightmare.
cost          — Run cost is unusually LOW: on-device processing → near-zero per-use inference,
               no STT-per-minute bill (the offline/COPPA constraint is a margin gift). The
               cost sink is child-voice ASR accuracy R&D + book licensing.
features      — On-device miscue detection · tiered hints (sound-it-out → partial → word) ·
               fully offline · a bookshelf that fills up · leveled library · a teacher view.
openQuestions — Can on-device ASR actually hit usable accuracy on kids' voices in a noisy
               room? How is verifiable parental/school consent handled? Schools vs. parents?
```

The `refine` step renders every endorsed idea's soul into `refine/soul-draft.md`, led by a
baked-in instruction header so `/grill-with-docs` knows to interrogate purpose → audience →
monetization → cost → features and attack the open questions. The grilled result is saved to
`refine/soul-final.md`, which the build step folds into `deriveRequirements` as `context`.

### `deriveRequirements`

**Step 2.** Takes one **endorsed** pitch and splits it into functional / non-functional
requirements for a localhost prototype, seeding the non-functional list from the pitch's
`constraint`-typed points (every constraint must surface). Returns `Requirements`
(`{ functional: string[]; nonFunctional: string[] }`). _(Sonnet)_

```ts
import { deriveRequirements } from './pipeline/requirements';

// pitch is a DetailedPitch with status: 'endorsed'
const requirements = await deriveRequirements(pitch);
```

| Option    | Type     | Default  | Description                                                                                             |
| --------- | -------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `model`   | `string` | `SONNET` | Anthropic model ID (see `shared.ts`: `SONNET`, `OPUS`, `HAIKU`).                                        |
| `context` | `string` | _(none)_ | Extra context folded into the prompt — the refiner flow passes the grilled soul (`soul-final.md`) here so decisions sharpened after extraction (a narrowed audience, a dropped feature) shape the requirements. |

Example output for **Reading Buddy**:

```
=== REQUIREMENTS: Reading Buddy ===
Functional
  - Listen to a child reading aloud and follow along with the text in real time.
  - Detect a stumble or stall and deliver a gentle spoken hint.
  - Mark books as finished and render a shelf that visibly fills up.
  - Present a friendly companion character that reacts to progress.
Non-functional
  - Speech recognition runs fully on-device — no network dependency.
  - No child voice data leaves the device (COPPA).
  - Runs on low-end school hardware and works offline.
```

### `designArchitecture`

**Step 3.** Pitch + requirements → a deliberately small, localhost-runnable architecture
with reasoning tied back to the requirements. Recommends **two** stacks: the prototype stack
built now on localhost, and a forward-looking **production stack** the prototype would
graduate to (with notes on what changes — hosting, persistence, auth, scale). Returns
`Architecture`. _(Opus — the reasoning-heavy stage)_

```ts
import { designArchitecture } from './pipeline/design';

const architecture = await designArchitecture(pitch, requirements);
```

| Option  | Type     | Default | Description                                                      |
| ------- | -------- | ------- | ---------------------------------------------------------------- |
| `model` | `string` | `OPUS`  | Anthropic model ID (see `shared.ts`: `SONNET`, `OPUS`, `HAIKU`). |

Example output for **Reading Buddy**:

```
## Architecture

**Prototype stack (localhost):** React + Vite · Web Speech API (on-device) · IndexedDB · TypeScript
**Production stack:** Next.js · managed STT (or on-device fallback) · Postgres · Auth provider · Vercel

### Components
- ReadingSession — captures mic input, tracks position in the passage.
- HintEngine — diffs recognized words against expected text; fires a hint on mismatch/stall.
- Companion — on-screen character; delivers hints and reacts to progress.
- Bookshelf — persists finished books in IndexedDB; renders the filling shelf.

**Data flow:** mic → on-device recognizer → HintEngine (diff vs expected) → Companion cue;
on completion → Bookshelf (IndexedDB).
**Reasoning:** The Web Speech API keeps recognition on-device, satisfying both the offline and
COPPA constraints with zero backend. IndexedDB persists the shelf locally for the same reason.
Vite gives a one-command localhost dev server for the prototype.
**Production notes:** Swap IndexedDB for Postgres and add an auth provider once shelves sync
across devices; keep recognition on-device (or behind a privacy-reviewed STT service) so the
COPPA constraint still holds at scale.
```

### `buildCodingPrompt`

**Step 4.** The per-pitch deliverable: a single copy-paste-ready prompt for an AI coding
assistant. The one prose stage — plain `generateText`, **no schema**, returns a `string`.
The recommended prototype stack is a **default, not a lock-in**: the generated prompt tells
the assistant to pause, offer the recommended stack plus 1–2 alternatives (with tradeoffs),
let the user pick before scaffolding, and surface the production stack as the growth path.
_(Sonnet)_

```ts
import { buildCodingPrompt } from './pipeline/codingPrompt';

const codingPrompt = await buildCodingPrompt(pitch, requirements, architecture);
```

| Option  | Type     | Default  | Description                                                      |
| ------- | -------- | -------- | ---------------------------------------------------------------- |
| `model` | `string` | `SONNET` | Anthropic model ID (see `shared.ts`: `SONNET`, `OPUS`, `HAIKU`). |

Example output for **Reading Buddy**:

```
## Coding prompt

Before writing any code, stop and confirm the stack. The recommended localhost prototype
stack is React + Vite + TypeScript (everything on-device). Briefly offer 1–2 alternatives
with their tradeoffs (e.g. SvelteKit for less boilerplate), then ask the user to confirm or
switch — and wait. Whatever they pick must keep speech recognition on-device and work
offline. For context, this would graduate to a Next.js + Postgres + hosted-auth production
stack once shelves sync across devices.

Once the stack is confirmed, implement four components: ReadingSession (mic capture +
position tracking via the Web Speech API), HintEngine (diff recognized words against the
expected passage and trigger a gentle hint on a stall or mismatch), Companion (an on-screen
character), and Bookshelf (persist finished books and render a shelf that fills up). Start
with a single short hard-coded passage...
```

### `buildPlans` / `buildFromTranscript` (orchestrator)

**Step 5.** Defined in `src/plan.ts` and shared by both entry points. `buildPlans(pitches, { context? })`
applies the endorsed-only gate then runs `deriveRequirements` · `designArchitecture` ·
`buildCodingPrompt` per endorsed pitch (pitches in parallel; each pitch's chain sequential),
returning `BuildResult` (`{ built: BuildPlan[]; excluded: { name, status }[] }`). Both entry
points then write **one Markdown file per accepted build** to `builds/` (filename slugged from
the pitch name) — the full chain in **DEV**, just the coding prompt in **PROD**
(`NODE_ENV=production`) — and print a short summary of what was written vs. skipped.

- **`main.ts`** (`npm start`) — the transcript-first flow. Uses `buildFromTranscript(transcript)`
  (a thin wrapper that extracts, keeping rejected pitches for reporting, then calls `buildPlans`).
- **`build.ts`** (`npm run build-plan`) — the refiner flow. Reads `refine/pitches.json` + the
  grilled `refine/soul-final.md` (falling back to the draft) and calls `buildPlans(pitches, { context: soul })`.

```ts
const { built, excluded } = await buildFromTranscript(transcript);
// built:    one BuildPlan per endorsed pitch (pitch · requirements · architecture · codingPrompt)
// excluded: rejected / parked / discussed / proposed pitches, with their status
```

Console summary:

```
=== BUILD PLAN ===
Built (2):
  ✓ Reading Buddy → builds/reading-buddy.md
  ✓ On-Demand Dog Walking → builds/on-demand-dog-walking.md
Skipped (2):
  – Music Finder (parked)
  – Product Ethics Scanner (rejected)
```

---

## Tech stack

- [Vercel AI SDK](https://sdk.vercel.ai) (`ai`) — `generateText` + structured output
- [`@ai-sdk/anthropic`](https://www.npmjs.com/package/@ai-sdk/anthropic) — Claude provider
- [`assemblyai`](https://www.npmjs.com/package/assemblyai) — speech-to-text + diarization for Step 0 (the one non-AI-SDK stage; see [`transcribeAudio`](#transcribeaudio) for why)
- [Zod](https://zod.dev) — schema definition + inferred TypeScript types
- [`tsx`](https://github.com/privatenumber/tsx) — run TypeScript directly, no build step
- Two Claude Code **skills** (`.claude/skills/`) — `refine-idea` and `plan-from-soul` — that wrap the CLI steps and manage the handoff to `/grill-with-docs`

---

## What's next

The recording → soul → build-plan flow is in place. Natural next steps:

- **Name mapping** — diarization yields generic `Speaker A` / `Speaker B`; a light pass could
  map them to real names when the recording announces them ("okay, Maya here"). Out of scope
  for now — `extractPitches` doesn't rely on speaker turns.
- **Soul across ideas** — today `deriveSoul` runs per endorsed pitch; a brainstorm-level pass
  could spot when two "ideas" are really one product, or surface a shared thesis.
- **Grill → build in one skill** — `/refine-idea` and `/plan-from-soul` are split so the human
  grilling sits cleanly in the middle; if the grill ever runs headless, they could merge.
- **Round-trip the grilled soul** — feed `soul-final.md` back into `deriveSoul` context so a
  re-run sharpens rather than redrafts.
