import { AssemblyAI } from 'assemblyai';
import { ASSEMBLYAI_MODELS } from './shared';

// ─────────────────────────────────────────────────────────────────────────────
// STEP 0 — TRANSCRIBE
// Audio file → a speaker-attributed transcript in the same `Speaker  HH:MM:SS` shape
// `extractPitches` already consumes, so a raw recording can go end-to-end without a
// manual export step.
//
// Convention exception: this is the one stage that does NOT go through the Vercel AI
// SDK. Anthropic has no speech-to-text model, and — as of `@ai-sdk/assemblyai` 3.0.2 —
// the AI SDK's `experimental_transcribe` normalizes results to word-level `segments`
// only and DROPS AssemblyAI's diarized `utterances`, so speaker labels can't survive
// that path. To keep "who spoke," Step 0 talks to AssemblyAI's own SDK directly and
// reads `utterances`, then folds them into the line format Step 1 expects.
// ─────────────────────────────────────────────────────────────────────────────

export interface Options {
  /** Preference-ordered transcription models on AssemblyAI (default `ASSEMBLYAI_MODELS`). */
  models?: readonly string[];
  /** Attribute each turn to a speaker (default `true`). */
  diarize?: boolean;
  /** Hint for how many distinct speakers to expect — improves diarization. */
  speakersExpected?: number;
  /** Optional ISO-639-1 language hint; otherwise AssemblyAI autodetects. */
  language?: string;
}

// Seconds (may be fractional) → `HH:MM:SS`, matching the Zoom timestamp format.
export function secondsToClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

// A single diarized turn: who spoke, when (ms), and what they said.
type Utterance = { speaker: string; text: string; start: number };

// Fold diarized utterances into the `Speaker <X>  HH:MM:SS\n<turn>` blocks Step 1 reads.
// `start` arrives in milliseconds from AssemblyAI, so divide before formatting.
export function formatAsTranscript(utterances: Utterance[]): string {
  const header = [
    'Product Brainstorm — Recording',
    'Transcribed by AssemblyAI (speaker diarization)',
    '',
  ].join('\n');

  const body = utterances
    .map((u) => `Speaker ${u.speaker}  ${secondsToClock(u.start / 1000)}\n${u.text.trim()}`)
    .join('\n\n');

  return `${header}\n${body}\n`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio file → formatted transcript. End-to-end: recording → transcript → pitches.
// ─────────────────────────────────────────────────────────────────────────────
export async function transcribeAudio(path: string, opts: Options = {}): Promise<string> {
  const { models = ASSEMBLYAI_MODELS, diarize = true, speakersExpected, language } = opts;

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'ASSEMBLYAI_API_KEY is not set. Add it to .env (see .env.example) — Step 0 needs a ' +
        'diarization-capable STT provider since Anthropic has no speech-to-text model.',
    );
  }

  const client = new AssemblyAI({ apiKey });

  // `audio` accepts a local file path; the SDK uploads it and polls until completion.
  const transcript = await client.transcripts.transcribe({
    audio: path,
    speech_models: models as string[],
    speaker_labels: diarize,
    ...(speakersExpected ? { speakers_expected: speakersExpected } : {}),
    ...(language ? { language_code: language } : {}),
  });

  if (transcript.status === 'error') {
    throw new Error(`Transcription failed: ${transcript.error ?? 'unknown error'}`);
  }

  // Diarized turns are the goal; fall back to the flat text if diarization is unavailable
  // (e.g. a single continuous speaker with `diarize: false`).
  if (diarize && transcript.utterances?.length) {
    return formatAsTranscript(transcript.utterances);
  }

  return [
    'Product Brainstorm — Recording',
    'Transcribed by AssemblyAI',
    '',
    transcript.text ?? '',
    '',
  ].join('\n');
}
