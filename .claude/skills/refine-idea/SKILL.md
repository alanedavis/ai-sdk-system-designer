---
name: refine-idea
description: Turn a brainstorm recording into a soul draft ready to grill. Transcribes an audio file (with speaker labels), extracts the distinct ideas, and auto-drafts the "soul" of each — why it exists, who it's for, whether to monetize, rough cost, and features — then hands off to /grill-with-docs. Use when the user wants to refine a recorded idea, process an audio brainstorm, "refine this recording", or runs /refine-idea.
---

<what-to-do>

Turn a recording into a grill-ready soul draft, then hand off. Concretely:

1. **Find the audio file.** Use the path the user gave. If none, look in `recordings/` and offer the most recent audio file (`.m4a`, `.wav`, `.mp3`, `.flac`, `.ogg`); confirm before proceeding. If `recordings/` is empty, ask where the recording is.

2. **Run the refine step:** `npm run refine <audio-path>`. This is the engine — it transcribes (diarized), extracts pitches, and writes three fixed-path artifacts: `refine/transcript.txt`, `refine/pitches.json`, and `refine/soul-draft.md`. It needs `ASSEMBLYAI_API_KEY` in `.env`; if the run fails on a missing key, point the user to `.env.example`.

3. **Read `refine/soul-draft.md`** and give the user a short, honest summary of each endorsed idea's soul (purpose · audience · monetization · cost) and how many ideas were extracted vs. skipped. Don't dump the whole file — highlight the soul and the sharpest open questions.

4. **Hand off to the grill.** Tell the user the draft is ready at `refine/soul-draft.md` and that running **`/grill-with-docs`** will interrogate it (the draft has baked-in instructions steering that session). Then, once the soul is solid, **`/plan-from-soul`** turns it into a build plan.

Do NOT run the build pipeline here — that's `/plan-from-soul`'s job. This skill's single responsibility is recording → soul draft.

</what-to-do>

<supporting-info>

- The whole flow: **record → `/refine-idea` → `/grill-with-docs` → `/plan-from-soul`**.
- Fixed artifact paths (defined in `src/paths.ts`): `refine/transcript.txt`, `refine/pitches.json`, `refine/soul-draft.md`, and — after grilling — `refine/soul-final.md`.
- The soul draft is a *starting point*, not a spec. It's deliberately opinionated so the grilling session has something concrete to attack.
- "Soul" = the human/business core: **why** it exists, **who** it's for, whether/how to **monetize**, rough **cost**, and the **features** that serve the why — plus open questions to grill.
- Only *endorsed* ideas get a soul drafted (same gate the build pipeline uses). If nothing was endorsed, say so plainly rather than inventing enthusiasm.

</supporting-info>
