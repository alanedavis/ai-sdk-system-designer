# On-Demand Dog Walking App

An app for booking on-demand dog walkers that shows a live GPS trail of the walk and sends photos at the end, with same-walker-every-time as a trust differentiator.

## Requirements

### Functional
- Match an owner with an available nearby walker for an on-demand booking
- Display a live GPS breadcrumb trail on a map that updates in real time as the walker moves
- Record and store the walked route so the owner can review it after the walk ends
- Send end-of-walk photos from the walker to the owner within the app
- Allow an owner to mark a preferred walker so that walker is prioritised for future bookings
- Show a walker profile page including vetting status and past walks with that owner

### Non-functional
- Walker vetting status is a required data field before a walker appears as bookable — unvetted walkers must not be surfaceable
- Insurance coverage state is recorded per walker and displayed to the owner before booking confirmation
- GPS location data is transmitted only to the logged-in owner of the dog being walked, not visible to other users
- All route and photo data is stored locally on localhost; no third-party cloud storage is used in the prototype
- Live GPS updates render within 5 seconds of the walker's position changing
- The prototype runs entirely offline-capable after initial load, relying on a local server only

## Architecture

**Prototype stack (localhost):** Node.js + Express (local HTTP + WebSocket server) · ws (WebSocket library for real-time GPS push) · SQLite (single local file via better-sqlite3) · Leaflet.js + OpenStreetMap tiles cached locally · Vanilla JS + HTML/CSS frontend served by Express · Multer (local disk handling of end-of-walk photo uploads)

**Production stack:** Managed container host (AWS ECS/Fargate or Fly.io) behind HTTPS · Managed Postgres with PostGIS for geo queries and route storage · Managed real-time layer (Pusher or a hosted WebSocket service / Redis pub-sub) · S3 (or equivalent) for photo and route blob storage with signed URLs · Auth provider (Auth0/Cognito) with per-user JWT sessions · Hosted map tiles (Mapbox) and background location SDK on native mobile clients

### Components
- **Local API + WebSocket Server** — Express server handling bookings, walker matching, profile/vetting/insurance reads, and a ws channel that relays each GPS point only to the socket of the dog's logged-in owner
- **SQLite Data Store** — Single local file holding walkers (with required vetting + insurance fields), owners, preferred-walker flags, bookings, and recorded route point sequences
- **Local Photo Store** — Disk folder under the server where walker-submitted end-of-walk photos are written and served back only to the owning owner
- **Walker Web Client** — Simulates/sends the walker's GPS position over WebSocket on an interval and uploads end-of-walk photos
- **Owner Web Client** — Browses vetted walkers, confirms bookings after seeing insurance state, renders the live Leaflet breadcrumb trail, marks a preferred walker, and reviews stored route + photos after the walk

**Data flow:** On load, the owner client fetches bookable walkers from the Express API; the API filters SQLite so only rows with a set vetting status are returned, and includes insurance state shown before booking confirmation. On booking, a record links owner, dog, and walker. During the walk the walker client emits GPS points over WebSocket; the server tags each point to the booking, appends it to the route table in SQLite, and pushes it only down the socket belonging to that booking's logged-in owner, which Leaflet renders as a growing breadcrumb trail. At walk end the walker uploads photos via a multipart POST; Multer writes them to the local disk folder and stores file paths against the booking. Afterward the owner client requests the stored route points and photo paths to replay the route and view images. Marking a preferred walker sets a flag in SQLite that reorders future match results.

**Reasoning:** Express + ws gives real-time push with no cloud, satisfying live-trail-within-5-seconds by pushing each point as it arrives rather than polling. Routing GPS only down the owning owner's socket enforces the privacy requirement that location is visible solely to the logged-in owner. SQLite is a single local file that holds vetting status as a queryable required column, so the API can structurally exclude unvetted walkers from bookable lists, and stores insurance state for pre-confirmation display plus the route points for post-walk review. Local disk via Multer keeps all photo and route data on localhost with no third-party cloud, meeting the storage constraint. Serving the frontend, Leaflet, and locally cached tiles from the same Express process means everything runs against the local server only and stays usable offline after first load.

**Production notes:** Moving off localhost: the single Express+ws process splits into a hosted, HTTPS-terminated service with a managed real-time layer (or Redis-backed WebSockets) so updates survive multiple instances; SQLite graduates to Postgres+PostGIS for concurrent access and real proximity matching; local disk photos move to S3 with signed, owner-scoped URLs; and ad-hoc session checks become a real auth provider issuing JWTs. The hard constraints still bind in production: vetting status remains a required field gating bookability, insurance state must be shown before confirmation, and GPS must stay scoped to the single owning owner — the privacy guarantee just moves from in-process socket routing to authenticated, per-booking authorization, and 'offline after load' relaxes since clients now depend on remote services.

## Coding prompt

