#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Gauntlet Gallery — control server (generic template)
//
// Serves the gallery UI and exposes a control API to start/stop each project's
// dev server. A static page can't spawn processes, so this Node server owns the
// child processes, tracks them, and reports liveness by polling each project's
// port. Projects come from gallery.config.json (see projects.js).
//
//   GET  /                     -> gallery page
//   GET  /projects.js          -> the registry (also loaded by the page)
//   GET  /thumbnails.js        -> the plate art (monograms, then essence)
//   GET  /lib/*.js             -> client libs (monogram fallback)
//   GET  /api/meta             -> { title, controlPort }
//   GET  /api/status           -> { id: {running, listening, pids, port} }
//   POST /api/start/:id        -> spawn that project's procs
//   POST /api/stop/:id         -> kill that project's procs (+ children)
//   POST /api/start-all        -> start every project
//   POST /api/kill-all         -> stop every project
//   GET  /api/logs/:id         -> recent stdout/stderr for a project
//   GET  /api/order            -> saved display order (array of ids)
//   POST /api/order            -> persist a new display order ({order:[ids]})
// ---------------------------------------------------------------------------

const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { PROJECTS, CONTROL_PORT, TITLE } = require("./projects.js");
const { monogramSVG } = require("./lib/monogram.js");

const byId = new Map(PROJECTS.map((p) => [p.id, p]));
const state = new Map();
const MAX_LOG_LINES = 400;

// --- ensure thumbnails.js exists (seed with monograms) ---------------------
// The /gallery skill overwrites this with bespoke essence art in the
// background; until then, every project shows a clean monogram placeholder.
const THUMBS_PATH = path.join(__dirname, "thumbnails.js");
function seedThumbnailsIfMissing() {
  if (fs.existsSync(THUMBS_PATH)) return;
  const entries = PROJECTS.map((p) => {
    const svg = monogramSVG(p.id, p.name, p.accent)
      .replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
    return `  ${JSON.stringify(p.id)}: () => \`${svg}\`,`;
  }).join("\n");
  const mod = `// Auto-seeded monogram placeholders. Replaced with essence art by the /gallery skill.\nconst THUMBS = {\n${entries}\n};\nif (typeof module !== "undefined" && module.exports) { module.exports = { THUMBS }; }\n`;
  fs.writeFileSync(THUMBS_PATH, mod);
}

function ensureState(id) {
  if (!state.has(id)) state.set(id, { procs: [], logs: [] });
  return state.get(id);
}
function appendLog(id, label, chunk) {
  const s = ensureState(id);
  for (const line of chunk.toString().split(/\r?\n/)) {
    if (line === "") continue;
    s.logs.push(`[${label}] ${line}`);
  }
  if (s.logs.length > MAX_LOG_LINES) s.logs.splice(0, s.logs.length - MAX_LOG_LINES);
}

// --- liveness (race both IP stacks: Vite binds ::1, Next/uvicorn 127.0.0.1) -
function tryConnect(port, host, timeout = 600) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (r) => { if (done) return; done = true; socket.destroy(); resolve(r); };
    socket.setTimeout(timeout);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}
async function isPortListening(port, timeout = 600) {
  const r = await Promise.all([tryConnect(port, "127.0.0.1", timeout), tryConnect(port, "::1", timeout)]);
  return r.some(Boolean);
}
function isRunning(id) {
  const s = state.get(id);
  return !!(s && s.procs.length && s.procs.some((p) => p.child && !p.child.killed && p.child.exitCode === null));
}
async function statusFor(id) {
  const proj = byId.get(id);
  const s = state.get(id);
  return {
    id,
    running: isRunning(id),
    listening: await isPortListening(proj.readyPort || proj.port),
    pids: s ? s.procs.map((p) => p.pid).filter(Boolean) : [],
    port: proj.port,
  };
}

// --- start / stop ----------------------------------------------------------
function startProject(id) {
  const proj = byId.get(id);
  if (!proj) throw new Error("unknown project " + id);
  if (isRunning(id)) return { ok: true, already: true };
  const s = ensureState(id);
  s.procs = [];
  s.logs.push(`──── starting ${proj.name} @ ${new Date().toISOString()} ────`);
  for (const def of proj.procs || []) {
    const child = spawn(def.cmd, def.args || [], {
      cwd: def.cwd,
      env: { ...process.env, FORCE_COLOR: "0", ...(def.env || {}) },
      detached: true, // own process group so we can signal the whole tree
      stdio: ["ignore", "pipe", "pipe"],
    });
    s.procs.push({ label: def.label || "proc", child, pid: child.pid });
    appendLog(id, def.label || "proc", `spawned: ${def.cmd} ${(def.args || []).join(" ")} (pid ${child.pid})`);
    child.stdout.on("data", (d) => appendLog(id, def.label || "proc", d));
    child.stderr.on("data", (d) => appendLog(id, def.label || "proc", d));
    child.on("exit", (code, sig) => appendLog(id, def.label || "proc", `exited (code=${code} signal=${sig})`));
    child.on("error", (err) => appendLog(id, def.label || "proc", `ERROR: ${err.message}`));
  }
  return { ok: true, started: (proj.procs || []).length };
}
function stopProject(id) {
  const s = state.get(id);
  if (!s || !s.procs.length) return { ok: true, already: true };
  for (const { child, pid, label } of s.procs) {
    if (!pid) continue;
    try { process.kill(-pid, "SIGTERM"); appendLog(id, label, `SIGTERM -> group ${pid}`); }
    catch (_) { try { process.kill(pid, "SIGTERM"); } catch (__) {} }
  }
  const pids = s.procs.map((p) => p.pid).filter(Boolean);
  setTimeout(() => {
    for (const pid of pids) {
      try { process.kill(-pid, "SIGKILL"); } catch (_) { try { process.kill(pid, "SIGKILL"); } catch (__) {} }
    }
  }, 4000);
  s.procs = [];
  return { ok: true };
}

