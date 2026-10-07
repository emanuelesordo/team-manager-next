from collections import Counter
from pathlib import Path

import pytest

from csi_match import ParseError, parse_match

FIXTURES = Path(__file__).parent / "fixtures"


def load(name: str) -> dict:
    return parse_match((FIXTURES / name).read_text(encoding="utf-8"))


def test_match_header():
    d = load("PC11BD12.html")
    assert d["code"] == "C11BD12"
    assert (d["date"], d["time"]) == ("2026-10-05", "21:15")
    assert d["competition"] == {
        "committee": "CSI Padova",
        "sport": "Calcio a 11",
        "name": "Open M / Serie B - D",
    }
    assert d["status"] == "Risultato ufficioso"
    assert d["home"]["name"] == "Calcio Caselle"
    assert d["away"]["name"] == "Union Rubano A.S.D."
    assert (d["home"]["score"], d["away"]["score"]) == (2, 1)
    assert d["home"]["logo"].endswith("03500225.jpg")
    assert d["venue"]["name"].startswith("* Impianto Sportivo Flavio Mengato")


def test_timeline():
    d = load("PC11BD12.html")
    assert d["periods"] == [
        {"period": 1, "label": "Fine primo tempo", "stoppage_minutes": 2},
        {"period": 2, "label": "Fine 2 - 1", "stoppage_minutes": 4},
    ]
    assert Counter(e["type"] for e in d["events"]) == {
        "substitution": 9,
        "yellow_card": 5,
        "goal": 3,
    }
    goals = [e for e in d["events"] if e["type"] == "goal"]
    assert [(g["period"], g["minute"], g["team"], g["score"]) for g in goals] == [
        (2, 44, "home", {"home": 1, "away": 0}),
        (2, 56, "home", {"home": 2, "away": 0}),
        (2, 65, "away", {"home": 2, "away": 1}),
    ]
    first = d["events"][0]
    assert first == {
        "period": 1,
        "minute": 29,
        "team": "home",
        "type": "yellow_card",
        "player": {"name": "Paccagnella M.", "number": 8},
        "stoppage_minute": None,
    }
    # recupero: 41' del 1° tempo -> 40+1, 41' del 2° tempo -> 80+1
    timing = [(e["period"], e["minute"], e["stoppage_minute"]) for e in d["events"]]
    assert timing[1:3] == [(1, 40, 1), (1, 40, 1)]
    assert timing[3] == (2, 41, None)
    assert timing[-1] == (2, 80, 1)
    sub = next(e for e in d["events"] if e["type"] == "substitution")
    assert sub["player_out"] == {"name": "Chiodo R.", "number": 4}
    assert sub["player_in"] == {"name": "Panaite A.", "number": 16}


def test_blue_card_and_no_status_badge():
    d = load("PC11BD3.html")
    assert d["status"] is None
    assert (d["home"]["score"], d["away"]["score"]) == (2, 0)
    blue = [e for e in d["events"] if e["type"] == "blue_card"]
    assert blue == [
        {
            "period": 2,
            "minute": 80,
            "team": "away",
            "type": "blue_card",
            "player": {"name": "Esposito F.", "number": 13},
            "stoppage_minute": 4,
        }
    ]


def test_match_not_played():
    d = load("PC11BD20.html")
    assert d["home"]["score"] is None and d["away"]["score"] is None
    assert d["periods"] == [] and d["events"] == []


def test_not_a_match_page():
    with pytest.raises(ParseError):
        parse_match("<html><body>niente</body></html>")