Before writing any code, stop and present the following to the user, then wait for confirmation before proceeding.

---

**Confirm your prototype stack before any scaffolding begins.**

**Recommended default (what this prompt was designed around):**
Node.js + Express + ws + SQLite (better-sqlite3) + Leaflet.js/OpenStreetMap + Vanilla JS + Multer — simple, zero-dependency localhost stack; everything runs in one process with one file database and local disk storage; ideal for rapid prototyping but does not scale beyond a single process.

**Alternative A:**
Node.js + Fastify + Socket.io + SQLite + Leaflet.js + Vanilla JS + Multer — drop-in swap of Express→Fastify and ws→Socket.io; Socket.io adds automatic reconnection and room-based broadcasting (cleaner privacy routing) at the cost of a heavier client bundle; same single-process constraint applies.

**Alternative B:**
Python + FastAPI + WebSockets (built-in) + SQLite (aiosqlite) + Leaflet.js + Vanilla JS + aiofiles — async Python instead of Node; familiar to Python-first teams and shares the same single-file DB and local disk approach; slightly more boilerplate for the WebSocket GPS relay but no new runtime to install if Python is already present.

All three satisfy every hard constraint: vetting gate, insurance display before confirmation, GPS scoped to the owning owner's socket only, all data local, sub-5-second GPS render, offline-capable after initial load.

**Production growth path (forward-looking context only — you are not building this now):**
This prototype graduates to a containerised service (AWS ECS/Fargate or Fly.io) behind HTTPS, with Postgres+PostGIS replacing SQLite, a managed real-time layer (Pusher or Redis-backed WebSockets) replacing the single ws process, S3 with owner-scoped signed URLs replacing local disk photos, and Auth0/Cognito issuing JWTs replacing the in-process session checks. The hard constraints carry forward: vetting remains a required bookability gate, insurance must be shown pre-confirmation, and GPS privacy moves from in-process socket routing to per-booking JWT authorization.

**Confirm the recommended default or name your alternative, and scaffolding will begin.**

---

Once the user confirms a stack, proceed exactly as follows. Start with the smallest runnable slice — the server booting, the database initialising with seed data, and a single HTML page confirming the connection — before building any other component. Do not scaffold the full system in one pass.

---

You are building a localhost prototype of an on-demand dog walking app. The confirmed stack is Node.js + Express + ws + SQLite (better-sqlite3) + Leaflet.js with locally cached OpenStreetMap tiles + Vanilla JS/HTML/CSS + Multer. Every hard constraint below is non-negotiable and must be enforced at the code level, not by convention.

**Hard constraints — enforce these in code, not comments:**
1. Any API endpoint or query that returns bookable walkers must filter on `vetting_status = 'approved'`; a walker without this value must never appear in any bookable listing, full stop.
2. The booking confirmation flow must fetch and display each walker's `insurance_state` field to the owner before any booking record is created; the POST to create a booking must be blocked client-side until the owner has seen and acknowledged the insurance screen.
3. GPS location points are transmitted exclusively to the WebSocket connection that belongs to the booking's logged-in owner; the server must check `booking.owner_id === socket.owner_id` before pushing any point; no broadcast, no room shortcut that could leak to another owner.
4. All route points and photos are persisted to the local SQLite file and a local `uploads/` disk folder respectively; no outbound HTTP calls to any external storage service.
5. All GPS breadcrumb updates must render on the owner's Leaflet map within 5 seconds of the walker emitting the point; the WebSocket relay must not buffer or batch points.
6. After initial page load, the app must function using only the local Express server; no CDN calls; Leaflet and OpenStreetMap tiles must be served locally.

---

**Project layout to scaffold (build slice by slice, smallest first):**

```
dogwalker/
├── server/
│   ├── index.js          # Express + ws server, single entry point
│   ├── db.js             # better-sqlite3 init, schema creation, seed data
│   ├── routes/
│   │   ├── walkers.js    # GET /api/walkers (vetted only), GET /api/walkers/:id (profile, vetting, insurance, past walks with owner)
│   │   ├── bookings.js   # POST /api/bookings (insurance ack required in body), GET /api/bookings/:id/route, GET /api/bookings/:id/photos
│   │   └── preferences.js# POST /api/owners/:id/preferred-walker
│   ├── ws.js             # WebSocket handler: GPS relay scoped per booking/owner, route point persistence
│   └── uploads/          # Multer destination for end-of-walk photos
├── public/
│   ├── owner/
│   │   └── index.html    # Owner client: walker browse, insurance ack, booking, live map, post-walk review, preferred walker
│   ├── walker/
│   │   └── index.html    # Walker client: simulated GPS emission, end-of-walk photo upload
│   ├── leaflet/          # Leaflet JS + CSS served locally (copy from node_modules or vendor)
│   └── tiles/            # Locally cached OSM tile set (seed script or static tile pack)
└── package.json
```

