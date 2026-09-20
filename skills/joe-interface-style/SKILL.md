---
name: joe-interface-style
description: "Apply Joe’s preferred interface style when building or refining product UIs for him: dark, minimal, content-first layouts with direct interactions, explicit visual relationships and context-preserving motion. Use when he asks for his design style or a UI like his video-review experience; do not impose it on unrelated documents or an explicitly different visual direction."
---

# Joe’s interface style

These preferences come from Joe’s hands-on revisions to a private video-review app. Apply the general principles to new product interfaces; keep media-specific patterns conditional. The latest request takes precedence over these defaults.

## The interface should recede

- Default to a quiet, near-black canvas with slightly lighter surfaces, soft borders and readable off-white type. Use whitespace and typography before adding another card or panel.
- Put the primary content first. Prefer a focused workspace to a dashboard of widgets. Start with what the person came to inspect and the explanation it supports.
- Remove ornamental branding, welcome copy, instructions that repeat the obvious, audit/editing history and labels explaining how the UI works. Do not narrate “linked actions” when a line already shows the relationship.
- Give each control a job. Avoid separate “play action”, “view linked actions” or “show details” buttons when the row or finding can do that directly. Use real accessible buttons with clear names under the clean surface.
- Keep results prominent when they frame the work, with concise metric labels and honest denominators. Avoid filling space with extra counters. For comparing result metrics against a cohort, prefer a compact horizontal percentile scale for each metric; use independent comparisons rather than reusing an overall score rank. If Joe accepts a visual estimate, round and label it instead of presenting an exact rank.

## Structure follows meaning

- Group execution records into meaningful operations: preparing an instrument, making a transfer, adding water, or finishing a replicate. Preserve their source intervals. A hand movement is often too granular; an entire multi-minute protocol stage can be too coarse.
- Organize those operations under recognizable protocol or workflow stages. Keep duration and compact counts aligned to the right. Avoid full instruction paragraphs in stage headers.
- Let the purpose determine which insights appear. If the review is explaining an outcome, show contributors to that explanation rather than every detectable deviation. Do not add severity filters unless they help the current task or are explicitly requested.
- Keep records and interpretations distinct. Never put evaluative human judgments into a supposedly machine-generated execution record.
- When relationships matter, make them spatially obvious. Use actual connector lines between evidence and findings, with short branches or shared rails. Avoid crossing webs. Keep related content in a shared scroll surface; do not make people coordinate independent columns.

## Color has a fixed meaning

For error-review tools, use **red for errors, yellow for risks, blue for observations**. Keep those meanings across text, markers, counts, connectors, hover, selection and playback. Add readable category labels; color alone is insufficient. Selection can increase emphasis, but must not change the category color.

An established palette: canvas `#121615`, text around `#e2e7e1`, errors `#f08080`, risks `#edcc67`, observations `#82b6f4`. Treat these as a starting point, not a requirement to override an existing coherent theme.

## Motion explains what changed

- Go beyond a generic fade when motion can clarify a relationship: draw the connecting line, then reveal its finding. Keep layout anchors stationary during the animation.
- Preserve context during mode changes. Keep the current content visible while its replacement loads, then make a short, restrained transition. Never reset the user’s position, selection or playback just to switch a view.
- Follow the active record during playback with a visible live pointer and progress. Manual expansion scrolls to the expanded item, not the page top or a previously selected item.
- Repeated controls should respond promptly. Respect reduced motion, preserve keyboard access, and test focus and narrow screens.

## Conditional media and access patterns

For video review, keep the current grouped step title at the top of the image, rather than a verbose atomic-action caption. Hide it during annotation gaps rather than showing filler. Put the selected finding and full description below the player and scrubber; do not obscure controls. Clicking a finding plays its evidence. Avoid dismiss controls on this persistent context.

For the private gift/review experience, the access page is just a centered password input submitted with Enter. The customer view has no logo, customer-name banner, download menu, copy-link control or exit button. These are preferences for that focused experience, not blanket rules for every application Joe uses.

When Joe wants to keep an earlier design, preserve an accessible version with its own frozen data instead of silently replacing it. This is an instruction to preserve work, not permission to publish private content.

## Finish by checking the experience

Inspect the actual rendered desktop and mobile views. Verify that the main task is obvious, records have the right granularity, lines connect the right objects, colors remain consistent, and animation never moves the user to the wrong place. Use the Craft design principles when available for alignment, stable typography and surface details; these user preferences decide the overall direction.
