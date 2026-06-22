# AI SDK System Designer

Turn a messy brainstorm transcript into a structured list of **project pitches** — each with where the group landed, how confident the proposer was, the concrete points raised, and the verbatim quotes that justify the call.

Built on the [Vercel AI SDK](https://sdk.vercel.ai) with Anthropic's Claude models, using structured (schema-constrained) output so every result is typed end to end.

---

## What it does

Given a transcript like `transcripts/demo-1.txt` — exported in **Zoom AI Companion** transcription format (a header block followed by `Speaker  HH:MM:SS` timestamped turns) — the pipeline identifies each distinct project idea discussed and extracts it in one of two levels of detail:

- **Minimal** — just the pitch `name` and a one–two sentence `summary`. A fast sanity pass.
- **Full** — everything in minimal, plus:
  - **status** — where the group landed: `endorsed` · `rejected` · `parked` · `discussed` · `proposed`. Inferred from how people reacted, not just what they said outright (e.g. sarcasm or a low-energy subject change reads as a *rejection*, not a *park*).
  - **confidence** — `clear` or `tentative`, based on how firmly the pitch was put forward.
  - **points** — the distinct things raised, each typed as `feature` · `constraint` · `question` · `tangent`.
  - **sourceQuotes** — the verbatim line(s) that justify the status call.

---

## Project layout

```
.
├── src/
│   ├── main.ts                # Step 5 — buildFromTranscript() orchestrator + Markdown export
│   └── pipeline/
│       ├── extract.ts         # Step 1 — extractPitches()
│       ├── requirements.ts    # Step 2 — deriveRequirements()
│       ├── design.ts          # Step 3 — designArchitecture()
│       ├── codingPrompt.ts    # Step 4 — buildCodingPrompt()
│       └── shared.ts          # Model IDs + Zod schemas (pitch / requirements / architecture) and types
├── transcripts/
│   └── demo-1.txt             # Sample brainstorm transcript (Zoom AI Companion format)
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
```

`.env` is gitignored and loaded automatically at startup via Node's native `--env-file` (wired into the npm scripts) — no `dotenv` dependency required.

### 4. Run

```bash
npm start          # run once
npm run dev        # watch mode — re-runs on file changes
npm run typecheck  # tsc --noEmit, no run
```

By default the demo reads `transcripts/demo-1.txt`, writes one Markdown file per accepted build to `builds/`, and prints a short build-plan summary (what was written vs. skipped) to the console. In DEV each file carries the full chain (requirements · architecture · coding prompt); in PROD (`NODE_ENV=production`) it carries just the coding prompt.

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

## The API: `extractPitches`

```ts
import { extractPitches } from './pipeline/extract';

// Minimal — returns Pitch[]
const pitches = await extractPitches(transcript);

// Full — returns DetailedPitch[]
const detailed = await extractPitches(transcript, { mode: 'full' });
```

The function is overloaded so the return type follows the `mode` you pass — `Pitch[]` for minimal, `DetailedPitch[]` for full.

### Options

| Option         | Type                  | Default     | Description                                                                                                                                   |
| -------------- | --------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `mode`         | `'minimal' \| 'full'` | `'minimal'` | Level of detail to extract.                                                                                                                    |
| `model`        | `string`              | `SONNET`    | Anthropic model ID (see `shared.ts`: `SONNET`, `OPUS`, `HAIKU`).                                                                               |
| `keepRejected` | `boolean`             | `false`     | When `false`, pitches with `status: 'rejected'` are dropped from the result. Only meaningful in `full` mode (minimal pitches have no status). |

> **Note:** `keepRejected` controls *inclusion* at the data layer; the DEV/PROD distinction above controls *verbosity* at the render layer. The demo's detailed pass passes `keepRejected: true` so rejected pitches survive extraction and can be rendered at the bottom.

---

## Example output (`demo-1.txt`)

Running the pipeline against the sample transcript. Output is **representative** — the
wording varies run to run since it's model-generated — but the shape and the status
calls are stable. As new pipeline functions land, each gets its own subsection here.

### `extractPitches`

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

### `deriveRequirements`

**Step 2.** Runs on **endorsed pitches only** and splits one into functional /
non-functional requirements, with the non-functional list seeded from the pitch's
`constraint`-typed points (`deriveRequirements(pitch)`):

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

**Step 3.** Pitch + requirements → a deliberately small, localhost-runnable architecture,
with reasoning tied back to the requirements. It recommends **two** stacks: the prototype
stack that gets built now on localhost, and a forward-looking **production stack** the
prototype would graduate to (with notes on what changes — hosting, persistence, auth,
scale). Defaults to **Opus** (the reasoning-heavy stage). `designArchitecture(pitch, requirements)`:

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
assistant. The one prose stage — plain `generateText`, **no schema**. The recommended
prototype stack is a **default, not a lock-in**: the generated prompt instructs the
assistant to pause, offer the recommended stack plus 1–2 alternatives (with tradeoffs),
and let the user pick before scaffolding — and to surface the production stack as the
growth path. `buildCodingPrompt(pitch, requirements, design)`:

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

### `buildFromTranscript` (orchestrator)

**Step 5.** Wires every stage into one pass and writes **one Markdown file per accepted
build** to `builds/` (filename slugged from the pitch name). Each file carries the full
chain in **DEV** (requirements · architecture · coding prompt) or just the coding prompt in
**PROD** (`NODE_ENV=production`). The console only carries a short build-plan summary —
what was written vs. skipped and why.

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

## How it works

`extractPitches` makes a single `generateText` call (Vercel AI SDK) with `Output.object`, constraining the model to a Zod schema (`{ pitches: Pitch[] }`). The schema and its `.describe()` annotations — defined in `shared.ts` — double as instructions to the model, so the structure and the guidance stay in one place. A detailed system prompt teaches the model how to infer `status` from group dynamics rather than surface wording.

---

## Tech stack

- [Vercel AI SDK](https://sdk.vercel.ai) (`ai`) — `generateText` + structured output
- [`@ai-sdk/anthropic`](https://www.npmjs.com/package/@ai-sdk/anthropic) — Claude provider
- [Zod](https://zod.dev) — schema definition + inferred TypeScript types
- [`tsx`](https://github.com/privatenumber/tsx) — run TypeScript directly, no build step

---

## Roadmap

The pipeline is structured as numbered steps (see `main.ts`). Everything past Step 1 runs
on **endorsed pitches only** — `rejected`, `parked`, `discussed`, and `proposed` pitches
are reported as excluded, never fed forward. Each stage is one file under `src/pipeline/`
exporting one function, with its schema + `.describe()` annotations in `shared.ts`.

- [x] **Step 1 — Extract Pitches** (`extract.ts`) — transcript → typed pitches.
- [x] **Step 2 — Derive Requirements** (`requirements.ts`) — endorsed pitch → functional / non-functional requirements. _(Sonnet)_
- [x] **Step 3 — Design Architecture** (`design.ts`) — pitch + requirements → small localhost-runnable prototype stack **+ a recommended production stack** to graduate to, with reasoning. _(Opus — reasoning-heavy)_
- [x] **Step 4 — Build Coding Prompt** (`codingPrompt.ts`) — the one prose stage; plain `generateText`, no schema. Prompts the pasted-into AI to let the user pick a stack before building. _(Sonnet)_
- [x] **Step 5 — Orchestrate** (`main.ts`) — `buildFromTranscript()`: extract → endorsed-only gate → requirements · design · prompt per pitch, then writes one Markdown file per accepted build to `builds/`.

**Later (not scheduled):** provenance / sign-off UI (`sourceQuotes` already captured),
confidence-based filtering, and real-time during-the-call extraction (deliberately
de-scoped — the pipeline is batch-only).
