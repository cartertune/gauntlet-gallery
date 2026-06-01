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
dev/start, Python (FastAPI/uvicorn, Flask, Django), and static sites, and
returns a proposed `procs` array. Treat it as a **starting guess** — then
verify against reality:
- Read the project's `package.json` `scripts` (esp. `dev`/`start`) and any
  `vite.config.*` / `next.config.*` for a hardcoded port or a dev proxy.
- Read the README and skim the entry file so you can write a good `essence`
  (2–4 sentences describing what the app actually does) and pick a fitting
  `category` (one short word: WEB, GAME, AGENT, EVAL, etc.) and `accent` color.
- Watch for **multi-process** apps (a web UI + a backend/api, a monorepo with
  `apps/*`): list every process in `procs`, and set `readyPort` to the one you
  open in the browser. If a frontend dev-proxy hardcodes a backend port, run
  the backend on exactly that port (don't edit the user's config).
- Watch for **data deps** (a Postgres/Docker container, a `.env` with keys):
  note them in `notes` so the card warns the user; don't try to provision them.

**Never edit the user's project files.** Express every port override as a CLI
flag or env var in `procs` (e.g. Vite `--port N --strictPort`; Next `-p N`; CRA
/ Express `PORT=N`; uvicorn `--port N`).

### 3. Assign non-conflicting ports

- Control server: **4000** (or the user's chosen control port).
- Each project's **web port**: 4001, 4002, 4003, … in order.
- Backends/data services a project needs (FastAPI, a second server): give them
  their own ports outside the 40xx web range (e.g. 8001+, or the exact port a
  hardcoded proxy expects). Make sure nothing collides with anything else.
- Rewrite each project's `procs` to use its assigned port (substitute the port
  into the flag/env you identified in step 2).

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
