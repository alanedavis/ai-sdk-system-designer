import { readFile } from 'fs/promises';
import { buildFromTranscript, writeBuilds, reportBuildPlan } from './plan';

const TRANSCRIPT_PATH = 'transcripts/demo-1.txt';

// PROD writes just the coding prompts (the shippable deliverables); DEV writes every
// intermediate stage so you can inspect the chain.
const IS_PROD = process.env.NODE_ENV === 'production';

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — ORCHESTRATE (transcript-first entry point)
// One pass over a transcript: extract → endorsed-only gate → requirements · design ·
// coding prompt per pitch → one Markdown file per accepted build. See `refine.ts` +
// `build.ts` for the recording-first flow that inserts a soul-finding step first.
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const transcript = await readFile(TRANSCRIPT_PATH, 'utf8');
  console.log(`Running in ${IS_PROD ? 'PROD' : 'DEV'} mode`);

  const result = await buildFromTranscript(transcript);

  // Each accepted build becomes its own Markdown file; the console only carries a
  // short summary of what was written vs. skipped.
  const paths = await writeBuilds(result.built, IS_PROD);
  reportBuildPlan(result, paths);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
