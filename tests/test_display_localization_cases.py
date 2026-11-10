"""Czech grammatical cases for chapter-one locations."""

from app.display_localization import display_arrival_beat, display_location, location_cases_for_tests


def test_location_cases_forgotten_crypt():
    cases = location_cases_for_tests("The Forgotten Crypt")
    assert cases is not None
    assert cases["nom"] == "Zapomenutá krypta"
    assert cases["loc"] == "zapomenuté kryptě"
    assert display_location("The Forgotten Crypt", "cs", "loc") == "zapomenuté kryptě"


def test_arrival_beat_cs():
    en = "Black water whispers past echoing stone; the current tugs at your boots."
    cs = display_arrival_beat(en, "cs")
    assert "řeka" in cs.lower() or "voda" in cs.lower()
    assert "whispers" not in cs.lower()
