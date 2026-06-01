// ---------------------------------------------------------------------------
// Gauntlet Gallery — project registry (loaded from gallery.config.json)
//
// This file is generic: it reads gallery.config.json (written by the /gallery
// skill, or by hand) and exposes the project list + control port. Nothing here
// is specific to any one person's projects.
//
// gallery.config.json shape:
// {
//   "title": "Gauntlet Gallery",        // header text (optional)
//   "controlPort": 4000,                 // the gallery's own port (optional)
//   "projects": [
//     {
//       "id": "my-app",                  // kebab id, unique
//       "name": "My App",                // display name
//       "tagline": "Short subtitle",     // optional
//       "essence": "What it does…",      // 2-4 sentences (optional)
//       "category": "WEB",               // small pill label (optional)
//       "accent": "#6366f1",             // plate accent / fallback monogram color
//       "port": 4001,                    // the WEB port you open in the browser
//       "readyPort": 4001,               // port to poll for liveness (default: port)
//       "openPath": "/",                 // path appended to the URL when opening (optional)
//       "notes": "Launch caveats…",      // optional
//       "procs": [                       // one or more child processes to spawn
//         {
//           "label": "web",
//           "cmd": "npm",
//           "args": ["run","dev","--","--port","4001","--strictPort"],
//           "cwd": "/abs/path/to/project",
//           "env": { "PORT": "4001" }    // optional extra env
//         }
//       ]
//     }
//   ]
// }
// ---------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "gallery.config.json");

function loadConfig() {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf8");
    const cfg = JSON.parse(raw);
    if (!Array.isArray(cfg.projects)) cfg.projects = [];
    return cfg;
  } catch (e) {
    return { title: "Gauntlet Gallery", controlPort: 4000, projects: [] };
  }
}

const CONFIG = loadConfig();
const PROJECTS = CONFIG.projects.map((p) => ({
  readyPort: p.port,
  openPath: "/",
  accent: "#6366f1",
  category: "PROJECT",
  procs: [],
  ...p,
}));
const CONTROL_PORT = Number(process.env.GALLERY_PORT || CONFIG.controlPort || 4000);
const TITLE = CONFIG.title || "Gauntlet Gallery";

if (typeof module !== "undefined" && module.exports) {
  module.exports = { PROJECTS, CONTROL_PORT, TITLE, CONFIG, CONFIG_PATH };
}
