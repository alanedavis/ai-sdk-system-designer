import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { SONNET, BASE_PITCH_SCHEMA, FULL_PITCH_SCHEMA } from './shared';

// Types
export type Mode = 'minimal' | 'full'
export type Pitch = z.infer<typeof BASE_PITCH_SCHEMA>;
export type DetailedPitch = z.infer<typeof FULL_PITCH_SCHEMA>;

// Interfaces
export interface Options {
    mode?: Mode;
    model?: string;
    keepRejected?: boolean;
}

export interface ExtractPitches {
  (transcript: string, opts?: { mode?: 'minimal'; model?: string, keepRejected?: boolean }): Promise<Pitch[]>;
  (transcript: string, opts: { mode: 'full'; model?: string, keepRejected?: boolean }): Promise<DetailedPitch[]>;
}

// System consts
const SHARED = `You analyze a brainstorm transcript. A single call often contains
SEVERAL distinct project pitches — treat each separate project as its own pitch and
never merge two different projects into one. Work from the WHOLE conversation. Keep
each pitch at the level of a product concept, not a single feature. Capture things
faithfully; do not invent. The transcript may have many speakers or just one — do not
rely on speaker turns to find the pitches.`;
 
const MINIMAL_SYS = `${SHARED}
For each pitch, return just its name and a one or two sentence summary.`;
 
const FULL_SYS = `${SHARED}
For each pitch also determine:

- status — where the GROUP landed by the END of the call. People almost never state
  this outright; infer it from how they react:
    endorsed  — clear enthusiasm or a decision to build it ("let's do it", "I'm in",
                moving on to who-does-what).
    rejected  — shut down, INCLUDING passively: sarcasm, "isn't that just <X> already?",
                a flat "sure, I guess", or deflecting to the next topic without really
                engaging. Low energy plus a subject change is a rejection, not a park.
    parked    — deferred while still liked ("let's circle back", "not now", "down the
                line"). The group wants it later; they're just not starting it now.
    discussed — genuinely debated but with no clear landing either way.
    proposed  — raised but barely engaged with.
  The key distinction is rejected (they don't want it) vs parked (they want it later).
 
- confidence — "clear" if the pitch was put forward firmly with a real case;
  "tentative" if hedged ("I don't really have a case for it, but...").
 
- points — the distinct things raised while discussing this pitch, each typed as
  feature / constraint / question / tangent. A constraint counts even when said
  casually ("it has to work without wifi"). A tangent is off-topic chatter.
 
- sourceQuotes — the verbatim line(s) that justify your status call.
 
If something is genuinely ambiguous, pick the most defensible reading and let the
quote justify it. Never fabricate a value just to fill a field.`;


// Functions
export const extractPitchesImpl = async (
    transcript: string,
    opts: Options = {},
): Promise<Pitch[] | DetailedPitch[]> => {
    const { mode = 'minimal', model = SONNET, keepRejected = false } = opts;

    const pitchShape = mode === 'full' ? FULL_PITCH_SCHEMA : BASE_PITCH_SCHEMA;
    const system = mode === 'full' ? FULL_SYS : MINIMAL_SYS;

    const { output } = await generateText({
        model: anthropic(model),
        system,
        prompt: `Identify the distinct project pitches in this transcript and analyze each:\n\n${transcript}`,
        output: Output.object({
            schema: z.object({ pitches: z.array(pitchShape).min(1) }),
        }),
    });

    // Drop pitches the group clearly rejected, unless the caller asked to keep them.
    // `status` only exists in full mode, so this is a no-op for minimal extractions.
    if (!keepRejected && mode === 'full') {
        return (output.pitches as DetailedPitch[]).filter((p) => p.status !== 'rejected');
    }

    return output.pitches;
}

export const extractPitches = extractPitchesImpl as ExtractPitches