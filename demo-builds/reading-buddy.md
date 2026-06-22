# Reading Buddy

An app that listens to kids read aloud and gently helps when they get stuck, featuring a friendly character, hints for stumbled words, and a virtual bookshelf that fills up over time.

## Requirements

### Functional
- Listen to a child reading aloud in real time and detect when they stumble or pause on a word
- Display a gentle hint for the stumbled word (e.g., phonetic breakdown or first-syllable prompt) without simply reading the word aloud for them
- Show a friendly on-screen character that reacts and communicates with the child during the reading session
- Allow a book to be marked as completed and add it as a visible title on a virtual bookshelf
- Display the virtual bookshelf so the child can see all books they have finished over time
- Support loading a simple book (text content) into the reading session so the app knows which words are being read

### Non-functional
- Speech recognition runs fully on-device with no network calls at any stage of processing
- No voice audio, recordings, or derived voice data ever leave the local device
- Prototype functions entirely offline with no required internet or wifi connection
- All data (bookshelf progress, session state) is stored only in local storage on the device

## Architecture

**Prototype stack (localhost):** HTML/CSS/vanilla JavaScript (single-page app) · Web Speech API (browser-native SpeechRecognition) for on-device speech-to-text · Web Audio API (for character/visual cues only, no recording persisted) · localStorage (browser) for bookshelf and session state · Static file server: Vite dev server (or python -m http.server) on localhost

**Production stack:** React + TypeScript bundled with Vite for the PWA front end · Vosk / Whisper.cpp compiled to WASM bundled with the app for guaranteed on-device, offline speech recognition (replaces browser-dependent Web Speech API) · IndexedDB via a small wrapper (Dexie) for richer local persistence · Service Worker + PWA manifest for installable, fully-offline delivery · Static hosting (Netlify/Cloudflare Pages/S3+CloudFront) to serve the app bundle once; no backend, no user data ever leaves device

### Components
- **BookLoader** — Loads a simple book's text content (bundled JSON/txt) into the session and tokenizes it into an ordered word list the app expects to hear
- **SpeechListener** — Wraps the on-device SpeechRecognition API, streams interim transcripts, and emits recognized words plus timing/pause signals
- **StumbleDetector** — Compares recognized words against the expected word list, detects pauses or mismatches, and flags the current word as a stumble
- **HintGenerator** — Produces a gentle phonetic/first-syllable hint for a flagged word without speaking the full word aloud
- **CharacterUI** — Renders the friendly character and animates its reactions/encouragement based on session events (reading, stumble, success, completion)
- **BookshelfStore** — Reads/writes completed-book titles and session progress to localStorage and renders the virtual bookshelf
- **SessionController** — Orchestrates the reading session: advances the expected word pointer, routes stumble events to hints/character, and marks books complete

**Data flow:** At startup BookLoader reads a bundled book file and tokenizes it into an ordered expected-word list held in memory. When a session starts, SpeechListener uses the browser's on-device SpeechRecognition to turn the child's speech into interim text without sending audio anywhere. Recognized words and pause signals flow to StumbleDetector, which matches them against the expected-word pointer maintained by SessionController. On a clean match the pointer advances and CharacterUI shows encouragement; on a pause/mismatch StumbleDetector flags the word and HintGenerator produces a phonetic/first-syllable hint that CharacterUI displays (never reading the word fully). When the last word is matched, SessionController marks the book complete and BookshelfStore writes the title to localStorage; the bookshelf view re-renders from localStorage so finished books accumulate across sessions. All processing and storage stay in the browser on the device.

**Reasoning:** A single static SPA on a localhost dev server is the smallest thing that satisfies the listen/hint/character/bookshelf functional set without any backend. The browser-native SpeechRecognition (Web Speech API) gives speech-to-text that runs in the client, directly serving the 'on-device, no network' and 'no audio leaves device' requirements — we consume only transcript text and never persist or transmit audio. StumbleDetector + HintGenerator are pure client-side logic comparing transcript to the loaded book text, satisfying real-time stumble detection and the 'hint without reading the word aloud' rule. localStorage covers 'all data stored only locally' for bookshelf and session state with zero infrastructure. Bundling the book text as a static file and serving everything from a local static server means the prototype runs entirely offline with no wifi, satisfying the offline requirement. No database, server API, auth, or cloud service is introduced because no requirement asks for accounts, sharing, or multi-device sync.

