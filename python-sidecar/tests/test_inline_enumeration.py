"""A numbered list returned as one line must render as a real list.

Regression guard: the writer returned "1. Zabezpiecz komunikację. 2. Oceń ryzyko. 3. …"
on a single line, markdown read only the leading "1." as a marker, and all six steps
shipped inside one <li> with "2."–"6." left as literal text mid-sentence.
"""
from pipeline.section_writer import _split_inline_enumeration


def test_splits_a_run_on_numbered_list():
    out = _split_inline_enumeration(
        "1. Zabezpiecz komunikację. 2. Oceń ryzyko. 3. Postaw granicę."
    )
    assert out.split("\n") == [
        "1. Zabezpiecz komunikację.",
        "2. Oceń ryzyko.",
        "3. Postaw granicę.",
    ]


def test_leaves_prose_and_real_lists_alone():
    # Not a list — a citation that happens to carry numbers and periods.
    assert _split_inline_enumeration("Sygn. akt IV KK 100/20. WYROK w sprawie.") == (
        "Sygn. akt IV KK 100/20. WYROK w sprawie."
    )
    # Ordinal mid-sentence, no list opener.
    assert _split_inline_enumeration("Kara wynosi 2. stopnia w skali.") == (
        "Kara wynosi 2. stopnia w skali."
    )
    # Already one item per line.
    already = "1. Pierwszy krok.\n2. Drugi krok."
    assert _split_inline_enumeration(already) == already
