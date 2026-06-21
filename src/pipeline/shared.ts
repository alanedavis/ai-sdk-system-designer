import { z } from 'zod';

// AI Models
export const SONNET = 'claude-sonnet-4-6';
export const OPUS = 'claude-opus-4-8';
export const HAIKU = 'claude-haiku-4-5'

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
