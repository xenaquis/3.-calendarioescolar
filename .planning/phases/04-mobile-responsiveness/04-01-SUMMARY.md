---
phase: "04"
plan: "01"
name: "Mobile Responsiveness & CSS Token Fixes"
subsystem: "frontend/css"
tags: ["css", "tokens", "mobile", "responsive", "bugfix"]
dependency_graph:
  requires: []
  provides: ["css-tokens-complete", "mobile-responsive-key-facts"]
  affects: ["public/css/tokens.css", "public/css/components.css"]
tech_stack:
  added: []
  patterns: ["CSS custom properties", "mobile-first media queries"]
key_files:
  created: []
  modified:
    - public/css/tokens.css
    - public/css/components.css
    - BLUEPRINT.md
decisions:
  - "--space-5 set to 1.25rem to match the 4px spacing scale (5 * 4px = 20px = 1.25rem)"
  - "--leading-relaxed set to 1.75 (standard relaxed line-height value)"
  - "key-fact__date breakpoint at 400px targets narrowest phone viewports (iPhone SE = 375px)"
metrics:
  duration: "4 min"
  completed: "2026-03-24"
  tasks: 3
  files: 3
---

# Phase 04 Plan 01: Mobile Responsiveness & CSS Token Fixes Summary

## One-liner

Fixed two missing CSS tokens (`--space-5`, `--leading-relaxed`) silently broken since launch, and added viewport guard for key-fact date overflow on sub-400px screens.

## What Was Done

### Task 1: Fix missing CSS tokens

Added two tokens to `public/css/tokens.css` that were referenced in `components.css` but never defined:

- `--space-5: 1.25rem` — used in `.school-stats` padding and `.details-extra__summary`/`.details-extra .table-wrapper` padding
- `--leading-relaxed: 1.75` — used in `.legal-notice p` line-height

Without these tokens, browsers silently fell back to `unset` for `--space-5` (treated as 0, collapsing padding) and inherited values for `--leading-relaxed` (line-height from body = 1.6 instead of 1.75).

### Task 2: Improve key-fact date font responsiveness

Added `@media (max-width: 400px)` rule to `components.css` that reduces `.key-fact__date` from `var(--text-2xl)` (1.5rem) to `var(--text-xl)` (1.25rem).

This prevents date text like "11 — 24 jul" from overflowing the card boundaries on very narrow screens (iPhone SE 375px, older Android phones).

### Task 3: Update BLUEPRINT.md

Updated the "Ultimo update" header and the "Frontend" row in the status table to reflect the 2026-03-24 CSS fixes.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all changes are complete fixes, no placeholders.

## Self-Check: PASSED

- public/css/tokens.css modified: FOUND (commit a857629)
- public/css/components.css modified: FOUND (commit 80acf08)
- BLUEPRINT.md modified: FOUND (commit 107429c)
