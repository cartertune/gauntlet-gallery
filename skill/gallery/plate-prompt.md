# Essence plate — art direction

Use this to generate ONE square, full-color "cover plate" per project: the
gallery photo for an app. Give an illustrator subagent the project's name,
palette, and a 2–4 sentence description of what it does, plus this direction.

## The brief to give each illustrator

> You are a top-tier product illustrator creating ONE square, full-color app
> thumbnail as a single self-contained inline SVG. It is the cover art for a
> specific software app — it must instantly read as **that app's essence**
> (depict the actual core object/scene/metaphor the app is about), like a
> beautiful app-store hero or a dribbble-quality product vignette. Not an
> abstract logo, not a generic UI icon, not a screenshot.

## Hard requirements (every plate must satisfy)

- `viewBox="0 0 360 360"` (a perfect **square**), `preserveAspectRatio="xMidYMid slice"`.
- The composition **fills the entire square edge-to-edge** — bleed the
  background to all four edges. No empty bands, no letterboxing, no dead space.
- **Full color**, in the app's own palette. Rich, confident, modern — use
  gradients, soft glows, depth, layered shapes. Plates are ALWAYS shown in
  color (running state is shown elsewhere, not by graying the art).
- A clear **focal point** that depicts the app's core thing. Add small telling
  details (a label, a number, a UI hint) only where they reinforce the concept.
- Pure inline SVG only: **no** `<image>`, `<foreignObject>`, `<script>`, or
  external refs. `<defs>` with `<pattern>` / `<linearGradient>` /
  `<radialGradient>` / `<filter>` / `<clipPath>` are allowed.
- **CRITICAL — id namespacing:** every id you define in `<defs>` MUST be
  prefixed with the project's id token (e.g. `id="my-app-bgGrad"`) and every
  `url(#...)` reference updated to match, so many plates coexist on one page
  with zero id collisions.
- Return **ONLY** the SVG string, starting with `<svg` and ending with `</svg>`
  (use structured output if available so no prose leaks in).

## What "captures the essence" means — examples

The point is to draw the *thing the app is about*, in the app's palette:

- An ASL webcam trainer → a hand mid-sign rendered as a glowing cyan
  keypoint/landmark mesh inside a camera viewfinder, on deep indigo.
- A 3D space-golf builder → a floating fairway island over a glowing gravity
  well with a dotted ball-arc through a ring, on a starfield.
- A pricing-eval dashboard → a faceted house emblem beside a leaderboard bar
  chart with a gold "champion" bar and a live price/latency ticker, on navy.
- An interview scheduler → a day-timeline of room lanes with booked slots and
  one red conflict, plus a small AI chat-star bubble, on a light card.
- A Discord-shaped personal AI → a 3-column shell: channel rail + #hash pills +
  a glowing agent "O" with a chat bubble, on dark indigo.
- An AI that rewrites a UI table → a dark data table with one row glowing under
  an applied rule, and a frosted "✦ Vibe" AI pill floating over it.
- A strategy-bound weekly check-in → a clean RCDO ladder descending to a
  highlighted "Commit ✓" pill, with a Draft→Lock→Done lifecycle rail.
- A fraction lesson → two chip characters ("1/2" pink, "2/4" cyan) standing on
  the same point of a number line over a starfield, captioned "1/2 = 2/4".

Match the same level of craft and specificity for whatever the app actually is.

## Validation before use

Reject (and fall back to the monogram) any plate that: doesn't start with
`<svg`; lacks `viewBox="0 0 360 360"`; has more than one `<svg>` element; or has
any `id="..."` not prefixed with the project id.
