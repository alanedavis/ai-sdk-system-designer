import { mkdir, writeFile } from 'fs/promises';
import { transcribeAudio } from './pipeline/transcribe';
import { extractPitches, type DetailedPitch } from './pipeline/extract';
import { deriveSoul } from './pipeline/soul';
import type { Soul } from './pipeline/shared';
import {
  REFINE_DIR,
  TRANSCRIPTS_DIR,
  TRANSCRIPT_PATH,
  transcriptArchivePath,
  PITCHES_PATH,
  SOUL_DRAFT_PATH,
  SOUL_FINAL_PATH,
} from './paths';

// ─────────────────────────────────────────────────────────────────────────────
// REFINE — recording → soul draft (Step 0 → Step 1 → Step 1.5)
// The front half of the idea-refiner flow, driven by the `refine-idea` skill:
//   transcribe (diarized) → extract pitches → draft the soul of each endorsed idea.
// Everything lands at fixed paths under refine/ so the grill in the /refine-build-plan
// skill (and then `build.ts`) can pick it up without arguments.
// ─────────────────────────────────────────────────────────────────────────────

// The instruction header baked into the draft so the grill step (in /refine-build-plan)
// knows exactly what to do — no separate prompt needed.
export const GRILL_HEADER = `<!-- Auto-drafted by \`npm run refine\`. This is a starting point, not a spec. -->

# Idea Soul — Draft

> **Grilling this draft?** First force a cohesive core: make the idea *be one thing* a brand
> could stand on — if it's loose or tries to do everything, grill it into a single identity
> before anything else. Then interrogate one idea at a time, in this order:
> **identity → purpose → audience → monetization → cost → features**, recommending an answer at
> each step, then attack the open questions listed under each idea. As decisions harden, write
> the sharpened version to \`${SOUL_FINAL_PATH}\` using the same structure, leading each idea with
> a crisp identity line (what it is, for whom, the one thing that makes it it). When the soul is
> solid and no open questions remain, continue straight to the build plan (\`npm run build-plan\`).
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
  await mkdir(TRANSCRIPTS_DIR, { recursive: true });

  // Step 0 — transcribe (diarized). Write the fixed path the next steps read, plus a
  // named archive so past transcripts survive future runs.
  console.log(`Transcribing ${audioPath} …`);
  const transcript = await transcribeAudio(audioPath);
  const archivePath = transcriptArchivePath(audioPath);
  await writeFile(TRANSCRIPT_PATH, transcript, 'utf8');
  await writeFile(archivePath, transcript, 'utf8');
  console.log(`  → ${TRANSCRIPT_PATH}`);
  console.log(`  → ${archivePath} (archive)`);

  // Step 1 — extract pitches (keep rejected so the build step can report them).
  console.log('Extracting ideas …');
  const pitches = await extractPitches(transcript, { mode: 'full', keepRejected: true });
  await writeFile(PITCHES_PATH, JSON.stringify(pitches, null, 2), 'utf8');
  console.log(`  → ${PITCHES_PATH} (${pitches.length} idea${pitches.length === 1 ? '' : 's'})`);

  // Draft a soul for every idea the group didn't put down — i.e. anything that isn't
  // explicitly parked or rejected (endorsed, discussed, and proposed all qualify).
  const SKIP_STATUSES = new Set(['parked', 'rejected']);
  const toRefine = pitches.filter((p) => !SKIP_STATUSES.has(p.status));
  if (toRefine.length === 0) {
    console.log('\nNo ideas to draft a soul for — everything was parked or rejected this time.');
    return;
  }

  // Step 1.5 — draft the soul of each surviving idea (in parallel).
  console.log(`Finding the soul of ${toRefine.length} idea${toRefine.length === 1 ? '' : 's'} …`);
  const drafted = await Promise.all(
    toRefine.map(async (pitch) => ({ pitch, soul: await deriveSoul(pitch) })),
  );

  const sections = drafted.map(({ pitch, soul }) => soulSection(pitch, soul));
  const draft = [GRILL_HEADER, ...sections].join('\n\n---\n\n') + '\n';
  await writeFile(SOUL_DRAFT_PATH, draft, 'utf8');

  console.log(`\n✓ Soul draft ready → ${SOUL_DRAFT_PATH}`);
  console.log('  Next: grill the soul, then run  npm run build-plan  (the /refine-build-plan skill does both).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
