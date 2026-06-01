---
name: gallery
description: Build a one-page "demo gallery" that launches all of a person's projects at once, each on its own non-conflicting port, with per-app cover art, start/stop controls, and drag-to-reorder. Use when someone says "make a gallery of my projects", "I want to demo everything I've built", "set up the demo launcher", "gallery my apps", or wants a single page to show + run a folder of projects (e.g. for an office demo day where people walk by and ask for demos).
---

# Gallery — a launcher for everything you've built

This skill turns a folder of projects into a single, beautiful, editorial
(FYRRE-style) web page that can **start and stop every project at once**, each
on its **own dedicated port** so the whole fleet runs simultaneously without
colliding. Each project gets a square, full-color "cover plate" that captures
its essence, plus per-card Start/Stop, an Open link, live status, logs, and
**drag-to-reorder** (swap mechanic, animated, persisted).

The goal (the reason this exists): a room full of people each want to **display
everything they've built** and **quickly demo the most appropriate thing** when
a visitor walks up. So setup must be fast, and the result must look great and
"just run."

## The product you're assembling

A copy of `template/` (sibling to this skill) configured for the user's
projects:

```
<gallery-dir>/
  server.js, index.html, projects.js, lib/   ← copied verbatim from template/
  gallery.config.json                          ← YOU generate this
  thumbnails.js                                ← seeded with monograms, then essence art
  package.json
```

Run with `node server.js`; opens at the control port (default 4000).

## Procedure

Follow these steps. Keep the user in the loop at the confirm step, but don't
over-ask — propose sensible defaults and let them edit.

### 1. Ask what to include

Ask the user (concise, one round):
- **Which directory** holds the projects? (e.g. `~/projects`, `~/gauntletai`)
- **Which projects** in it to include — all runnable subfolders, or a specific
  list? (Offer "all of them" as the default.)
- **Where** should the gallery be created? Default: a new `demo-gallery/` (or
  `gallery/`) folder inside that directory.
- Optional: a **title** for the masthead (default "Gauntlet Gallery").

If they already told you the directory/projects in their message, skip asking
that part.

### 2. Inspect each project

For each chosen project subfolder, determine **how to launch its dev server**
and **what port it defaults to**. Use the helper:

```bash
node <gallery-dir-or-template>/lib/inspect.js <absolute-project-dir>
```

It detects Vite, Next.js, CRA, Vue-CLI, Astro, SvelteKit, generic npm
dev/start, Python (FastAPI/uvicorn, Flask, Django), and static sites. It returns
a proposed `procs` array PLUS the fields that keep you from breaking CORS:
- `defaultPort` — the framework's default.
- `nativePort` — the port to **keep** (a pinned port if found, else the default).
- `pinnedPorts` — ports hardcoded somewhere that other things depend on (a CORS
  allowlist, a dev-proxy target, a `server.port`, an OAuth redirect, a `.env`).
- `originHits` — which files pin an origin/port.

Treat the procs as a **starting guess** and verify against reality:
- Read `package.json` `scripts` and any `vite.config.*` / `next.config.*` for a
  hardcoded port or a dev proxy.
- Read the README / entry file to write a good `essence` (2–4 sentences on what
  the app does), pick a `category` (one short word: WEB, GAME, AGENT, EVAL…) and
  an `accent` color.
- **Multi-process apps** (web + api, a monorepo `apps/*`): list every process in
  `procs`; set `readyPort` to the one you open in the browser. If a frontend
  dev-proxy hardcodes a backend port, run the backend on **exactly** that port.
- **Backends/dependencies — prefer to launch them.** If you can find a reliable
  start command, add the backend as a normal `proc` so the gallery launches it
  alongside the frontend. Every port chip is clickable: clicking a down chip
  starts that proc. A backend often has its own port in config (not args) — set
  `port` on its proc def so its chip polls the right port (e.g. Spring's `:8080`
  from `application.yml`).
  - **Runtime mismatch is solvable, not a blocker.** If the project needs a
    different runtime than what's on PATH (e.g. a Spring Boot 3 service needs
    JDK 17+ but `java` is 8, or a Python service needs a venv), don't give up —
    point the proc at the right runtime via its `env`:
    `env: { "JAVA_HOME": "/opt/homebrew/opt/openjdk@21/.../Home" }`, or use the
    venv's interpreter as `cmd`. Install the runtime first if missing
    (`brew install openjdk@21`), confirm it boots manually once, then wire it.
  - **Heavy deps (DB/auth):** check if they're already satisfied before assuming
    they block. A local Postgres may already be running with the right DB; an
    app's `dev` profile may skip real auth (a dev-token/header path). Match the
    project's documented dev setup (its brief/README) — profile flags, a dev
    secret env var, a frontend dev-token — so data actually loads, not just the
    process boots.
  - A `watchPort` with a launch spec also starts on click:
    `"watchPorts": [{ "label": "api", "port": 8080, "cmd": "./mvnw", "args": ["spring-boot:run"], "cwd": "/abs/backend" }]`
  - Only when a dependency is genuinely external/unprovisionable — leave off
    `cmd` and add a `startHint`:
    `{ "label": "db", "port": 5432, "startHint": "start postgres yourself" }`.
    The gallery polls it, shows a dashed chip, and clicking it surfaces + copies
    that command instead of launching.
