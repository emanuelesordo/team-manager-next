import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from csi_match import parse_match

ROOT = Path(__file__).parent.parent
FIXTURES = Path(__file__).parent / "fixtures"
SCHEMA = json.loads((ROOT / "match.schema.json").read_text(encoding="utf-8"))
VALIDATOR = Draft202012Validator(SCHEMA, format_checker=Draft202012Validator.FORMAT_CHECKER)


def load(name: str) -> dict:
    return parse_match((FIXTURES / name).read_text(encoding="utf-8"))


def test_schema_is_valid():
    Draft202012Validator.check_schema(SCHEMA)


@pytest.mark.parametrize("fixture", sorted(p.name for p in FIXTURES.glob("*.html")))
def test_output_matches_schema(fixture):
    VALIDATOR.validate(load(fixture))


@pytest.mark.parametrize(
    "mutate",
    [
        lambda d: d.pop("events"),
        lambda d: d.__setitem__("extra", 1),
        lambda d: d["events"][0].__setitem__("type", "foo"),
        lambda d: d["events"][0].pop("player"),
        lambda d: d["home"].__setitem__("score", "2"),
        lambda d: d.__setitem__("date", "05/10/2026"),
    ],
    ids=["missing-field", "extra-field", "bad-event-type", "card-without-player", "score-as-string", "bad-date"],
)
def test_schema_rejects_invalid(mutate):
    data = copy.deepcopy(load("PC11BD12.html"))
    mutate(data)
    assert not VALIDATOR.is_valid(data)