---

**Slice 1 — build this first and stop for confirmation:**

Scaffold `package.json`, `server/db.js`, and `server/index.js` only.

`package.json`: dependencies are `express`, `better-sqlite3`, `ws`, `multer`. No others needed for the prototype.

`server/db.js`:
- Open or create `dogwalker.sqlite` in the project root.
- Create these tables if they do not exist:
  - `walkers`: `id INTEGER PK`, `name TEXT`, `vetting_status TEXT` (only `'approved'` makes a walker bookable — enforce this in every query, never in application logic alone), `insurance_state TEXT`, `bio TEXT`, `total_walks INTEGER DEFAULT 0`.
  - `owners`: `id INTEGER PK`, `name TEXT`, `session_token TEXT` (a simple random string used to authenticate WebSocket connections in the prototype — not a production auth system).
  - `dogs`: `id INTEGER PK`, `owner_id INTEGER FK owners`, `name TEXT`, `breed TEXT`.
  - `bookings`: `id INTEGER PK`, `owner_id INTEGER FK owners`, `dog_id INTEGER FK dogs`, `walker_id INTEGER FK walkers`, `status TEXT DEFAULT 'pending'` (values: `pending`, `active`, `completed`), `insurance_acknowledged INTEGER DEFAULT 0` (must be `1` before status can advance past `pending`), `created_at TEXT`.
  - `route_points`: `id INTEGER PK`, `booking_id INTEGER FK bookings`, `lat REAL`, `lng REAL`, `recorded_at TEXT`.
  - `photos`: `id INTEGER PK`, `booking_id INTEGER FK bookings`, `file_path TEXT`, `uploaded_at TEXT`.
  - `preferred_walkers`: `owner_id INTEGER FK owners`, `walker_id INTEGER FK walkers`, `set_at TEXT`, PRIMARY KEY `(owner_id, walker_id)`.
- Seed with: 2 owners (each with a `session_token`), 1 dog per owner, 3 walkers (2 with `vetting_status = 'approved'` and distinct `insurance_state` values, 1 with `vetting_status = 'pending'` — this third walker must never appear in any bookable listing), and 0 bookings.
- Export the `db` instance.

`server/index.js`:
- Create an Express app, attach a `ws` WebSocket server to the same HTTP server.
- Serve `public/` as static files.
- Mount route files (stubs are fine at this stage — just return `{ ok: true }`).
- On WebSocket connection, expect the client to send `{ type: 'auth', session_token, booking_id }` as the first message; look up the owner by `session_token` in SQLite, store `socket.owner_id` and `socket.booking_id` on the socket object; reject and close if no match. Log the authenticated owner's name.
- Start the HTTP server on port 3000 and print `Dogwalker server running on http://localhost:3000`.

After Slice 1 is working (server starts, DB initialises, static files serve, WebSocket auth handshake logs correctly), confirm before moving to Slice 2.

---

**Slice 2 — Walker API and Owner browse UI:**

`server/routes/walkers.js`:
- `GET /api/walkers?owner_id=X`: Query SQLite for `WHERE vetting_status = 'approved'`. Left join `preferred_walkers` for the given `owner_id`; order results so preferred walkers appear first. Return `id`, `name`, `vetting_status`, `insurance_state`, `bio`, `total_walks`, `is_preferred` (boolean). Never return a walker without `vetting_status = 'approved'` regardless of any query parameter.
- `GET /api/walkers/:id?owner_id=X`: Return full walker profile including `vetting_status`, `insurance_state`, `bio`, `total_walks`, and an array of past walks (bookings where `walker_id = :id AND owner_id = X AND status = 'completed'`) with `date` and `route_point_count`.

`public/owner/index.html` — Walker Browse Screen:
- On load, call `GET /api/walkers?owner_id=1` (hardcoded to owner 1 for the prototype; note this in a comment).
- Render a card per walker showing name, vetting badge (`✓ Vetted`), insurance state, preferred indicator, and a `Book` button.
- Clicking `Book` does NOT immediately book; it opens an Insurance Acknowledgement panel that shows the walker's `insurance_state` in full and requires the owner to click `I understand — confirm booking`. Only after this click does the client proceed to create a booking. This gate must exist in the UI code and must pass `insurance_acknowledged: 1` in the POST body.
- Show a `View Profile` link per card that calls `GET /api/walkers/:id` and renders a profile overlay: bio, vetting status, insurance state, and a list of past walks with that owner.

---

**Slice 3 — Booking creation and WebSocket GPS relay:**