- **Data deps** (Postgres/Docker, a `.env` with keys): add to `watchPorts` if
  there's a port worth showing (e.g. Postgres `:5432`), and note them; don't
  try to provision them.

**Never edit the user's project files.** Express every port override as a CLI
flag or env var in `procs` (Vite `--port N --strictPort`; Next `-p N`; CRA /
Express `PORT=N`; uvicorn `--port N`).

### 3. Assign ports — CORS-safe: keep native, only renumber on collision

Reassigning a frontend's port silently breaks any app whose **CORS allowlist,
dev-proxy target, or OAuth redirect** is hardcoded to the old origin — the
classic "every API call blocked, 'Could not load…' on every screen" failure. So:

- **Default each project to its `nativePort`** (the port it already expects). If
  `pinnedPorts` is non-empty, those origins matter — keep the web port on the one
  that's in the allowlist/proxy so it keeps working out of the box.
- **Only reassign a port when two projects would actually collide** on the same
  number. When you must move one, prefer moving the one with **no** pinned
  origins; if you move a pinned one, add a clear `notes` warning that its CORS
  allowlist / proxy / redirect must include the new origin, and tell the user.
- Control server: **4000** (or the user's chosen control port). Don't let any
  project's port equal the control port.
- For projects with no constraints, sequential web ports (4001, 4002, …) are fine.
- Backends/data services keep their own ports (the exact one a proxy/CORS list
  expects, e.g. `:8088`, `:8080`); make sure nothing collides with anything else.
- Rewrite each project's `procs` to use its assigned port.

**Dual host forms (localhost + 127.0.0.1).** Browsers treat `http://localhost:N`
and `http://127.0.0.1:N` as **different origins**. Vite often surfaces the
`127.0.0.1` form while a backend's CORS list only allows `localhost` (or vice
versa) — that mismatch blocks every call even when the port is right. So:
- The gallery's Open links and liveness use a **consistent host** (localhost).
- When a project has a backend with a CORS allowlist you can see, note in its
  card `notes` that the allowlist should include **both** `http://localhost:PORT`
  **and** `http://127.0.0.1:PORT` for its frontend port — so it works regardless
  of which form the tab lands on. Don't edit it for them; surface it.

### 4. Scaffold + write the config

1. Copy `template/` to `<gallery-dir>` (everything: `server.js`, `index.html`,
   `projects.js`, `lib/`, `package.json`, `.gitignore`,
   `gallery.config.example.json`).
2. Write `<gallery-dir>/gallery.config.json` with `title`, `controlPort`, and
   the `projects` array you built (each with id, name, tagline, essence,
   category, accent, port, readyPort, openPath, notes, procs). See
   `gallery.config.example.json` for the exact shape.
3. Delete any stale `<gallery-dir>/thumbnails.js` and `order.json` so the server
   re-seeds fresh monogram placeholders for the new project set.

### 5. Launch immediately (instant placeholders)

Start the gallery right away so the user sees it working in seconds:

```bash
cd <gallery-dir> && node server.js
```

On boot it auto-seeds `thumbnails.js` with clean **monogram placeholder** plates
(initials + name in each project's accent). Tell the user the URL
(`http://localhost:<controlPort>`). The page hot-reloads art, so essence plates
will appear without a refresh.

### 6. Generate essence art in the background

Now upgrade each monogram to a bespoke, full-color, square cover plate that
**captures that app's essence**. For each project, produce one self-contained
inline SVG following `plate-prompt.md` (read it — it has the full art direction
and the hard constraints: `viewBox="0 0 360 360"`, bleed to all edges, full
color in the app's palette, every `<defs>` id prefixed with the project id).

The fastest, highest-quality way is to **fan these out in parallel** — one
illustrator subagent per project — using whatever parallel mechanism you have
(the Workflow tool if available, else parallel Agent calls). Each subagent
returns ONLY the SVG string for its project. Use structured output if available
so the SVG comes back clean (no prose).

Then write `<gallery-dir>/thumbnails.js` as:

```js
const THUMBS = {
  "project-id": () => `<svg ...>...</svg>`,
  ...
};
if (typeof module !== "undefined" && module.exports) { module.exports = { THUMBS }; }
```

(Escape backticks/`${`/backslashes in each SVG when embedding in the template
literal.) The running gallery polls `thumbnails.js` and swaps each plate in
automatically — no restart needed.

**Validate** before writing: each value must start with `<svg`, have
`viewBox="0 0 360 360"`, contain exactly one `<svg>`…`</svg>`, and have every
`id="..."` prefixed with that project's id (so 8+ plates don't collide). If a
plate fails, keep its monogram rather than shipping broken art.

### 7. Hand off

Tell the user:
- the URL and that **Start All / Kill All** and per-card **Start/Stop** work,
- that tiles **drag-to-swap** and the order is saved,
- any per-project **caveats** you found (Docker/Postgres needed, env keys, slow
  first boot ~10–20s),
- that `Ctrl-C` in the server terminal stops the gallery and every project.

## Notes
- Liveness is detected by polling each project's `readyPort` (both IPv4 and
  IPv6 — Vite binds `::1`, Next/uvicorn bind `127.0.0.1`).
- First boot of heavy dev servers is slow; the status dot stays "BOOTING" until
  the port answers. That's expected.
- To add/remove a project later, edit `gallery.config.json` and restart; new
  projects get monograms until you regenerate their plate.
