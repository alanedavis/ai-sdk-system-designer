import { basename, extname, join } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Fixed artifact paths
// The refine → grill → build flow spans two CLIs (`npm run refine` and `npm run
// build-plan`) with an interactive grill in between; the /refine-build-plan skill
// orchestrates all three. They hand off through files at STABLE paths so each stage
// always knows where to read and write — no arguments to thread.
// ─────────────────────────────────────────────────────────────────────────────

// Everything the `refine` step produces lands here (generated — gitignored).
export const REFINE_DIR = 'refine';

// Step 0 output — the speaker-attributed transcript (fixed path the next steps read).
export const TRANSCRIPT_PATH = join(REFINE_DIR, 'transcript.txt');

// A persistent, human-friendly archive of every transcript, kept across runs and named
// after the source recording (unlike TRANSCRIPT_PATH, which the next run overwrites).
export const TRANSCRIPTS_DIR = 'transcripts';
export const transcriptArchivePath = (audioPath: string): string =>
  join(TRANSCRIPTS_DIR, `${basename(audioPath, extname(audioPath))}.txt`);

// The extracted DetailedPitch[] (JSON), so the build step doesn't have to re-extract.
export const PITCHES_PATH = join(REFINE_DIR, 'pitches.json');

// The auto-drafted soul, ready for the grill step to sharpen.
export const SOUL_DRAFT_PATH = join(REFINE_DIR, 'soul-draft.md');

// The grilled, sharpened soul the build step reads (falls back to the draft if absent).
export const SOUL_FINAL_PATH = join(REFINE_DIR, 'soul-final.md');

// Where accepted builds are written, one Markdown file per build.
export const BUILDS_DIR = 'builds';
