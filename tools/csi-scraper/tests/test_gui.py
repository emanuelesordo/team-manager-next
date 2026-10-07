from pathlib import Path

import pytest

pytest.importorskip("tkinter")

import csi_match  # noqa: E402
from csi_gui import format_summary, scrape  # noqa: E402
from csi_match import parse_match  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> dict:
    return parse_match((FIXTURES / name).read_text(encoding="utf-8"))


@pytest.mark.parametrize("name", sorted(p.name for p in FIXTURES.glob("*.html")))
def test_summary_all_fixtures(name):
    d = load(name)
    text = format_summary(d)
    assert d["home"]["name"] in text and d["away"]["name"] in text
    event_lines = [line for line in text.splitlines() if line.startswith("  ")]
    assert len(event_lines) == len(d["events"])


def test_summary_content():
    text = format_summary(load("PC11BD12.html"))
    lines = text.splitlines()
    assert lines[0] == "Calcio Caselle 2 - 1 Union Rubano A.S.D.   (Risultato ufficioso)"
    assert "05/10/2026 ore 21:15 · Codice C11BD12" in lines
    assert "1° tempo (recupero 2')" in lines
    assert "2° tempo (recupero 4')" in lines
    assert any(line.lstrip().startswith("40+1'") and "Grisolia G. (10)" in line for line in lines)
    assert any("Chiodo R. (4) → Panaite A. (16)" in line for line in lines)
    assert any("Gol" in line and line.endswith("1-0") for line in lines)


def test_summary_tolerates_nulls():
    data = {
        "url": None,
        "code": None,
        "date": None,
        "time": None,
        "competition": {"committee": None, "sport": None, "name": None},
        "venue": None,
        "status": None,
        "home": {"name": "A", "url": None, "logo": None, "score": None},
        "away": {"name": None, "url": None, "logo": None, "score": None},
        "periods": [],
        "events": [],
    }
    assert format_summary(data) == "A - Ospite\n\nNessun evento"

    data["events"] = [
        {"period": 3, "minute": None, "team": None, "type": "goal", "score": None,
         "stoppage_minute": None},
    ]
    text = format_summary(data)
    assert "3° tempo" in text.splitlines()
    assert "?" in text


def test_scrape_uses_fetch(monkeypatch):
    html = (FIXTURES / "PC11BD12.html").read_text(encoding="utf-8")
    url = "https://live.centrosportivoitaliano.it/gara"
    monkeypatch.setattr(csi_match, "fetch", lambda u: html if u == url else pytest.fail(u))
    d = scrape(f"  {url}\n")
    assert d["url"] == url
    assert d["code"] == "C11BD12"


def test_scrape_empty_url():
    with pytest.raises(ValueError):
        scrape("   ")
