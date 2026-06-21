import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { SONNET, type Requirements, type Architecture } from './shared';
import type { DetailedPitch } from './extract';

// Interfaces
export interface Options {
  model?: string;
}

// System const
//
// Convention exception: this is the one stage with NO Zod schema. Its output is freeform
// prose — a single copy-paste-ready prompt — so it uses plain generateText. Wrapping it in
// Output.object would fight the format.
const SYS = `You write a single, copy-paste-ready prompt that instructs an AI coding
assistant (Claude Code, Cursor, etc.) to scaffold a localhost prototype.

Write the prompt as a direct instruction to the coding assistant — second person, no
preamble, no "here is a prompt" framing, no markdown headings. Fold the requirements and
the chosen architecture into clear build instructions: each component and its
responsibility, the end-to-end data flow, and the hard constraints stated as
non-negotiable.

Treat the provided prototype stack as a RECOMMENDED default for localhost, not a locked
decision. Open the prompt by instructing the assistant to STOP before writing any code and
first present the recommended prototype stack alongside 1–2 credible alternatives — each as
one line with its key tradeoff (e.g. simplicity vs. scale, on-device vs. hosted) — then ask
the user to confirm the default or pick an alternative, and wait for that choice before
scaffolding. Make clear that any chosen stack must still satisfy the hard constraints.

Also surface the recommended PRODUCTION stack: state, in one or two lines, what this would
graduate to for a real deployment and what changes (hosting, persistence, auth, scale), so
the user can see the growth path. Be explicit that the production stack is forward-looking
context — what gets built now is the localhost prototype, not the production system.

After the choice is made, tell it to start with the smallest runnable slice rather than
the whole thing. Keep it tight and concrete — a developer should be able to paste it and go.`;

// Functions
export const buildCodingPrompt = async (
  pitch: DetailedPitch,
  requirements: Requirements,
  design: Architecture,
  opts: Options = {},
): Promise<string> => {
  const { model = SONNET } = opts;

  const prompt = `Pitch: ${pitch.name}
Summary: ${pitch.summary}

Functional requirements:
${requirements.functional.map((r) => `- ${r}`).join('\n')}

Non-functional requirements (hard constraints):
${requirements.nonFunctional.map((r) => `- ${r}`).join('\n')}

Prototype stack (localhost, recommended default): ${design.techStack.join(' · ')}

Production stack (forward-looking, what it graduates to): ${design.productionStack.join(' · ')}
Production notes: ${design.productionNotes}

Components:
${design.components.map((c) => `- ${c.name}: ${c.responsibility}`).join('\n')}

Data flow: ${design.dataFlow}

Write the coding prompt that scaffolds this prototype on localhost.`;

  const { text } = await generateText({
    model: anthropic(model),
    system: SYS,
    prompt,
  });

  return text;
};
