---
phase: 08-bcn-legal-extractor
verified: 2026-03-25T08:30:00Z
status: passed
score: 6/6 must-haves verified
gaps: []
human_verification:
  - test: "Spot-check verbatim text against BCN.cl website"
    expected: "feriado_ano_nuevo texto_verbatim matches Article PRIMERO on https://www.bcn.cl/leychile/navegar?idNorma=23639"
    why_human: "Cannot retrieve live BCN page without running a browser; requires visual comparison against stored text"
  - test: "Confirm feriado_encuentro_dos_mundos and feriado_san_pedro_san_pablo verbatim text is from ley 19668, not ley 2977"
    expected: "These two claims map to bcn-ley-19668 and bcn-ley-2977 respectively, and the stored text reflects the correct law"
    why_human: "Multiple claims from ley-2977 share identical texto_verbatim (same ARTICULO PRIMERO text). The inciso differentiation is semantically correct but needs a human to confirm the text covers each specific holiday."
---

# Phase 8: BCN Legal Extractor Verification Report

**Phase Goal:** El sistema puede obtener y almacenar el articulado legal verbatim que respalda cada afirmacion de feriado
**Verified:** 2026-03-25T08:30:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | bcn-extractor.py fetches JSON from nuevo.leychile.cl for all 4 BCN laws without HTTP errors | VERIFIED | `--dry-run` completed successfully: 4 laws fetched, article counts returned (1, 2, 2, 4 articles per law) |
| 2 | bcn-extractor.py extracts article text from HTML, stripping tags and unescaping entities | VERIFIED | `extract_text()` present at line 137; Test 3 passes; output texto_verbatim contains clean Spanish text with accented characters correctly unescaped |
| 3 | Claude API / AI identifies which articles back each of the 15 feriado claims | VERIFIED | DeepSeek API used (OpenAI-compatible deviation, documented in SUMMARY); `identify_articles()` present; 0 unidentified entries in legal-articles.json |
| 4 | data/legal-articles.json contains all 15 BCN-sourced feriado claims with verbatim text | VERIFIED | `_meta.total_claims=15`, 15 content keys, all `texto_verbatim` non-null; all 15 data_keys from afirmaciones.json BCN claims are present |
| 5 | SHA256 hash in each entry matches the texto_verbatim stored | VERIFIED | Programmatic check: 0 hash mismatches across all 15 entries |
| 6 | Re-running the script with unchanged BCN data produces no texto_anterior changes | VERIFIED | All 15 entries have `texto_anterior: null`; SUMMARY confirms second-run idempotency test passed |

**Score: 6/6 truths verified**

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/bcn-extractor.py` | BCN legal article extraction and AI identification; min 180 lines | VERIFIED | 605 lines; all required functions present; starts with `#!/usr/bin/env python3` |
| `data/legal-articles.json` | Verbatim legal articles for 15 feriado claims; contains `_meta` | VERIFIED | 141 lines; `_meta.total_claims=15`; 15 content entries; valid JSON |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `scripts/bcn-extractor.py` | `data/afirmaciones.json` | `json.load` reads claims array and sources dict | VERIFIED | Pattern `afirmaciones.*claims` found; `json.load(afirmaciones_path)` at line 421 |
| `scripts/bcn-extractor.py` | `nuevo.leychile.cl/servicios/Navegar/get_norma_json` | `urllib.request.urlopen` HTTP GET | VERIFIED | Pattern `nuevo\.leychile\.cl.*get_norma_json` found at line 88; confirmed working via --dry-run |
| `scripts/bcn-extractor.py` | AI API (DeepSeek, OpenAI-compatible) | `client.chat.completions.create` | VERIFIED with deviation | PLAN expected `client.messages.create` (Anthropic). Actual: `client.chat.completions.create` (DeepSeek/OpenAI). Functionally equivalent — deviation documented in SUMMARY as approved |
| `scripts/bcn-extractor.py` | `data/legal-articles.json` | `json.dump` writes output | VERIFIED | Pattern `legal-articles\.json` found at line 424/592; file exists with correct content |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase produces data files (scripts/bcn-extractor.py and data/legal-articles.json), not UI components. Data flow is: BCN API -> extract_articles() -> identify_articles() -> update_entry() -> legal-articles.json. All intermediate steps verified above.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Script runs --dry-run without errors, showing 15 claims across 4 laws | `python scripts/bcn-extractor.py --dry-run` | Exit 0; "Found 15 BCN-sourced feriado claims across 4 laws"; 4 laws processed with article counts | PASS |
| Unit tests for helper functions all pass | `python scripts/test_bcn_extractor.py` | 6/6 tests passed (get_idnorma correction, get_idnorma extraction, extract_text, compute_hash, get_feriado_claims count, get_feriado_claims grouping) | PASS |
| All 15 SHA256 hashes match stored texto_verbatim | `python -c "import hashlib,json; ..."` | 0 hash mismatches | PASS |
| _meta.total_claims equals actual entry count | Python check | _meta.total_claims=15, content keys=15 | PASS |
| No unidentified entries in legal-articles.json | Python check | status=unidentified: none | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BCN-01 | 08-01-PLAN.md | Script obtiene XML/JSON de cada ley de feriado desde BCN.cl y extrae texto de todos sus articulos | SATISFIED | `fetch_norma_json()` fetches JSON from nuevo.leychile.cl; `extract_articles()` extracts all articles; --dry-run confirms 4 laws fetched with article counts |
| BCN-02 | 08-01-PLAN.md | Para cada claim feriado-* en afirmaciones.json, Claude/AI API identifica articulos relevantes, resultado guardado en data/legal-articles.json | SATISFIED | `identify_articles()` uses DeepSeek API; all 15 claims have non-null `articulo_numero`; data/legal-articles.json exists with all 15 entries |
| BCN-03 | 08-01-PLAN.md | data/legal-articles.json almacena por claim: articulos verbatim, hash SHA del texto, last_checked, y texto anterior cuando hay cambio | SATISFIED | All 15 entries have: `texto_verbatim` (non-null Spanish text), `hash_sha256` (64-char hex), `last_checked` (ISO timestamp), `texto_anterior` (null on first run, mechanism verified in update_entry()) |

