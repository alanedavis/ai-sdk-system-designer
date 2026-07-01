import { z } from 'zod';

// AI Models
export const SONNET = 'claude-sonnet-4-6';
export const OPUS = 'claude-opus-4-8';
export const HAIKU = 'claude-haiku-4-5'

// Transcription (Step 0) — Anthropic has no STT model, so this stage brings its own
// provider. AssemblyAI is the diarization-capable choice; 'best' is its top model tier.
export const ASSEMBLYAI_MODEL = 'best';

// Schemas
export const POINT = z.object({
  type: z
    .enum(['feature', 'constraint', 'question', 'tangent'])
    .describe(
      'feature = capability to build · constraint = a rule/limit to respect · ' +
        'question = an unresolved open question · tangent = raised but off the main thread',
    ),
  text: z.string().describe('The point in a sentence'),
});

export const BASE_PITCH_SCHEMA = z.object({
  name: z.string().describe('The project / pitch name'),
  summary: z.string().describe('One or two sentences on what it is'),
});
 
export const FULL_PITCH_SCHEMA = BASE_PITCH_SCHEMA.extend({
  status: z
    .enum(['proposed', 'discussed', 'endorsed', 'rejected', 'parked'])
    .describe('Where the GROUP landed on this pitch by the end of the call'),
  confidence: z
    .enum(['clear', 'tentative'])
    .describe('How firmly the pitch was put forward'),
  sourceQuotes: z
    .array(z.string())
    .min(1)
    .describe('Verbatim line(s) that justify the status call — quote, do not paraphrase'),
  points: z
    .array(POINT)
    .describe('The distinct points raised while discussing this pitch'),
});

// Step 1.5 — Derive Soul (the "why" before the "what")
//
// Between extraction and requirements: take one endorsed pitch and draft its SOUL — the
// human, business, and product core that a build plan alone never captures. This is the
// auto-drafted starting point a /grill-with-docs session then interrogates and sharpens.
export const SOUL_SCHEMA = z.object({
  purpose: z
    .string()
    .describe(
      'The WHY — the real problem this kills or the change it makes in someone’s life. ' +
        'Not the feature list; the reason it deserves to exist. Be honest and specific.',
    ),
  audience: z
    .string()
    .describe(
      'The WHO — the primary person this is for (their situation, not a demographic), ' +
        'and explicitly who it is NOT for. Narrow beats broad.',
    ),
  monetization: z
    .object({
      willMonetize: z
        .boolean()
        .describe('Whether this is meant to make money at all (vs. a tool/toy/loss-leader)'),
      model: z
        .string()
        .describe(
          'How it would make money if at all (subscription, one-off, ads, marketplace fee, ' +
            'free) — or why it deliberately stays free.',
        ),
      reasoning: z
        .string()
        .describe('Why that model fits this audience and this purpose'),
    })
    .describe('Whether and how the idea earns — the business soul'),
  cost: z
    .string()
    .describe(
      'A rough, honest ballpark of what it costs to BUILD and to RUN — call out the ' +
        'biggest cost drivers (e.g. per-minute STT, model calls, hosting). Prototype vs. ' +
        'production if they differ. Order-of-magnitude, not a spreadsheet.',
    ),
  features: z
    .array(z.string())
    .min(1)
    .describe(
      'The capabilities that make this real — the feature set implied by the pitch, ' +
        'each a single concrete capability. This is the WHAT, kept in service of the WHY.',
    ),
  openQuestions: z
    .array(z.string())
    .describe(
      'The unresolved tensions worth grilling on next — the soft spots in purpose, ' +
        'audience, monetization, or cost that a stress-test should attack.',
    ),
});

export type Soul = z.infer<typeof SOUL_SCHEMA>;

// Step 2 — Derive Requirements
export const REQUIREMENTS_SCHEMA = z.object({
  functional: z
    .array(z.string())
    .describe('Things the prototype must DO'),
  nonFunctional: z
    .array(z.string())
    .describe('Limits/qualities it must respect — seed from constraint-typed points'),
});

export type Requirements = z.infer<typeof REQUIREMENTS_SCHEMA>;

// Step 3 — Design Architecture
export const ARCHITECTURE_SCHEMA = z.object({
  techStack: z
    .array(z.string())
    .describe('The handful of libraries/tools the LOCALHOST PROTOTYPE runs on'),
  productionStack: z
    .array(z.string())
    .describe(
      'What you would graduate the prototype to for a real PRODUCTION deployment — ' +
        'map each prototype choice to its production-grade counterpart (hosting, ' +
        'persistence, auth, etc.). Keep it to a coherent, mainstream stack.',
    ),
  components: z
    .array(
      z.object({
        name: z.string().describe('Component name'),
        responsibility: z.string().describe('What this component is responsible for'),
      }),
    )
    .describe('The small set of parts the prototype is built from'),
  dataFlow: z
    .string()
    .describe('How data moves through the components, end to end'),
  reasoning: z
    .string()
    .describe('Why these choices — tie each back to a requirement'),
  productionNotes: z
    .string()
    .describe(
      'Short note on how the production stack differs from the prototype and why — ' +
        'what changes when moving off localhost (hosting, persistence, auth, scale).',
    ),
});

export type Architecture = z.infer<typeof ARCHITECTURE_SCHEMA>;
