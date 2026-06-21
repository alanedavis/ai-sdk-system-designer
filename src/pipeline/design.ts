import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import {
  OPUS,
  ARCHITECTURE_SCHEMA,
  type Requirements,
  type Architecture,
} from './shared';
import type { DetailedPitch } from './extract';

// Interfaces
export interface Options {
  model?: string;
}

// System const
const SYS = `You design a SMALL prototype architecture for an endorsed project pitch —
something a coding agent can stand up on localhost, NOT a production system. Bias hard
toward the smallest thing that demonstrates the idea: a handful of components, a short
tech stack, no infrastructure that isn't strictly needed.

Return:
- techStack — the few libraries/tools the prototype runs on. Prefer boring, local-first
  choices; avoid servers, databases, and cloud services unless a requirement forces them.
- productionStack — what you'd graduate the prototype to for a real production deployment.
  Map each prototype choice to its production-grade counterpart (e.g. local SQLite file →
  managed Postgres, in-memory store → hosted cache, static localhost → a real host). Keep
  it a coherent, mainstream stack; this is a recommendation, not what gets built now.
- components — the small set of parts, each with a single clear responsibility.
- dataFlow — how data moves through those components, end to end, in plain language.
- reasoning — why the PROTOTYPE choices, tying each back to a specific requirement
  (especially the non-functional ones, e.g. offline / on-device / privacy limits).
- productionNotes — briefly, what changes moving from the prototype to the production
  stack and why (hosting, persistence, auth, scale), and which hard constraints still bind.

The prototype is what gets built now; the production stack is forward-looking guidance.
Every prototype choice must serve a stated requirement. Do not invent scope the
requirements don't ask for.`;

// Functions
export const designArchitecture = async (
  pitch: DetailedPitch,
  requirements: Requirements,
  opts: Options = {},
): Promise<Architecture> => {
  const { model = OPUS } = opts;

  const prompt = `Pitch: ${pitch.name}
Summary: ${pitch.summary}

Functional requirements:
${requirements.functional.map((r) => `- ${r}`).join('\n')}

Non-functional requirements:
${requirements.nonFunctional.map((r) => `- ${r}`).join('\n')}

Design the smallest localhost-runnable prototype architecture that satisfies these.`;

  const { output } = await generateText({
    model: anthropic(model),
    system: SYS,
    prompt,
    output: Output.object({ schema: ARCHITECTURE_SCHEMA }),
  });

  return output;
};
