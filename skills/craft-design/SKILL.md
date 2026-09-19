---
name: craft-design
description: "Design and refine product interfaces using Gustavo Fior’s Craft principles: perceptual alignment, precise surfaces, stable typography, and restrained interaction. Use for UI redesigns, visual polish, and interface craft reviews, especially when the user references craft.gustavofior.com."
---

# Craft design

Use this as a foundation for careful interface decisions, not a template or a mandate to copy Craft’s layout. Preserve the product’s workflows and the user’s visual direction. Source: [Craft by Gustavo Fior](https://craft.gustavofior.com/), reviewed September 17, 2026.

## Begin with the work

Identify the principal user action, the evidence needed to make it, and the information that can recede. Sketch a layout and a small token system before changing components. In an evidence-review tool, the media and the decision deserve space; branding, status chrome, and decorative copy should not compete with them.

Use a quiet canvas, readable type, spacing, and restrained elevation to establish hierarchy. Choose accent colors for meaningful state. Avoid applying a hover lift, colored card, border, or animation to every element. These are interpretations of the reference’s visual language, not requirements in the essays.

## Published guidance to apply

- **Stable numbers:** Use `font-variant-numeric: tabular-nums` for timers, scores, counters, and numeric columns. Keep prose proportional and right-align numeric columns. A monospace face is not required; check the chosen font actually supports tabular figures.
- **Optical alignment:** Judge the perceived mass of each glyph and icon, not just its box. Squint or blur to locate the visual center. Any nudge is specific to that icon and size; do not globally translate all icons. Optical sizing should remain automatic when available.
- **Image boundaries:** Add a subtle inset outline (around 10% contrast as a starting point) to media and avatars. It should preserve their shape without changing dimensions. Tune against actual light and dark image content.
- **Concentric corners:** Start with `inner radius = max(0, outer radius − inset)`. Include borders in the inset. Inspect actual nested components and adjust when padding is asymmetric or shapes differ.
- **Paint the canvas:** Set the intended background on `html`, not only an app wrapper. Match browser theme color and any theme changes. Do not disable familiar overscroll simply to hide a wrong root color.
- **Hover restraint:** Frequent interactions should respond immediately. Avoid background/opacity transitions on navigation and repeated review controls. A rare dialog can animate briefly; frequently toggled panels should not make the user wait. If building a tooltip system, delay the first tooltip roughly 400–700ms and allow immediate neighbor transitions.
- **Noise only where useful:** Fine grain can soften banding or add texture to a surface. Keep it subtle, noninteractive, and isolated so blend modes do not alter unrelated content. It is optional, never a requirement to texture a functional workspace.

## Apply and verify

Make state changes legible without depending on color alone. Maintain comfortable targets and visible focus. Keep UI language literal and consistent. Review the actual app at desktop and narrow widths, including empty, loaded, expanded, pending, error, and dialog states. Inspect numeric stability, nested corners, icon balance, truncation, and immediate pointer feedback. Respect reduced motion. Preserve truthful denominators and data; polished presentation must not imply certainty that does not exist.

For provenance, coverage, unpublished concept previews, and deeper sources, read [references/site-map.md](references/site-map.md). The site has seven published essays. Other concepts were labeled “Soon”; do not present their repository placeholders as finished author guidance.
