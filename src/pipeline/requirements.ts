import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { SONNET, REQUIREMENTS_SCHEMA, type Requirements } from './shared';
import type { DetailedPitch } from './extract';

// Interfaces
export interface Options {
  model?: string;
  // Extra context to fold in — e.g. the grilled soul brief (refine/soul-final.md), so
  // requirements reflect decisions sharpened after extraction rather than the raw pitch alone.
  context?: string;
}

// System const
const SYS = `You turn a single, endorsed project pitch into a concrete requirements list
for a SMALL localhost prototype — not a production system.

Split the requirements into two buckets:

- functional — things the prototype must DO: concrete, observable capabilities someone
  could test by hand. Derive these from the summary and the feature-typed points.

- nonFunctional — limits and qualities it must respect (privacy, offline, performance,
  platform). SEED these from the pitch's constraint-typed points — every constraint point
  must surface here — then add any others the pitch clearly implies (e.g. a COPPA mention
  implies child data never leaves the device).

Stay faithful to the pitch; never invent scope it did not raise. Keep each requirement a
single, testable sentence.

Phrasing: write each requirement as the capability or quality itself — do NOT prefix every
line with a boilerplate subject like "The prototype must…" or "The app must…". Lead
functional items with a verb ("Listen to a child reading aloud…", "Match an owner with a
nearby walker…"); state non-functional items as the constraint ("Speech recognition runs
fully on-device", "No child voice data leaves the device"). Vary the openings.`;

// Functions
export const deriveRequirements = async (
  pitch: DetailedPitch,
  opts: Options = {},
): Promise<Requirements> => {
  const { model = SONNET, context } = opts;

  const points = pitch.points.map((p) => `- (${p.type}) ${p.text}`).join('\n');
  const contextBlock = context
    ? `\nSharpened soul (grilled — treat as the source of truth where it conflicts with the raw pitch):\n${context}\n`
    : '';
  const prompt = `Pitch: ${pitch.name}
Summary: ${pitch.summary}

Points:
${points}
${contextBlock}
Derive the functional and non-functional requirements for a localhost prototype of this pitch.`;

  const { output } = await generateText({
    model: anthropic(model),
    system: SYS,
    prompt,
    output: Output.object({ schema: REQUIREMENTS_SCHEMA }),
  });

  return output;
};
