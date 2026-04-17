---
sketch: 001
name: landing-layout
question: "How should the minimal landing surface the next feriado escolar + region picker?"
winner: "A"
tags: [layout, landing, utility-dashboard]
---

# Sketch 001: Landing layout

## Design Question
Landing current has too much noise (3 ads, map SVG, region list, region panel, feriados table, cards, FAQ). User wants fast-load info page: next feriado escolar + region dropdown for inicio clases. How should these two elements be arranged and weighted?

## How to View
`start .planning/sketches/001-landing-layout/index.html`

## Variants

- **A: Single-card hero** — stacked vertically, feriado card first, region picker below. Calm, scan top-to-bottom.
- **B: Split screen** — 50/50 grid, feriado left, region right. Peer-weighted, denser above the fold.
- **C: Countdown hero** — giant countdown number dominates, feriado/region details as support. Urgency-first.

## What to Look For

- **Eye weight:** where does your eye land first?
- **Scan speed:** which reads fastest on mobile vs desktop?
- **Emotional register:** C feels most dashboard-like, A most editorial, B most utilitarian
- **Region picker visibility:** does it feel secondary (A, C) or co-equal (B)?
- **Mobile fold:** open DevTools narrow viewport — what fits in first screen?

## Theme
`../themes/default.css` — utility dashboard palette (morado #7c3aed brand)

## Mock Data Note
Countdown hardcoded to "14 días" (Día del Trabajo, 1 mayo). Today per system = 2026-04-17. Real build reads `window.CALENDAR_CONFIG.feriados` and filters `contexto === 'en-clases'`.
