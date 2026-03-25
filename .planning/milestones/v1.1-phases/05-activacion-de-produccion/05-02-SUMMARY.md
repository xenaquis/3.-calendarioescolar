---
phase: 05-activacion-de-produccion
plan: "02"
subsystem: seo-landing
tags: [seo, feriados, anticipatory-page, sitemap, footer]
dependency_graph:
  requires: []
  provides: [feriados-2027-landing, sitemap-feriados-2027, footer-feriados-2027]
  affects: [index.html, sitemap.xml]
tech_stack:
  added: []
  patterns: [anticipatory-seo-landing, no-claim-data-page]
key_files:
  created:
    - public/feriados-2027.html
  modified:
    - public/sitemap.xml
    - public/index.html
decisions:
  - "No claim-data meta on feriados-2027.html — page has no factual claims for 2027, only fixed-by-law holiday list"
  - "Analytics.init('G-6FVLKF6PFQ') used directly (not G-XXXXXXXXXX placeholder) per plan spec"
  - "Build warning for feriados-2027.html missing claim-data is expected and acceptable — warnings do not fail build"
metrics:
  duration: "2 min"
  completed_date: "2026-03-25T02:38:57Z"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
requirements_satisfied: [SEO-01]
---

# Phase 5 Plan 02: Feriados 2027 Anticipatory Landing Page Summary

Anticipatory SEO landing page for 2027 holiday searches, with sitemap entry and footer link, listing all 17 fixed-by-law Chilean holidays with availability notice for November 2026.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create feriados-2027.html anticipatory landing page | 47fc105 | public/feriados-2027.html |
| 2 | Add feriados-2027 to sitemap.xml and index.html footer | 4f17383 | public/sitemap.xml, public/index.html |

## What Was Built

### feriados-2027.html

A minimal but complete SEO landing page at `/feriados-2027.html`:

- Proper head: canonical, hreflang (es-CL, es, x-default), OG tags (type=article), Twitter card, AdSense meta+script, favicon, theme-color, 5 CSS files
- No `<meta name="claim-data">` — correct per plan (no factual 2027 data yet)
- Robots: `index, follow, max-snippet:-1, max-image-preview:large, noai, noimageai`
- JSON-LD: BreadcrumbList + Article schema
- Body: header/nav, breadcrumb, h1, availability notice card ("datos disponibles noviembre 2026"), table of 17 irrenunciable holidays (fixed + mobile) with badge types, legal notice aside, standard footer
- Analytics: `Analytics.init('G-6FVLKF6PFQ')` in deferred DOMContentLoaded script
- 310 lines (well above 80-line minimum)

### sitemap.xml

New entry added after feriados-2026.html:
- URL: `https://calendarioescolar.cl/feriados-2027.html`
- changefreq: monthly, priority: 0.7
- Build script auto-updated lastmod to 2026-03-24

### index.html footer

Added `<li><a href="/feriados-2027.html">Feriados 2027</a></li>` after Feriados 2026 link in `site-footer__links`.

## Verification

- `npm run build` exits 0 — no errors
- WARN for no claim-data on feriados-2027.html is expected and documented in plan
- All acceptance criteria met for both tasks

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The page explicitly communicates that 2027 data is not yet available (this is the intended behavior, not a stub).

## Self-Check: PASSED

- [x] `public/feriados-2027.html` exists (310 lines)
- [x] `public/sitemap.xml` contains feriados-2027.html entry
- [x] `public/index.html` footer contains Feriados 2027 link
- [x] Commit 47fc105 exists
- [x] Commit 4f17383 exists
- [x] `npm run build` passes
