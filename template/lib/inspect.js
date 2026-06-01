// ---------------------------------------------------------------------------
// Project inspector.
//
// Given a project directory, best-guess how to launch its dev server and what
// port it wants, so the /gallery skill (or `node lib/inspect.js <dir>`) can
// propose a gallery.config.json entry. The skill confirms/edits the guesses.
//
// Heuristics cover the common cases: Vite, Next.js, CRA, Vue-CLI, Astro,
// SvelteKit, plain npm "dev", Python (FastAPI/uvicorn, Flask, Django), and a
// static index.html. Port OVERRIDE is always expressed as a flag/env so the
// project's own config is never edited.
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");

function readJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) { return null; }
}
function exists(p) { try { fs.accessSync(p); return true; } catch (_) { return false; } }
function lc(s) { return String(s || "").toLowerCase(); }

// Returns { type, defaultPort, makeProcs(absDir, port) } or null.
function inspectProject(absDir) {
  const name = path.basename(absDir);
  const pkgPath = path.join(absDir, "package.json");
  const pkg = readJSON(pkgPath);

  if (pkg) {
    const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies);
    const scripts = pkg.scripts || {};
    const devScript = scripts.dev || scripts.start || scripts.serve || null;
    const has = (d) => Object.prototype.hasOwnProperty.call(deps, d);
    const scriptText = lc(JSON.stringify(scripts));

    // --- Next.js ---
    if (has("next") || /\bnext\b/.test(scriptText)) {
      return {
        type: "Next.js",
        defaultPort: 3000,
        framework: "next",
        // `next dev -p PORT`; passing through npm: npm run dev -- -p PORT
        makeProcs: (dir, port) => [{
          label: "web", cmd: "npm", args: ["run", "dev", "--", "-p", String(port)], cwd: dir,
        }],
        note: "Next.js dev server.",
      };
    }
    // --- Vite (or Vite-based: vue/react/svelte/astro via vite) ---
    if (has("vite") || /\bvite\b/.test(scriptText)) {
      return {
        type: "Vite",
        defaultPort: 5173,
        framework: "vite",
        makeProcs: (dir, port) => [{
          label: "web", cmd: "npm", args: ["run", "dev", "--", "--port", String(port), "--strictPort"], cwd: dir,
        }],
        note: "Vite dev server.",
      };
    }
    // --- Astro (its own CLI) ---
    if (has("astro")) {
      return {
        type: "Astro", defaultPort: 4321, framework: "astro",
        makeProcs: (dir, port) => [{ label: "web", cmd: "npm", args: ["run", "dev", "--", "--port", String(port)], cwd: dir }],
        note: "Astro dev server.",
      };
    }
    // --- SvelteKit ---
    if (has("@sveltejs/kit")) {
      return {
        type: "SvelteKit", defaultPort: 5173, framework: "sveltekit",
        makeProcs: (dir, port) => [{ label: "web", cmd: "npm", args: ["run", "dev", "--", "--port", String(port), "--strictPort"], cwd: dir }],
        note: "SvelteKit (Vite) dev server.",
      };
    }
    // --- Create React App (react-scripts) ---
    if (has("react-scripts")) {
      return {
        type: "Create React App", defaultPort: 3000, framework: "cra",
        // CRA reads PORT from env
        makeProcs: (dir, port) => [{ label: "web", cmd: "npm", args: ["start"], cwd: dir, env: { PORT: String(port), BROWSER: "none" } }],
        note: "CRA dev server (PORT env).",
      };
    }
    // --- Vue CLI ---
    if (has("@vue/cli-service")) {
      return {
        type: "Vue CLI", defaultPort: 8080, framework: "vue-cli",
        makeProcs: (dir, port) => [{ label: "web", cmd: "npm", args: ["run", "serve", "--", "--port", String(port)], cwd: dir }],
        note: "Vue CLI dev server.",
      };
    }
    // --- generic npm dev/start: honor PORT env, best-effort ---
    if (devScript) {
      const scriptName = scripts.dev ? "dev" : scripts.start ? "start" : "serve";
      return {
        type: "npm " + scriptName, defaultPort: 3000, framework: "npm",
        makeProcs: (dir, port) => [{ label: "web", cmd: "npm", args: ["run", scriptName], cwd: dir, env: { PORT: String(port) } }],
        note: "Generic npm '" + scriptName + "' script; PORT passed via env (may need a manual flag).",
      };
    }
  }

  // --- Python: FastAPI / uvicorn ---
  if (exists(path.join(absDir, "requirements.txt")) || exists(path.join(absDir, "pyproject.toml"))) {
    // FastAPI app commonly app.main:app or main:app
    const venvPy = exists(path.join(absDir, ".venv/bin/python")) ? path.join(absDir, ".venv/bin/python") : "python3";
    const appModule = exists(path.join(absDir, "app/main.py")) ? "app.main:app"
      : exists(path.join(absDir, "main.py")) ? "main:app" : null;
    if (appModule) {
      return {
        type: "FastAPI (uvicorn)", defaultPort: 8000, framework: "fastapi",
        makeProcs: (dir, port) => [{ label: "api", cmd: venvPy, args: ["-m", "uvicorn", appModule, "--host", "127.0.0.1", "--port", String(port)], cwd: dir }],
        note: "FastAPI via uvicorn (guessed module " + appModule + ").",
      };
    }
    // Flask
    if (exists(path.join(absDir, "app.py")) || exists(path.join(absDir, "wsgi.py"))) {
      return {
        type: "Flask", defaultPort: 5000, framework: "flask",
        makeProcs: (dir, port) => [{ label: "web", cmd: venvPy, args: ["-m", "flask", "run", "--port", String(port)], cwd: dir, env: { FLASK_APP: "app.py" } }],
        note: "Flask dev server.",
      };
    }
    // Django
    if (exists(path.join(absDir, "manage.py"))) {
      return {
        type: "Django", defaultPort: 8000, framework: "django",
        makeProcs: (dir, port) => [{ label: "web", cmd: venvPy, args: ["manage.py", "runserver", "127.0.0.1:" + String(port)], cwd: dir }],
        note: "Django dev server.",
      };
    }
  }

  // --- static site: an index.html with no build tooling ---
  if (exists(path.join(absDir, "index.html"))) {
    return {
      type: "Static", defaultPort: 8080, framework: "static",
      makeProcs: (dir, port) => [{ label: "web", cmd: "npx", args: ["--yes", "serve", "-l", String(port), "."], cwd: dir }],
      note: "Static site served with `npx serve`.",
    };
  }

  return null; // couldn't determine — skill will ask the user
}

// CLI: `node lib/inspect.js <dir> [port]`
if (require.main === module) {
  const dir = path.resolve(process.argv[2] || ".");
  const port = Number(process.argv[3] || 0);
  const r = inspectProject(dir);
  if (!r) { console.log(JSON.stringify({ dir, detected: false }, null, 2)); process.exit(0); }
  const usePort = port || r.defaultPort;
  console.log(JSON.stringify({
    dir, detected: true, type: r.type, framework: r.framework,
    defaultPort: r.defaultPort, note: r.note,
    procs: r.makeProcs(dir, usePort),
  }, null, 2));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { inspectProject };
}
