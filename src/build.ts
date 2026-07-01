import { readFile } from 'fs/promises';
import type { DetailedPitch } from './pipeline/extract';
import { buildPlans, writeBuilds, reportBuildPlan } from './plan';
import { PITCHES_PATH, SOUL_FINAL_PATH, SOUL_DRAFT_PATH } from './paths';

// ─────────────────────────────────────────────────────────────────────────────
// BUILD — grilled soul → build plan (Step 2 → Step 4)
// The back half of the idea-refiner flow, driven by the `plan-from-soul` skill. Reads the
// pitches extracted during `refine` plus the SHARPENED soul from the grilling session, then
// runs the existing requirements · architecture · coding-prompt pipeline over each endorsed
// idea — the soul folded in as context so the build reflects the decisions you grilled out.
// ─────────────────────────────────────────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === 'production';

// Prefer the grilled soul; fall back to the auto-draft if no grilling happened yet.
async function readSoul(): Promise<string> {
  try {
    const finalSoul = await readFile(SOUL_FINAL_PATH, 'utf8');
    console.log(`Using grilled soul → ${SOUL_FINAL_PATH}`);
    return finalSoul;
  } catch {
    const draft = await readFile(SOUL_DRAFT_PATH, 'utf8');
    console.log(
      `No ${SOUL_FINAL_PATH} yet — falling back to the un-grilled draft (${SOUL_DRAFT_PATH}).\n` +
        '  Tip: run /grill-with-docs first to sharpen the soul before building.',
    );
    return draft;
  }
}

async function main() {
  let pitches: DetailedPitch[];
  try {
    pitches = JSON.parse(await readFile(PITCHES_PATH, 'utf8')) as DetailedPitch[];
  } catch {
    console.error(`No ${PITCHES_PATH} found. Run \`npm run refine <audio>\` first.`);
    process.exit(1);
  }

  const soul = await readSoul();
  console.log(`Running in ${IS_PROD ? 'PROD' : 'DEV'} mode`);

  const result = await buildPlans(pitches, { context: soul });
  const paths = await writeBuilds(result.built, IS_PROD);
  reportBuildPlan(result, paths);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
