#!/usr/bin/env python3
"""
test_bcn_extractor.py — TDD tests for bcn-extractor.py helper functions.

Tests:
  1. get_idnorma returns '257080' for 'bcn-ley-20148' (correction applied)
  2. get_idnorma returns '23639' for 'bcn-ley-2977' (extracted from api_endpoint)
  3. extract_text strips HTML tags and unescapes entities correctly
  4. compute_hash returns deterministic SHA256 for same input
  5. get_feriado_claims returns exactly 15 claims (excludes 2 derived)
  6. get_feriado_claims groups claims by source_id correctly (4 groups)

Run: python scripts/test_bcn_extractor.py
"""

import sys
import os
import json
import importlib.util

# Load bcn-extractor as a module (without executing main)
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
EXTRACTOR_PATH = os.path.join(SCRIPT_DIR, 'bcn-extractor.py')
DATA_DIR = os.path.join(PROJECT_DIR, 'data')
AFIRMACIONES_PATH = os.path.join(DATA_DIR, 'afirmaciones.json')


def load_extractor():
    """Load bcn-extractor.py as a module."""
    spec = importlib.util.spec_from_file_location('bcn_extractor', EXTRACTOR_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_afirmaciones():
    """Load the real afirmaciones.json file."""
    with open(AFIRMACIONES_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)


def test_get_idnorma_correction_for_ley_20148():
    """Test 1: get_idnorma returns '257080' for 'bcn-ley-20148' (correction applied)."""
    mod = load_extractor()
    afirmaciones = load_afirmaciones()
    result = mod.get_idnorma(afirmaciones, 'bcn-ley-20148')
    assert result == '257080', 'Expected 257080 for bcn-ley-20148, got: {}'.format(result)
    print('PASS: Test 1 — get_idnorma correction for bcn-ley-20148')


def test_get_idnorma_extraction_for_ley_2977():
    """Test 2: get_idnorma returns '23639' for 'bcn-ley-2977' (extracted from api_endpoint)."""
    mod = load_extractor()
    afirmaciones = load_afirmaciones()
    result = mod.get_idnorma(afirmaciones, 'bcn-ley-2977')
    assert result == '23639', 'Expected 23639 for bcn-ley-2977, got: {}'.format(result)
    print('PASS: Test 2 — get_idnorma extraction for bcn-ley-2977')


def test_extract_text_strips_html_and_unescapes():
    """Test 3: extract_text strips HTML tags and unescapes entities correctly."""
    mod = load_extractor()
    html_input = '<div class="art">Art&iacute;culo &uacute;nico &mdash; texto &amp; m&aacute;s</div>'
    result = mod.extract_text(html_input)
    # Should strip tags and unescape entities
    assert '<' not in result, 'HTML tags not stripped: {}'.format(result)
    assert '&' not in result or '&' not in result.replace('&', ''), 'Entities not unescaped'
    assert 'Articulo' in result or 'Art' in result, 'Text content missing: {}'.format(result)
    print('PASS: Test 3 — extract_text strips HTML and unescapes entities')


def test_compute_hash_deterministic():
    """Test 4: compute_hash returns deterministic SHA256 for same input."""
    mod = load_extractor()
    text = 'Articulo PRIMERO.- Este es el texto del articulo.'
    hash1 = mod.compute_hash(text)
    hash2 = mod.compute_hash(text)
    assert hash1 == hash2, 'Hash not deterministic: {} != {}'.format(hash1, hash2)
    assert len(hash1) == 64, 'SHA256 should be 64 hex chars, got: {}'.format(len(hash1))
    # Different text => different hash
    hash3 = mod.compute_hash(text + ' diferente')
    assert hash1 != hash3, 'Different text should produce different hash'
    print('PASS: Test 4 — compute_hash is deterministic SHA256')


def test_get_feriado_claims_count_15():
    """Test 5: get_feriado_claims returns exactly 15 claims (excludes 2 derived)."""
    mod = load_extractor()
    afirmaciones = load_afirmaciones()
    by_law = mod.get_feriado_claims(afirmaciones)
    total = sum(len(claims) for claims in by_law.values())
    assert total == 15, 'Expected 15 BCN-sourced feriado claims, got: {}'.format(total)
    print('PASS: Test 5 — get_feriado_claims returns 15 claims')


def test_get_feriado_claims_groups_by_4_laws():
    """Test 6: get_feriado_claims groups claims by source_id correctly (4 groups)."""
    mod = load_extractor()
    afirmaciones = load_afirmaciones()
    by_law = mod.get_feriado_claims(afirmaciones)
    expected_laws = {'bcn-ley-2977', 'bcn-ley-19668', 'bcn-ley-20148', 'bcn-ley-21357'}
    assert set(by_law.keys()) == expected_laws, 'Expected 4 law groups, got: {}'.format(set(by_law.keys()))
    print('PASS: Test 6 — get_feriado_claims groups by 4 laws: {}'.format(sorted(by_law.keys())))


def main():
    print('Running bcn-extractor TDD tests...')
    print()

    if not os.path.exists(EXTRACTOR_PATH):
        print('FAIL: scripts/bcn-extractor.py does not exist yet (expected in RED phase)')
        sys.exit(1)

    tests = [
        test_get_idnorma_correction_for_ley_20148,
        test_get_idnorma_extraction_for_ley_2977,
        test_extract_text_strips_html_and_unescapes,
        test_compute_hash_deterministic,
        test_get_feriado_claims_count_15,
        test_get_feriado_claims_groups_by_4_laws,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print('FAIL: {} — {}'.format(test.__name__, e))
            failed += 1

    print()
    print('Results: {}/{} tests passed'.format(passed, len(tests)))
    if failed > 0:
        sys.exit(1)
    sys.exit(0)


if __name__ == '__main__':
    main()
