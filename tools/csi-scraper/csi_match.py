#!/usr/bin/env python3
"""Scraper della pagina "Info gara" di live.centrosportivoitaliano.it.

Uso:
    python csi_match.py "<url gara>"
    python csi_match.py "<url gara>" --compact
    python csi_match.py --file pagina.html
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup, Tag

BASE_URL = "https://live.centrosportivoitaliano.it/"
HALF_LENGTH = 40  # durata di un tempo, in minuti
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0 Safari/537.36"
)


class ParseError(Exception):
    pass


def fetch(url: str, timeout: float = 20) -> str:
    resp = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=timeout)
    resp.raise_for_status()
    resp.encoding = resp.encoding or "utf-8"
    return resp.text


def _text(el: Tag | None) -> str | None:
    if el is None:
        return None
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip() or None


def _int(value: str | None) -> int | None:
    if value is None:
        return None
    m = re.search(r"-?\d+", value)
    return int(m.group()) if m else None


def _abs(href: str | None, base: str) -> str | None:
    return urljoin(base, href) if href else None


def _player(fragment: str) -> dict | None:
    """'Esce: Rossi M. (9)' / 'Rossi M. (9)' -> {'name': 'Rossi M.', 'number': 9}"""
    fragment = re.sub(r"^\s*(Esce|Entra)\s*:\s*", "", fragment).strip()
    if not fragment:
        return None
    m = re.match(r"^(.*?)\s*\((\d+)\)\s*$", fragment)
    if m:
        return {"name": m.group(1).strip(), "number": int(m.group(2))}
    return {"name": fragment, "number": None}


def _player_from(el: Tag) -> dict | None:
    # Il numero di maglia è in <sup><small>(n)</small></sup>
    parts = []
    for node in el.descendants:
        if isinstance(node, str):
            parts.append(node)
    return _player(re.sub(r"\s+", " ", "".join(parts)))


def _parse_competition(soup: BeautifulSoup) -> dict:
    items = soup.select("ol.breadcrumb li.breadcrumb-item")
    labels = [_text(li.find("a")) for li in items]
    labels = [l for l in labels if l]  # il primo item (home) è solo un'icona
    return {
        "committee": labels[0] if len(labels) > 0 else None,
        "sport": labels[1] if len(labels) > 1 else None,
        "name": labels[2] if len(labels) > 2 else None,
    }


def _parse_team(col: Tag, base: str) -> dict:
    link = col.select_one("h5 a")
    img = col.find("img")
    return {
        "name": _text(link) or _text(col.find("h5")),
        "url": _abs(link.get("href") if link else None, base),
        "logo": img.get("src") if img else None,
    }


def _labeled_value(hero: Tag, label: str) -> Tag | None:
    for b in hero.find_all("b"):
        if _text(b) and _text(b).rstrip(":").strip().lower() == label.lower():
            return b.parent
    return None


def _event_type(icon: Tag | None) -> tuple[str, str | None]:
    classes = icon.get("class", []) if icon else []
    raw = " ".join(classes) or None
    if "fa-futbol" in classes:
        return "goal", raw
    if "fa-exchange" in classes:
        return "substitution", raw
    if "fa-rectangle-portrait" in classes:
        if "text-danger" in classes:
            return "red_card", raw
        if "text-warning" in classes:
            return "yellow_card", raw
        if "text-info" in classes:  # cartellino azzurro CSI (espulsione temporanea)
            return "blue_card", raw
    return "unknown", raw


def _match_minute(minute: int | None, period: int) -> tuple[int | None, int | None]:
    """Minuto del tempo (sul sito riparte da 0) -> (minuto di gara, minuto di recupero).

    Es. 2° tempo 10' -> (50, None); 1° tempo 41' -> (40, 1), cioè 40+1.
    """
    if minute is None:
        return None, None
    offset = HALF_LENGTH * (period - 1)
    if minute > HALF_LENGTH:
        return offset + HALF_LENGTH, minute - HALF_LENGTH
    return offset + minute, None


def _parse_event(row: Tag) -> dict:
    details = row.select_one(".event-details")
    det_classes = details.get("class", []) if details else []
    team = "home" if "event-left" in det_classes else "away" if "event-right" in det_classes else None

    icon = row.select_one(".event-icon i")
    etype, raw_icon = _event_type(icon)
    event: dict = {
        "minute": _int(_text(row.select_one(".event-time"))),
        "team": team,
        "type": etype,
    }

    if etype == "goal":
        score = _text(details.find("h6")) if details else None
        m = re.match(r"^(\d+)\s*-\s*(\d+)$", score or "")
        event["score"] = {"home": int(m.group(1)), "away": int(m.group(2))} if m else None
    elif etype == "substitution" and details:
        out_el = details.select_one(".player_out")
        event["player_out"] = _player_from(out_el) if out_el else None
        if out_el:
            out_el.extract()
        event["player_in"] = _player_from(details)
    else:
        event["player"] = _player_from(details) if details else None
        if etype == "unknown":
            event["icon"] = raw_icon
            event["text"] = _text(details)
    return event


def _parse_timeline(soup: BeautifulSoup) -> tuple[list[dict], list[dict]]:
    first_row = soup.select_one(".event-row")
    if first_row is None:
        return [], []
    container = first_row.parent

    # La timeline è in ordine cronologico inverso: blocchi separati da
    # .event-header ("Fine 2 - 1", "Fine primo tempo"), il primo blocco è
    # l'ultimo periodo giocato.
    blocks: list[dict] = []
    current: dict | None = None
    for el in container.find_all(recursive=False):
        classes = el.get("class", [])
        if "event-header" in classes:
            current = {"label": _text(el), "stoppage_minutes": None, "rows": []}
            blocks.append(current)
        elif "event-header-info" in classes:
            if current is not None:
                current["stoppage_minutes"] = _int(_text(el))
        elif "event-row" in classes:
            if current is None:  # periodo in corso, senza header di chiusura
                current = {"label": None, "stoppage_minutes": None, "rows": []}
                blocks.append(current)
            current["rows"].append(el)

    periods: list[dict] = []
    events: list[dict] = []
    for idx, block in reversed(list(enumerate(blocks))):
        period = len(blocks) - idx
        periods.append(
            {
                "period": period,
                "label": block["label"],
                "stoppage_minutes": block["stoppage_minutes"],
            }
        )
        for row in reversed(block["rows"]):
            event = _parse_event(row)
            event["minute"], event["stoppage_minute"] = _match_minute(event["minute"], period)
            events.append({"period": period, **event})
    return periods, events


def parse_match(html: str, url: str | None = None) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    base = url or BASE_URL

    hero = soup.select_one(".hero-gara")
    if hero is None:
        raise ParseError("Pagina non riconosciuta: blocco '.hero-gara' assente")

    # Data / ora
    date_iso = time_str = None
    pill = hero.select_one(".rounded-pill")
    if pill is not None:
        pill_text = _text(pill) or ""
        d = re.search(r"(\d{2})/(\d{2})/(\d{4})", pill_text)
        t = re.search(r"\b(\d{1,2}:\d{2})\b", pill_text)
        if d:
            date_iso = datetime.strptime(d.group(0), "%d/%m/%Y").date().isoformat()
        if t:
            time_str = t.group(1)

    # Squadre e risultato
    team_cols = hero.select(".row > .col-md-4")
    if len(team_cols) < 2:
        raise ParseError("Squadre non trovate nella pagina")
    home = _parse_team(team_cols[0], base)
    away = _parse_team(team_cols[1], base)

    score_col = hero.select_one(".row > .col-md-3")
    home_score = away_score = status = None
    if score_col is not None:
        status = _text(score_col.select_one(".badge"))
        spans = score_col.select("h3 > span")
        nums = [_int(_text(s)) for s in spans if _text(s) and _text(s) != "-"]
        if len(nums) == 2:
            home_score, away_score = nums
    home["score"] = home_score
    away["score"] = away_score

    # Codice gara / Campo
    code_el = _labeled_value(hero, "Codice gara")
    code = None
    if code_el is not None:
        code_el = BeautifulSoup(str(code_el), "html.parser")
        code_el.b.extract()
        code = _text(code_el)

    venue = None
    venue_el = _labeled_value(hero, "Campo")
    if venue_el is not None:
        link = venue_el.find("a")
        venue = {
            "name": _text(link) if link else _text(venue_el),
            "url": _abs(link.get("href") if link else None, base),
        }

    periods, events = _parse_timeline(soup)

    return {
        "url": url,
        "code": code,
        "date": date_iso,
        "time": time_str,
        "competition": _parse_competition(soup),
        "venue": venue,
        "status": status,
        "home": home,
        "away": away,
        "periods": periods,
        "events": events,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Estrae i dati di una gara CSI Live in JSON")
    src = parser.add_mutually_exclusive_group(required=True)
    src.add_argument("url", nargs="?", help="URL della pagina 'Info gara'")
    src.add_argument("--file", help="Parse da file HTML locale invece che da URL")
    parser.add_argument("--compact", action="store_true", help="JSON su una sola riga")
    args = parser.parse_args(argv)

    try:
        if args.file:
            with open(args.file, encoding="utf-8") as fh:
                html = fh.read()
            data = parse_match(html)
        else:
            data = parse_match(fetch(args.url), args.url)
    except requests.RequestException as exc:
        print(f"Errore HTTP: {exc}", file=sys.stderr)
        return 2
    except ParseError as exc:
        print(f"Errore di parsing: {exc}", file=sys.stderr)
        return 3

    json.dump(data, sys.stdout, ensure_ascii=False, indent=None if args.compact else 2)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