**Production notes:** The biggest change is swapping the browser's Web Speech API — which in some browsers routes audio to a cloud service — for a bundled WASM recognizer (Vosk or Whisper.cpp) so the hard 'recognition fully on-device, no audio leaves device, fully offline' constraints are guaranteed regardless of browser. The app becomes an installable PWA with a Service Worker for true offline delivery, hosted as a static bundle on a CDN (the server only ships code once, never receives user data). localStorage graduates to IndexedDB/Dexie for larger bookshelves and more robust session state. No backend, database, or auth is added because the privacy constraints forbid any data leaving the device and there is no multi-user/sync requirement; those on-device and offline constraints still bind in production.

## Coding prompt

Before writing any code, stop and present the following stack options to the user, then wait for confirmation before scaffolding anything.

---

Present these three options clearly:

**Recommended default:** HTML/CSS/Vanilla JS + Web Speech API + localStorage + Vite dev server
- Single file-per-component, zero build complexity, runs with `npm create vite` or even `python -m http.server`; tradeoff: no type safety, Web Speech API behavior varies by browser (Chrome works best), and Chromium-based browsers may route audio through Google's servers in some configurations — acceptable for a prototype but see the production note below.

**Alternative A:** Same HTML/CSS/Vanilla JS stack but served with `python -m http.server` and zero npm/Node dependency
- Tradeoff: absolute minimum tooling (paste files, run one command), but no hot reload, no module bundling, and you must use `<script type="module">` with careful relative imports; good if the machine has no Node installed.

**Alternative B:** React + TypeScript + Vite (lightweight version of the production stack, minus the WASM recognizer)
- Tradeoff: closest to the production shape, easier to extend later, component model makes CharacterUI and BookshelfStore cleaner; costs more boilerplate upfront and still uses Web Speech API for now, so the same browser-routing caveat applies.

Then show this production context in one or two lines so the user sees the growth path:
> **Production path (forward-looking, not built now):** This graduates to a React/TypeScript PWA with Vosk or Whisper.cpp compiled to WASM bundled inside the app — that swap is the critical step that makes on-device, no-audio-leaves-device, and fully-offline constraints *guaranteed* regardless of browser, rather than relying on Web Speech API behavior. Persistence moves to IndexedDB/Dexie; the app ships as a static bundle from a CDN (Netlify/Cloudflare Pages); no backend is ever added because the privacy constraints forbid data leaving the device.

Then ask: "Please confirm you want the recommended default (Option 1), or choose Alternative A or B. Once you confirm, I will start with the smallest runnable slice — a single HTML page with BookLoader and SpeechListener wired together — before building out the remaining components."

Wait for the user's explicit choice. After confirmation, proceed exactly as follows.

---

**HARD CONSTRAINTS — non-negotiable regardless of chosen stack:**
1. SpeechRecognition must use the browser-native Web Speech API with `continuous: true` and `interimResults: true`; no fetch, XHR, WebSocket, or any network call is made at any point during or after recognition.
2. No audio buffer, blob, or derived transcript is ever sent off-device; the Web Audio API is used only for visual-cue timing or optional local sound effects, never for capture that leaves the device.
3. The app must load and run with no internet connection after initial file serving; use no CDN-hosted scripts or fonts — bundle or inline everything.
4. All persistent state (bookshelf, session progress) is written exclusively to `localStorage`; no external database, no backend, no sync.
5. Book content is bundled as local JSON or plain text files; no remote fetch of content.

---

**After the user confirms a stack, build in this exact incremental order — present each slice as a working checkpoint before moving to the next:**

**Slice 1 — Skeleton + BookLoader + SpeechListener (first runnable checkpoint)**
Scaffold the project structure. Create these files:
- `index.html` — single-page shell with a `<div id="app">` mount point, all CSS inlined or in a sibling `style.css`, zero external CDN links.
- `books/the-little-seed.json` — a bundled sample book as a JSON object with shape `{ "title": "The Little Seed", "pages": [{ "text": "The little seed sat in the dark soil." }, ...] }` — write at least 5 pages of simple sentences appropriate for a 5–7 year old reader; this is the only book needed for the prototype.
- `src/bookLoader.js` — exports `loadBook(url)` which fetches the local JSON file (relative path, no network), tokenizes every page's text into an ordered flat array of lowercase cleaned word strings (strip punctuation), and returns `{ title, pages, wordList }`.
- `src/speechListener.js` — exports `SpeechListener` class. Constructor accepts a callbacks object `{ onWord(word, isFinal), onPause(), onError(e) }`. Method `start()` creates `window.SpeechRecognition` (with `webkitSpeechRecognition` fallback), sets `continuous = true`, `interimResults = true`, `lang = 'en-US'`, attaches `onresult` handler that parses interim and final results and calls `onWord` for each token in the transcript, attaches a debounced 2000 ms silence timer that calls `onPause()` when no new results arrive, and calls `start()` on the recognizer. Method `stop()` aborts the recognizer and clears the timer. Hard constraint: no audio data is stored; only the string transcript is used, and it never leaves the module.

