import { join } from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Fixed artifact paths
// The refine → grill → build flow spans three runtimes (a CLI, the interactive
// /grill-with-docs skill, and a second CLI). They hand off through files at STABLE
// paths so each skill always knows where to read and write — no arguments to thread.
// ─────────────────────────────────────────────────────────────────────────────

// Everything the `refine` step produces lands here (generated — gitignored).
export const REFINE_DIR = 'refine';

// Step 0 output — the speaker-attributed transcript.
export const TRANSCRIPT_PATH = join(REFINE_DIR, 'transcript.txt');

// The extracted DetailedPitch[] (JSON), so the build step doesn't have to re-extract.
export const PITCHES_PATH = join(REFINE_DIR, 'pitches.json');

// The auto-drafted soul, ready to run /grill-with-docs against.
export const SOUL_DRAFT_PATH = join(REFINE_DIR, 'soul-draft.md');

// The grilled, sharpened soul the build step reads (falls back to the draft if absent).
export const SOUL_FINAL_PATH = join(REFINE_DIR, 'soul-final.md');

// Where accepted builds are written, one Markdown file per build.
export const BUILDS_DIR = 'builds';
