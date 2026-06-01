// ---------------------------------------------------------------------------
// Monogram placeholder plates.
//
// Used the instant the gallery boots, before per-app "essence" art is ready.
// Each is a clean, square, full-color SVG: a soft palette wash + the project's
// initials + name, in the project's accent color. The /gallery skill replaces
// these with bespoke essence illustrations in the background.
//
// This module runs both in Node (to seed thumbnails.js) and is mirrored in the
// browser as window.MONOGRAM for live fallback.
// ---------------------------------------------------------------------------

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const v = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16));
}
function mix(hex, withHex, t) {
  const a = hexToRgb(hex), b = hexToRgb(withHex);
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * t));
  return "#" + c.map((x) => x.toString(16).padStart(2, "0")).join("");
}
function initials(name) {
  const words = String(name || "?").trim().split(/[\s\-_]+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// id is used to prefix gradient ids so multiple monograms can coexist.
function monogramSVG(id, name, accent) {
  const acc = accent || "#6366f1";
  const dark = mix(acc, "#05060a", 0.78);
  const darker = mix(acc, "#05060a", 0.9);
  const glow = mix(acc, "#ffffff", 0.25);
  const ini = initials(name);
  const label = String(name || "").toUpperCase().slice(0, 22);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 360" preserveAspectRatio="xMidYMid slice" width="360" height="360">
  <defs>
    <linearGradient id="${id}-mg-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${dark}"/>
      <stop offset="1" stop-color="${darker}"/>
    </linearGradient>
    <radialGradient id="${id}-mg-glow" cx="50%" cy="42%" r="60%">
      <stop offset="0" stop-color="${acc}" stop-opacity="0.42"/>
      <stop offset="1" stop-color="${acc}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="360" height="360" fill="url(#${id}-mg-bg)"/>
  <rect width="360" height="360" fill="url(#${id}-mg-glow)"/>
  <g stroke="${acc}" stroke-opacity="0.10" stroke-width="1">
    <line x1="0" y1="120" x2="360" y2="120"/><line x1="0" y1="240" x2="360" y2="240"/>
    <line x1="120" y1="0" x2="120" y2="360"/><line x1="240" y1="0" x2="240" y2="360"/>
  </g>
  <circle cx="180" cy="158" r="74" fill="none" stroke="${acc}" stroke-opacity="0.35" stroke-width="1.5"/>
  <circle cx="180" cy="158" r="62" fill="${acc}" fill-opacity="0.08"/>
  <text x="180" y="186" text-anchor="middle" font-family="'Helvetica Neue',Arial,sans-serif" font-weight="800" font-size="72" letter-spacing="-2" fill="${glow}">${ini}</text>
  <text x="180" y="276" text-anchor="middle" font-family="'Helvetica Neue',Arial,sans-serif" font-weight="700" font-size="15" letter-spacing="3" fill="${acc}" fill-opacity="0.85">${label}</text>
  <text x="180" y="300" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="9" letter-spacing="2" fill="#ffffff" fill-opacity="0.30">PREVIEW</text>
</svg>`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { monogramSVG, initials, mix };
}