`server/routes/bookings.js`:
- `POST /api/bookings`: Accept `{ owner_id, dog_id, walker_id, insurance_acknowledged }`. If `insurance_acknowledged !== 1`, return HTTP 400 with `{ error: 'Insurance acknowledgement required' }`. Check `walker.vetting_status = 'approved'` again server-side; reject if not. Insert booking with `status = 'active'` and `insurance_acknowledged = 1`. Return the new booking id.
- `GET /api/bookings/:id/route`: Return all `route_points` for this booking ordered by `recorded_at`. Enforce ownership: look up `booking.owner_id` and compare to a passed `owner_id` query param; return 403 if mismatch (prototype-level auth).
- `GET /api/bookings/:id/photos`: Return photo file paths for this booking. Same ownership check.

`server/ws.js` — GPS relay (this is the privacy-critical path):
- After auth handshake (from Slice 1), handle incoming messages of type `gps_point`: `{ type: 'gps_point', booking_id, lat, lng }`.
- On receipt: insert a `route_points` row immediately (no batching). Then find the WebSocket connection whose `socket.booking_id === booking_id AND socket.owner_id === booking's owner_id`. Push `{ type: 'gps_point', lat, lng, recorded_at }` to exactly that socket and no other. If no matching owner socket is connected, the point is still persisted — it is not dropped.
- Walker sockets send GPS; owner sockets receive it. A walker socket must not receive GPS points. Enforce this by socket role, not by trust.

`public/walker/index.html` — Walker Client:
- Connect to WebSocket with `{ type: 'auth', session_token: 'walker-token-1', booking_id: <active booking id> }` (use a hardcoded seed token; note this).
- On a `Start Walk` button click, begin emitting `gps_point` messages every 3 seconds with slightly randomised lat/lng movement from a fixed starting coordinate (simulating a walk).
- Show a `End Walk + Upload Photos` section: a file input accepting multiple images and a submit button that POSTs to `POST /api/bookings/:id/photos` as `multipart/form-data`. After upload, stop GPS emission and mark the walk complete via `PATCH /api/bookings/:id/status` with `{ status: 'completed' }`.
- Add `PATCH /api/bookings/:id/status` to the bookings router.

`public/owner/index.html` — add Live Map Screen:
- After booking confirmation, show a Leaflet map (served from `public/leaflet/`, tiles from `public/tiles/`).
- Connect WebSocket with `{ type: 'auth', session_token: 'owner-token-1', booking_id }`.
- On each incoming `gps_point` message, append a circle marker to the map and extend a polyline — this is the breadcrumb trail. The point must render within 5 seconds of emission; no debounce or batching on the client render path.
- After walk completes, show a `Review Walk` button that calls `GET /api/bookings/:id/route` to replay the full polyline and `GET /api/bookings/:id/photos` to display the end-of-walk images inline.

---

**Slice 4 — Preferred walker and walker profile completion:**

`server/routes/preferences.js`:
- `POST /api/owners/:id/preferred-walker`: Accept `{ walker_id }`. Upsert into `preferred_walkers`. Return `{ ok: true }`.
- `DELETE /api/owners/:id/preferred-walker/:walker_id`: Remove the preference row. Return `{ ok: true }`.

`public/owner/index.html`:
- On each walker card and on the profile overlay, show a toggle: `★ Set as Preferred` / `★ Remove Preferred`. Clicking calls the POST or DELETE endpoint and refreshes the walker list so the preferred walker rises to the top.

---

**Tile caching note — address this explicitly:**
In `public/tiles/`, either: (a) include a small shell script `scripts/cache-tiles.sh` that uses `curl` to download a bounding-box tile set from `tile.openstreetmap.org` at zoom levels 13–16 for a hardcoded demo area (e.g. London 51.49–51.52, -0.13–0.09) and writes them into `public/tiles/{z}/{x}/{y}.png`; or (b) configure Leaflet's `TileLayer` to use `public/tiles/{z}/{x}/{y}.png` with `offline: true` and document in a comment that tiles must be pre-downloaded before offline use. Either approach must mean that after initial tile download, the map renders with zero external HTTP calls.

---

**Photo serving:**
Add an Express static route `app.use('/uploads', express.static(path.join(__dirname, 'uploads')))`. When returning photo paths from the API, return them as `/uploads/<filename>` so the owner client can render them as `<img src="/uploads/...">` with no external calls.

**Multer configuration:**
Store all uploads in `server/uploads/`. Generate filenames as `<booking_id>-<timestamp>-<originalname>`. Do not accept files larger than 10 MB. Accept only `image/jpeg` and `image/png` MIME types; reject others with HTTP 400.

---

**Session/auth note (prototype scope):**
The `session_token` in SQLite is a plain random string from the seed data. It is used only to associate a WebSocket connection with an owner or walker. It is not a production auth mechanism. Note this prominently in `db.js` and `ws.js`. In production this would be a signed JWT validated against an auth provider.

---

Build slice by slice. After each slice, confirm the server starts cleanly, the relevant endpoints or UI elements work, and the hard constraints are visibly enforced in the code before proceeding to the next slice.