**No orphaned requirements.** REQUIREMENTS.md maps BCN-01, BCN-02, BCN-03 exclusively to Phase 8. All three are satisfied.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/bcn-extractor.py` | 269 | Comment reads "Parsear JSON de la respuesta (con fallback si Claude agrega preambulo)" — references Claude despite DeepSeek migration | INFO | No functional impact; stale comment only |
| `data/legal-articles.json` | Multiple | 11 of 15 entries share identical `texto_verbatim` and `hash_sha256` — all from ley-2977 ARTICULO PRIMERO | INFO | Not a stub — BCN ley-2977 Article 1 is a single long article covering all Chilean public holidays. Different claims are differentiated by `inciso` field. Functionally correct but requires human verification that inciso-level differentiation is semantically sufficient |

No blockers or warnings detected. The stale comment and shared verbatim text are both informational.

---

### Human Verification Required

#### 1. Verbatim Text Accuracy Against BCN.cl

**Test:** Open https://www.bcn.cl/leychile/navegar?idNorma=23639 and compare the text of Article 1 (ARTICULO PRIMERO) against the `texto_verbatim` stored in `data/legal-articles.json` for `feriado_ano_nuevo`.
**Expected:** Stored text should match the verbatim content of Article 1 from Ley 2977 as shown on BCN.cl.
**Why human:** Cannot retrieve live BCN website in verification context; only the API endpoint was tested.

#### 2. Inciso-level Differentiation for ley-2977 Claims

**Test:** Review the 11 claims from ley-2977 (feriado_ano_nuevo through feriado_navidad) in `data/legal-articles.json`. Each shares the same `texto_verbatim` but differs in `inciso` value. Confirm this is acceptable — the full article text is stored, with `inciso` pointing to the specific numbered list item within it.
**Expected:** Stakeholder accepts that storing the full Article PRIMERO with inciso annotation (rather than extracting only the specific paragraph) meets BCN-03 requirements for Phase 9 and Phase 10 downstream use.
**Why human:** This is a design/scope question about whether full-article verbatim storage with inciso pointer satisfies the "verbatim text that backs each claim" goal, or whether claim-specific paragraph extraction is needed.

---

### Gaps Summary

No gaps found. All 6 must-have truths are verified, all artifacts are substantive and wired, all key links confirmed, all 3 requirements satisfied. The one deviation from plan (Anthropic -> DeepSeek API) was an approved runtime decision documented in SUMMARY with identical functional outcome.

The two human verification items are advisory, not blocking — the automated evidence is strong that the goal is achieved.

---

_Verified: 2026-03-25T08:30:00Z_
_Verifier: Claude (gsd-verifier)_
