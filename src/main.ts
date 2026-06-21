import { readFile, mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { extractPitches, type DetailedPitch } from './pipeline/extract';
import { deriveRequirements } from './pipeline/requirements';
import { designArchitecture } from './pipeline/design';
import { buildCodingPrompt } from './pipeline/codingPrompt';
import type { Requirements, Architecture } from './pipeline/shared';

const TRANSCRIPT_PATH = 'transcripts/demo-1.txt';

// Where accepted builds are written, one Markdown file per build.
const OUTPUT_DIR = 'builds';

// PROD writes just the coding prompts (the shippable deliverables); DEV writes every
// intermediate stage so you can inspect the chain.
const IS_PROD = process.env.NODE_ENV === 'production';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
type BuildPlan = {
  pitch: DetailedPitch;
  requirements: Requirements;
  architecture: Architecture;
  codingPrompt: string;
};

type BuildResult = {
  built: BuildPlan[];
  excluded: { name: string; status: DetailedPitch['status'] }[];
};

// ─────────────────────────────────────────────────────────────────────────────
// STEP 5 — ORCHESTRATE
// One pass over a transcript: extract → endorsed-only gate → requirements · design ·
// coding prompt per pitch. Everything past Step 1 runs on ENDORSED pitches only; the
// rest are reported as excluded, never fed forward.
// ─────────────────────────────────────────────────────────────────────────────
async function buildFromTranscript(transcript: string): Promise<BuildResult> {
  // keepRejected: true so non-endorsed pitches survive to be reported as excluded.
  const pitches = await extractPitches(transcript, { mode: 'full', keepRejected: true });

  const endorsed = pitches.filter((p) => p.status === 'endorsed');
  const excluded = pitches
    .filter((p) => p.status !== 'endorsed')
    .map((p) => ({ name: p.name, status: p.status }));

  // Each pitch's chain is sequential (requirements → design → prompt); pitches run in parallel.
  const built = await Promise.all(
    endorsed.map(async (pitch) => {
      const requirements = await deriveRequirements(pitch);
      const architecture = await designArchitecture(pitch, requirements);
      const codingPrompt = await buildCodingPrompt(pitch, requirements, architecture);
      return { pitch, requirements, architecture, codingPrompt };
    }),
  );

  return { built, excluded };
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown builders
// ─────────────────────────────────────────────────────────────────────────────

// Turn a pitch name into a safe, lowercase filename stem.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'build';
}

function requirementsSection({ functional, nonFunctional }: Requirements): string {
  return [
    '## Requirements',
    '',
    '### Functional',
    ...functional.map((r) => `- ${r}`),
    '',
    '### Non-functional',
    ...nonFunctional.map((r) => `- ${r}`),
  ].join('\n');
}

function architectureSection(architecture: Architecture): string {
  return [
    '## Architecture',
    '',
    `**Prototype stack (localhost):** ${architecture.techStack.join(' · ')}`,
    '',
    `**Production stack:** ${architecture.productionStack.join(' · ')}`,
    '',
    '### Components',
    ...architecture.components.map((c) => `- **${c.name}** — ${c.responsibility}`),
    '',
    `**Data flow:** ${architecture.dataFlow}`,
    '',
    `**Reasoning:** ${architecture.reasoning}`,
    '',
    `**Production notes:** ${architecture.productionNotes}`,
  ].join('\n');
}

function codingPromptSection(codingPrompt: string): string {
  return ['## Coding prompt', '', codingPrompt].join('\n');
}

// PROD ships just the coding prompt; DEV includes the full chain for inspection.
function renderBuildMarkdown(plan: BuildPlan): string {
  const parts = [`# ${plan.pitch.name}`, '', plan.pitch.summary];

  if (!IS_PROD) {
    parts.push('', requirementsSection(plan.requirements));
    parts.push('', architectureSection(plan.architecture));
  }

  parts.push('', codingPromptSection(plan.codingPrompt));
  return parts.join('\n') + '\n';
}

// ─────────────────────────────────────────────────────────────────────────────
// Output
// ─────────────────────────────────────────────────────────────────────────────

// Write each accepted build to its own Markdown file, returning the paths written.
async function writeBuilds(built: BuildPlan[]): Promise<string[]> {
  await mkdir(OUTPUT_DIR, { recursive: true });
  return Promise.all(
    built.map(async (plan) => {
      const path = join(OUTPUT_DIR, `${slugify(plan.pitch.name)}.md`);
      await writeFile(path, renderBuildMarkdown(plan), 'utf8');
      return path;
    }),
  );
}

// A short summary of what was built (and written) vs. skipped, printed to the console.
function reportBuildPlan({ built, excluded }: BuildResult, paths: string[]) {
  console.log('\n=== BUILD PLAN ===');
  console.log(`Built (${built.length}):`);
  built.forEach(({ pitch }, i) => {
    console.log(`  ✓ ${pitch.name} → ${paths[i]}`);
  });
  console.log(`Skipped (${excluded.length}):`);
  for (const { name, status } of excluded) {
    console.log(`  – ${name} (${status})`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  const transcript = await readFile(TRANSCRIPT_PATH, 'utf8');
  console.log(`Running in ${IS_PROD ? 'PROD' : 'DEV'} mode`);

  const result = await buildFromTranscript(transcript);

  // Each accepted build becomes its own Markdown file; the console only carries a
  // short summary of what was written vs. skipped.
  const paths = await writeBuilds(result.built);
  reportBuildPlan(result, paths);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