Wire Slice 1 in `index.html`: on page load, call `loadBook('./books/the-little-seed.json')`, log the word list to the console, instantiate `SpeechListener` with console-log callbacks, expose a Start button that calls `listener.start()` and a Stop button that calls `listener.stop()`. The page must work — words logged in console as the user speaks.

---

**Slice 2 — StumbleDetector + SessionController**
- `src/stumbleDetector.js` — exports `StumbleDetector` class. Constructor takes `wordList` array and a callbacks object `{ onMatch(word, index), onStumble(word, index), onComplete() }`. Maintains `expectedIndex` (starts at 0). Method `feed(recognizedWord)` normalizes the word (lowercase, strip punctuation), then: if it matches `wordList[expectedIndex]` advance `expectedIndex`, call `onMatch`, and if `expectedIndex === wordList.length` call `onComplete`; if it does not match, call `onStumble` with the expected word and index. Method `feedPause()` calls `onStumble` with the current expected word (the child paused on it). Method `reset()` sets `expectedIndex` back to 0.
- `src/sessionController.js` — exports `SessionController`. Constructor takes `{ book, onHintNeeded(word), onWordMatched(word, index), onBookComplete(title) }`. Internally creates a `StumbleDetector` and wires its callbacks: `onMatch` forwards to `onWordMatched`; `onStumble` forwards to `onHintNeeded`; `onComplete` calls `onBookComplete(book.title)`. Exposes `feedWord(w)`, `feedPause()`, `reset()`. No UI here — pure logic.

Update `index.html` to instantiate `SessionController`, pass `SpeechListener` output into it, and log hint-needed and matched events to the console. Verify in browser that reading the sample book text aloud produces correct match/stumble events.

---

**Slice 3 — HintGenerator**
- `src/hintGenerator.js` — exports `generateHint(word)` (pure function, no async, no network). Implement three tiers in order: (1) a small hardcoded lookup table of ~30 common tricky words (e.g. `"the" → "th-uh"`, `"said" → "sed"`, `"was" → "wuz"`, `"one" → "wun"`, etc.) stored as a plain JS object literal in the file; (2) if not in the table, apply a simple syllable-split algorithm: find vowel clusters (a,e,i,o,u) and split the word into chunks at consonant boundaries using a basic regex (`word.replace(/([aeiou]+)/gi, '-$1-').replace(/--/g,'-').replace(/^-|-$/g,'')`) then return the first syllable followed by `"..."` as a prompt (e.g. `"fantastic"` → `"fan..."`); (3) if the word is one syllable and not in the table, return the first two characters followed by `"..."` (e.g. `"bright"` → `"br..."`). The function must never return the full word. Add a `generateHint.test` inline comment block with 5 example input→output pairs so it is self-documenting.

Wire into `SessionController`: when `onHintNeeded` fires, call `generateHint` and log the hint alongside the word. Verify in browser.

---

**Slice 4 — CharacterUI**
- `src/characterUI.js` — exports `CharacterUI` class. Constructor takes a DOM container element. Method `init()` injects HTML into the container: a centered SVG or emoji-based friendly character (a simple owl or star face built with inline SVG — no external image files), a speech-bubble `<div class="bubble">` beside it, initially hidden. Implement these methods — each updates the bubble text and triggers a CSS animation class on the character element:
  - `showIdle()` — bubble hidden, character in neutral pose.
  - `showListening()` — bubble says "I'm listening! 👂", character has a gentle bob animation (CSS `@keyframes` bob: translate Y ±4px, 1 s infinite).
  - `showEncouragement(word)` — bubble says one of three randomly chosen phrases (`"Great job! ✨"`, `"Keep going! 🌟"`, `"You got it! 🎉"`), character does a quick scale-pulse animation.
  - `showHint(word, hint)` — bubble says `"Try starting with: **{hint}**"` (bold the hint with a `<strong>` tag), character tilts slightly (CSS rotate ±5 deg transition).
  - `showComplete()` — bubble says `"You finished the book! 🏆 Amazing!"`, character does a spin animation.
  All animations are pure CSS transitions/keyframes defined in `style.css`. No audio is played in CharacterUI; it is purely visual.

