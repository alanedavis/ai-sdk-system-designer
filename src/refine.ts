import { mkdir, writeFile } from 'fs/promises';
import { transcribeAudio } from './pipeline/transcribe';
import { extractPitches, type DetailedPitch } from './pipeline/extract';
import { deriveSoul } from './pipeline/soul';
import type { Soul } from './pipeline/shared';
import {
  REFINE_DIR,
  TRANSCRIPT_PATH,
  PITCHES_PATH,
  SOUL_DRAFT_PATH,
  SOUL_FINAL_PATH,
} from './paths';

// ─────────────────────────────────────────────────────────────────────────────
// REFINE — recording → soul draft (Step 0 → Step 1 → Step 1.5)
// The front half of the idea-refiner flow, driven by the `refine-idea` skill:
//   transcribe (diarized) → extract pitches → draft the soul of each endorsed idea.
// Everything lands at fixed paths under refine/ so a /grill-with-docs session (and then
// `build.ts`) can pick it up without arguments.
// ─────────────────────────────────────────────────────────────────────────────

// The instruction header baked into the draft so running /grill-with-docs against it
// knows exactly what to do — no separate prompt needed.
const GRILL_HEADER = `<!-- Auto-drafted by \`npm run refine\`. This is a starting point, not a spec. -->

# Idea Soul — Draft

> **Running \`/grill-with-docs\`?** Interrogate this draft one idea at a time, in this order:
> **purpose → audience → monetization → cost → features**, recommending an answer at each
> step, then attack the open questions listed under each idea. As decisions harden, write
> the sharpened version to \`${SOUL_FINAL_PATH}\` using the same structure. When the soul is
> solid, run \`/plan-from-soul\` (or \`npm run build-plan\`) to generate the build plan.
`;

function soulSection(pitch: DetailedPitch, soul: Soul): string {
  const { willMonetize, model, reasoning } = soul.monetization;
  return [
    `## ${pitch.name}`,
    '',
    `*${pitch.summary}*  ·  _status: ${pitch.status} (${pitch.confidence})_`,
    '',
    `**Why (purpose):** ${soul.purpose}`,
    '',
    `**Who (audience):** ${soul.audience}`,
    '',
    `**Monetize:** ${willMonetize ? 'yes' : 'no'} — ${model}`,
    `> ${reasoning}`,
    '',
    `**Cost:** ${soul.cost}`,
    '',
    '**Features:**',
    ...soul.features.map((f) => `- ${f}`),
    '',
    '**Open questions to grill:**',
    ...(soul.openQuestions.length ? soul.openQuestions.map((q) => `- ${q}`) : ['- _(none surfaced — find your own)_']),
  ].join('\n');
}

async function main() {
  const audioPath = process.argv[2];
  if (!audioPath) {
    console.error('Usage: npm run refine <path-to-audio-file>');
    console.error('  e.g. npm run refine recordings/brainstorm.m4a');
    process.exit(1);
  }

  await mkdir(REFINE_DIR, { recursive: true });

  // Step 0 — transcribe (diarized).
  console.log(`Transcribing ${audioPath} …`);
  const transcript = await transcribeAudio(audioPath);
  await writeFile(TRANSCRIPT_PATH, transcript, 'utf8');
  console.log(`  → ${TRANSCRIPT_PATH}`);

  // Step 1 — extract pitches (keep rejected so the build step can report them).
  console.log('Extracting ideas …');
  const pitches = await extractPitches(transcript, { mode: 'full', keepRejected: true });
  await writeFile(PITCHES_PATH, JSON.stringify(pitches, null, 2), 'utf8');
  console.log(`  → ${PITCHES_PATH} (${pitches.length} idea${pitches.length === 1 ? '' : 's'})`);

  const endorsed = pitches.filter((p) => p.status === 'endorsed');
  if (endorsed.length === 0) {
    console.log('\nNo endorsed ideas to draft a soul for. Nothing rose above the noise this time.');
    return;
  }

  // Step 1.5 — draft the soul of each endorsed idea (in parallel).
  console.log(`Finding the soul of ${endorsed.length} endorsed idea${endorsed.length === 1 ? '' : 's'} …`);
  const drafted = await Promise.all(
    endorsed.map(async (pitch) => ({ pitch, soul: await deriveSoul(pitch) })),
  );

  const sections = drafted.map(({ pitch, soul }) => soulSection(pitch, soul));
  const draft = [GRILL_HEADER, ...sections].join('\n\n---\n\n') + '\n';
  await writeFile(SOUL_DRAFT_PATH, draft, 'utf8');

  console.log(`\n✓ Soul draft ready → ${SOUL_DRAFT_PATH}`);
  console.log('  Next: run  /grill-with-docs  to find the soul, then  /plan-from-soul  to build.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
