import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { OPUS, SOUL_SCHEMA, type Soul } from './shared';
import type { DetailedPitch } from './extract';

// Interfaces
export interface Options {
  model?: string;
}

// System const
const SYS = `You find the SOUL of a single, endorsed project idea — the human and business
core underneath the feature list. You are drafting a starting point that a person will
then be grilled on, so be opinionated and specific, not diplomatic and vague. A hedged,
"it depends" draft is a failed draft.

Work only from what the pitch actually raised, but you MAY reason past it: infer the real
problem, the real user, and the honest economics the way a sharp founder would. Return:

- purpose — the WHY. The problem this kills or the change it makes in someone's life. Name
  the pain, not the feature. If the idea's reason to exist is thin, say so plainly.
- audience — the WHO. One primary person described by their situation ("a parent whose kid
  is a reluctant reader"), not a demographic bucket. State who it is explicitly NOT for.
- monetization — whether this earns and how (subscription / one-off / ads / marketplace fee
  / deliberately free), with reasoning tied to THIS audience and purpose. Don't default to
  "subscription" — justify it.
- cost — an honest order-of-magnitude on what it costs to BUILD and to RUN. Call out the
  real cost drivers (per-minute speech-to-text, per-call model usage, hosting), and split
  prototype vs. production if they differ. Ballpark, not a spreadsheet.
- features — the capabilities that make it real, each one concrete. Keep them in service of
  the purpose; a feature that doesn't serve the WHY doesn't belong.
- openQuestions — the soft spots. The tensions in purpose, audience, money, or cost that a
  stress-test should attack next. These seed the grilling session.

Never fabricate enthusiasm or a market that isn't there. If the honest read is that the
idea is weak, let the draft say why — that's more useful to grill against than a fantasy.`;

// Functions
export const deriveSoul = async (pitch: DetailedPitch, opts: Options = {}): Promise<Soul> => {
  const { model = OPUS } = opts;

  const points = pitch.points.map((p) => `- (${p.type}) ${p.text}`).join('\n');
  const quotes = pitch.sourceQuotes.map((q) => `  "${q}"`).join('\n');

  const prompt = `Pitch: ${pitch.name}
Summary: ${pitch.summary}
Status: ${pitch.status} (${pitch.confidence})

Points raised:
${points}

Quotes from the room:
${quotes}

Find the soul of this idea — purpose, audience, monetization, cost, features, and the open
questions worth grilling next.`;

  const { output } = await generateText({
    model: anthropic(model),
    system: SYS,
    prompt,
    output: Output.object({ schema: SOUL_SCHEMA }),
  });

  return output;
};