// --- display order persistence ---------------------------------------------
const ORDER_FILE = path.join(__dirname, "order.json");
function readOrder() {
  try {
    const saved = JSON.parse(fs.readFileSync(ORDER_FILE, "utf8"));
    if (Array.isArray(saved)) {
      const known = saved.filter((id) => byId.has(id));
      const missing = PROJECTS.map((p) => p.id).filter((id) => !known.includes(id));
      return [...known, ...missing];
    }
  } catch (_) {}
  return PROJECTS.map((p) => p.id);
}
function writeOrder(order) {
  const clean = (order || []).filter((id) => byId.has(id));
  const missing = PROJECTS.map((p) => p.id).filter((id) => !clean.includes(id));
  const full = [...clean, ...missing];
  fs.writeFileSync(ORDER_FILE, JSON.stringify(full, null, 2));
  return full;
}

// --- HTTP plumbing ---------------------------------------------------------
function send(res, code, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(code, { "Content-Type": "application/json", ...headers });
  res.end(payload);
}
function serveFile(res, file, type) {
  fs.readFile(path.join(__dirname, file), (err, data) => {
    if (err) return send(res, 404, { error: "not found: " + file });
    res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
    res.end(data);
  });
}
function readBody(req) {
  return new Promise((resolve) => {
    let d = "";
    req.on("data", (c) => (d += c));
    req.on("end", () => { try { resolve(d ? JSON.parse(d) : {}); } catch (_) { resolve({}); } });
    req.on("error", () => resolve({}));
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${CONTROL_PORT}`);
  const { pathname } = url;
  const method = req.method;
  try {
    if (pathname === "/" || pathname === "/index.html") return serveFile(res, "index.html", "text/html; charset=utf-8");
    if (pathname === "/projects.js") return serveFile(res, "projects.js", "application/javascript; charset=utf-8");
    if (pathname === "/thumbnails.js") return serveFile(res, "thumbnails.js", "application/javascript; charset=utf-8");
    if (pathname === "/lib/monogram.js") return serveFile(res, "lib/monogram.js", "application/javascript; charset=utf-8");

    if (pathname === "/api/meta" && method === "GET") return send(res, 200, { title: TITLE, controlPort: CONTROL_PORT });
    if (pathname === "/api/projects" && method === "GET") {
      // browser-safe view of the registry (no proc internals needed client-side)
      return send(res, 200, {
        projects: PROJECTS.map((p) => ({
          id: p.id, name: p.name, tagline: p.tagline, essence: p.essence,
          category: p.category, accent: p.accent, port: p.port,
          openPath: p.openPath, byline: p.byline, notes: p.notes,
        })),
      });
    }

    if (pathname === "/api/order" && method === "GET") return send(res, 200, { order: readOrder() });
    if (pathname === "/api/order" && method === "POST") {
      const body = await readBody(req);
      return send(res, 200, { ok: true, order: writeOrder(Array.isArray(body.order) ? body.order : []) });
    }

    if (pathname === "/api/status" && method === "GET") {
      const out = {};
      await Promise.all(PROJECTS.map(async (p) => { out[p.id] = await statusFor(p.id); }));
      return send(res, 200, out);
    }
    if (pathname.startsWith("/api/logs/") && method === "GET") {
      const id = decodeURIComponent(pathname.split("/").pop());
      const s = state.get(id);
      return send(res, 200, { id, logs: s ? s.logs : [] });
    }
    if (pathname.startsWith("/api/start/") && method === "POST") {
      const id = decodeURIComponent(pathname.split("/").pop());
      if (!byId.has(id)) return send(res, 404, { error: "unknown project" });
      return send(res, 200, startProject(id));
    }
    if (pathname.startsWith("/api/stop/") && method === "POST") {
      const id = decodeURIComponent(pathname.split("/").pop());
      if (!byId.has(id)) return send(res, 404, { error: "unknown project" });
      return send(res, 200, stopProject(id));
    }
    if (pathname === "/api/start-all" && method === "POST") {
      const results = {};
      for (const p of PROJECTS) { results[p.id] = startProject(p.id); await new Promise((r) => setTimeout(r, 350)); }
      return send(res, 200, { ok: true, results });
    }
    if (pathname === "/api/kill-all" && method === "POST") {
      const results = {};
      for (const p of PROJECTS) results[p.id] = stopProject(p.id);
      return send(res, 200, { ok: true, results });
    }
    return send(res, 404, { error: "not found" });
  } catch (err) {
    return send(res, 500, { error: err.message });
  }
});

function shutdown() {
  for (const id of state.keys()) stopProject(id);
  setTimeout(() => process.exit(0), 500);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

seedThumbnailsIfMissing();
server.listen(CONTROL_PORT, () => {
  console.log(`\n  ${TITLE}  →  http://localhost:${CONTROL_PORT}\n`);
  if (!PROJECTS.length) {
    console.log("  No projects configured yet. Run the /gallery skill, or edit gallery.config.json.\n");
  } else {
    console.log("  Projects & assigned ports:");
    for (const p of PROJECTS) console.log(`    ${String(p.port).padEnd(6)} ${p.name}`);
    console.log("\n  Ctrl-C stops the gallery AND every project it launched.\n");
  }
});