Wire into `SessionController` callbacks in `index.html`: matched → `showEncouragement`, hint needed → `showHint`, complete → `showComplete`. Start button → `showListening`. Verify visually.

---

**Slice 5 — BookshelfStore + Bookshelf UI**
- `src/bookshelfStore.js` — exports `BookshelfStore` object (plain module-level singleton, no class needed). Implement:
  - `addBook(title)` — reads `localStorage.getItem('reading_buddy_shelf')`, parses JSON (default `[]`), pushes `{ title, completedAt: new Date().toISOString() }` if title not already present, writes back with `localStorage.setItem`.
  - `getBooks()` — reads and parses the same key, returns array (or `[]` on parse error).
  - `clear()` — removes the key (useful for dev reset).

- In `index.html`, add a `<section id="bookshelf">` below the reading area. Write a `renderBookshelf()` function that calls `BookshelfStore.getBooks()` and for each entry appends a `<div class="shelf-book">` containing a small book-spine rectangle (CSS: fixed width 40px, height 80px, random pastel background from a fixed palette of 6 colors cycled by index, rotated ±3 deg alternating, `title` written vertically using `writing-mode: vertical-rl`) inside a `<div class="shelf">` styled as a wooden shelf (brown border-bottom). Call `renderBookshelf()` on page load and again inside `onBookComplete` after `BookshelfStore.addBook`.

Wire `onBookComplete` in `SessionController` to also call `BookshelfStore.addBook(title)` then `renderBookshelf()`. Verify that completing the book adds it to the shelf and it persists on page reload.

---

**Slice 6 — Full UI polish and session flow**
Assemble the complete single-page layout in `index.html` and `style.css`:
- Top: app title "Reading Buddy 📚" in a large, friendly rounded font (use a system font stack: `'Comic Sans MS', 'Chalkboard SE', cursive` — no Google Fonts fetch).
- Middle-left: the open book view — display the current page's text with the **expected next word highlighted** in yellow via a `<span class="current-word">` that SessionController updates on each match by re-rendering the page text (split into `<span>` per word, add class to `expectedIndex`'s span).
- Middle-right: CharacterUI container.
- Below book: Start Reading / Stop buttons; a "Mark Complete" button visible only when the last word is matched (alternatively auto-fires from `onComplete`).
- Bottom: the bookshelf section.
- Add a simple book-select `<select>` that for now lists only "The Little Seed" (with value pointing to `./books/the-little-seed.json`) — this makes it easy to add more books later by adding JSON files and `<option>` tags.
- Ensure the layout is responsive enough to be usable on a tablet in landscape mode (basic flexbox, no framework).
- Add a `<noscript>` warning and a startup check: if `window.SpeechRecognition === undefined && window.webkitSpeechRecognition === undefined`, display a visible error banner: "Sorry, your browser doesn't support on-device speech recognition. Please try Chrome or Edge." and disable the Start button. Do not fall back to any network-based alternative.
- Add a small `<footer>` note: "All speech processing happens on your device. No audio ever leaves this app."

---

**Final checklist before declaring done — verify each item:**
1. `[ ]` App loads and runs with no internet connection (disable wifi, reload — everything works).
2. `[ ]` No outbound network requests visible in DevTools Network tab during a reading session (filter for XHR/Fetch/WS — should be empty after initial file load).
3. `[ ]` Speaking the sample book's words aloud advances the highlighted word correctly.
4. `[ ]` Pausing on a word for 2 seconds triggers a hint in the speech bubble.
5. `[ ]` Hint is never the full word — always a partial prompt.
6. `[ ]` Completing all words triggers the completion animation and adds the book to the shelf.
7. `[ ]` Shelf persists across page reloads (check localStorage in DevTools → Application → Local Storage).
8. `[ ]` No audio blobs, buffers, or recordings are stored anywhere (no `MediaRecorder`, no `createObjectURL` for audio, no IndexedDB audio entries).
9. `[ ]` The unsupported-browser banner appears when SpeechRecognition is unavailable (test by temporarily renaming `window.SpeechRecognition` in console).
10. `[ ]` All asset paths are relative; no `https://` URLs appear anywhere in the source.
