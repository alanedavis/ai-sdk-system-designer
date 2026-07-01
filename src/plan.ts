import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { extractPitches, type DetailedPitch } from './pipeline/extract';
import { deriveRequirements } from './pipeline/requirements';
import { designArchitecture } from './pipeline/design';
import { buildCodingPrompt } from './pipeline/codingPrompt';
import type { Requirements, Architecture } from './pipeline/shared';
import { BUILDS_DIR } from './paths';

// ─────────────────────────────────────────────────────────────────────────────
// Shared build pipeline
// The tail of the flow — endorsed pitch → requirements · architecture · coding prompt,
// then rendered to Markdown. Used by BOTH entry points: `main.ts` (transcript → builds,
// the original demo) and `build.ts` (grilled soul → builds, the refine flow).
// ─────────────────────────────────────────────────────────────────────────────

export type BuildPlan = {
  pitch: DetailedPitch;
  requirements: Requirements;
  architecture: Architecture;
  codingPrompt: string;
};

export type BuildResult = {
  built: BuildPlan[];
  excluded: { name: string; status: DetailedPitch['status'] }[];
};

export interface BuildOptions {
  // Extra context folded into requirements — e.g. the grilled soul brief.
  context?: string;
}

// Run the endorsed-only pipeline over a set of pitches. Everything past the gate runs on
// ENDORSED pitches only; the rest are reported as excluded, never fed forward. Each
// pitch's chain is sequential (requirements → design → prompt); pitches run in parallel.
export async function buildPlans(
  pitches: DetailedPitch[],
  opts: BuildOptions = {},
): Promise<BuildResult> {
  const endorsed = pitches.filter((p) => p.status === 'endorsed');
  const excluded = pitches
    .filter((p) => p.status !== 'endorsed')
    .map((p) => ({ name: p.name, status: p.status }));

  const built = await Promise.all(
    endorsed.map(async (pitch) => {
      const requirements = await deriveRequirements(pitch, { context: opts.context });
      const architecture = await designArchitecture(pitch, requirements);
      const codingPrompt = await buildCodingPrompt(pitch, requirements, architecture);
      return { pitch, requirements, architecture, codingPrompt };
    }),
  );

  return { built, excluded };
}

// Convenience wrapper for the transcript-first entry point: extract (keeping rejected
// pitches so they can be reported) then build.
export async function buildFromTranscript(transcript: string): Promise<BuildResult> {
  const pitches = await extractPitches(transcript, { mode: 'full', keepRejected: true });
  return buildPlans(pitches);
}

// ─────────────────────────────────────────────────────────────────────────────
// Markdown builders
// ─────────────────────────────────────────────────────────────────────────────

// Turn a pitch name into a safe, lowercase filename stem.
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'build'
  );
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
export function renderBuildMarkdown(plan: BuildPlan, isProd: boolean): string {
  const parts = [`# ${plan.pitch.name}`, '', plan.pitch.summary];

  if (!isProd) {
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
export async function writeBuilds(built: BuildPlan[], isProd: boolean): Promise<string[]> {
  await mkdir(BUILDS_DIR, { recursive: true });
  return Promise.all(
    built.map(async (plan) => {
      const path = join(BUILDS_DIR, `${slugify(plan.pitch.name)}.md`);
      await writeFile(path, renderBuildMarkdown(plan, isProd), 'utf8');
      return path;
    }),
  );
}

// A short summary of what was built (and written) vs. skipped, printed to the console.
export function reportBuildPlan({ built, excluded }: BuildResult, paths: string[]) {
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
