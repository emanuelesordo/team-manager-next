#!/usr/bin/env python3
"""CSI Live match scraper, adapted from the user's csi-scraper-main/csi_match.py."""
import argparse
import json
import re
import sys
from datetime import datetime
from urllib.parse import urljoin, urlsplit

import requests
from bs4 import BeautifulSoup

BASE = "https://live.centrosportivoitaliano.it/"
HALF_LENGTH = 40

class ParseError(Exception):
    pass

def text(element):
    return re.sub(r"\s+", " ", element.get_text(" ", strip=True)).strip() or None if element else None

def number(value):
    match = re.search(r"-?\d+", value or "")
    return int(match.group()) if match else None

def absolute(value, base):
    return urljoin(base, value) if value else None

def player(fragment):
    fragment = re.sub(r"^\s*(Esce|Entra)\s*:\s*", "", fragment).strip()
    if not fragment:
        return None
    match = re.match(r"^(.*?)\s*\((\d+)\)\s*$", fragment)
    return {"name": match.group(1).strip(), "number": int(match.group(2))} if match else {"name": fragment, "number": None}

def get_player(element):
    return player(re.sub(r"\s+", " ", "".join(str(n) for n in element.descendants if isinstance(n, str)))) if element else None

def team(column, base):
    link = column.select_one("h5 a")
    img = column.find("img")
    return {"name": text(link) or text(column.find("h5")), "url": absolute(link.get("href") if link else None, base), "logo": img.get("src") if img else None}

def event(row):
    details = row.select_one(".event-details")
    classes = details.get("class", []) if details else []
    team_side = "home" if "event-left" in classes else "away" if "event-right" in classes else None
    icon = row.select_one(".event-icon i")
    icon_classes = icon.get("class", []) if icon else []
    kind = "unknown"
    if "fa-futbol" in icon_classes: kind = "goal"
    elif "fa-exchange" in icon_classes: kind = "substitution"
    elif "fa-rectangle-portrait" in icon_classes:
        for cls, name in (("text-danger", "red_card"), ("text-warning", "yellow_card"), ("text-info", "blue_card")):
            if cls in icon_classes:
                kind = name
                break
    result = {"minute": number(text(row.select_one(".event-time"))), "team": team_side, "type": kind}
    if kind == "goal":
        score = text(details.find("h6")) if details else None
        match = re.match(r"^(\d+)\s*-\s*(\d+)$", score or "")
        result["score"] = {"home": int(match.group(1)), "away": int(match.group(2))} if match else None
    elif kind == "substitution" and details:
        outgoing = details.select_one(".player_out")
        result["player_out"] = get_player(outgoing)
        if outgoing: outgoing.extract()
        result["player_in"] = get_player(details)
    else:
        result["player"] = get_player(details)
        if kind == "unknown":
            result["icon"] = " ".join(icon_classes) or None
            result["text"] = text(details)
    return result

def timeline(soup):
    first = soup.select_one(".event-row")
    if first is None: return [], []
    blocks, current = [], None
    for node in first.parent.find_all(recursive=False):
        classes = node.get("class", [])
        if "event-header" in classes:
            current = {"label": text(node), "stoppage_minutes": None, "rows": []}
            blocks.append(current)
        elif "event-header-info" in classes and current is not None:
            current["stoppage_minutes"] = number(text(node))
        elif "event-row" in classes:
            if current is None:
                current = {"label": None, "stoppage_minutes": None, "rows": []}
                blocks.append(current)
            current["rows"].append(node)
    periods, events = [], []
    for index, block in reversed(list(enumerate(blocks))):
        period = len(blocks) - index
        periods.append({"period": period, "label": block["label"], "stoppage_minutes": block["stoppage_minutes"]})
        for row in reversed(block["rows"]):
            item = event(row)
            minute = item["minute"]
            item["stoppage_minute"] = minute - HALF_LENGTH if minute is not None and minute > HALF_LENGTH else None
            item["minute"] = HALF_LENGTH * (period - 1) + min(minute, HALF_LENGTH) if minute is not None else None
            events.append({"period": period, **item})
    return periods, events

def labeled(hero, label):
    for bold in hero.find_all("b"):
        if text(bold) and text(bold).rstrip(":").strip().lower() == label.lower():
            return bold.parent
    return None

def parse_match(html, url=None):
    soup = BeautifulSoup(html, "html.parser")
    hero = soup.select_one(".hero-gara")
    if not hero: raise ParseError("Pagina non riconosciuta: .hero-gara assente")
    date_value = time_value = None
    pill = hero.select_one(".rounded-pill")
    if pill:
        content = text(pill) or ""
        date_match = re.search(r"(\d{2})/(\d{2})/(\d{4})", content)
        time_match = re.search(r"\b(\d{1,2}:\d{2})\b", content)
        if date_match: date_value = datetime.strptime(date_match.group(), "%d/%m/%Y").date().isoformat()
        if time_match: time_value = time_match.group(1)
    columns = hero.select(".row > .col-md-4")
    if len(columns) < 2: raise ParseError("Squadre non trovate")
    home, away = team(columns[0], url or BASE), team(columns[1], url or BASE)
    score_col = hero.select_one(".row > .col-md-3")
    status = text(score_col.select_one(".badge")) if score_col else None
    scores = [number(text(s)) for s in score_col.select("h3 > span") if text(s) and text(s) != "-"] if score_col else []
    home["score"], away["score"] = (scores[0], scores[1]) if len(scores) == 2 else (None, None)
    code_block = labeled(hero, "Codice gara")
    code = None
    if code_block:
        copied = BeautifulSoup(str(code_block), "html.parser")
        copied.b.extract()
        code = text(copied)
    venue_block = labeled(hero, "Campo")
    venue = None
    if venue_block:
        anchor = venue_block.find("a")
        venue = {"name": text(anchor) if anchor else text(venue_block), "url": absolute(anchor.get("href") if anchor else None, url or BASE)}
    labels = [text(link) for link in soup.select("ol.breadcrumb li.breadcrumb-item a")]
    labels = [label for label in labels if label]
    periods, events = timeline(soup)
    return {"url": url, "code": code, "date": date_value, "time": time_value,
            "competition": {"committee": labels[0] if len(labels)>0 else None, "sport": labels[1] if len(labels)>1 else None, "name": labels[2] if len(labels)>2 else None},
            "venue": venue, "status": status, "home": home, "away": away, "periods": periods, "events": events}

def safe_url(url):
    parts = urlsplit(url)
    if parts.scheme != "https" or parts.hostname != "live.centrosportivoitaliano.it" or parts.username or parts.password or parts.port not in (None, 443):
        raise ValueError("Usare un URL HTTPS di live.centrosportivoitaliano.it")
    if not re.fullmatch(r"/\d+/[^/]+/[^/]+/[^/]+/P[A-Za-z0-9]+/?", parts.path):
        raise ValueError("URL CSI non valido: attesa scheda Info gara")
    return url

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("url", nargs="?")
    parser.add_argument("--file", help="Leggi una pagina HTML locale")
    parser.add_argument("--output", help="Destinazione JSON")
    args = parser.parse_args()
    if not args.url and not args.file: parser.error("URL o --file richiesto")
    try:
        if args.file:
            with open(args.file, encoding="utf-8") as fp: data = parse_match(fp.read())
        else:
            url = safe_url(args.url)
            response = requests.get(url, timeout=20, headers={"User-Agent": "TeamManagerNext-CSIImporter/1.0", "Accept": "text/html"})
            response.raise_for_status()
            if urlsplit(response.url).hostname != "live.centrosportivoitaliano.it": raise ValueError("Redirect non autorizzato")
            data = parse_match(response.text, url)
        payload = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
        if args.output:
            with open(args.output, "w", encoding="utf-8") as output: output.write(payload)
        else: sys.stdout.write(payload)
        return 0
    except (requests.RequestException, ParseError, ValueError, OSError) as exc:
        print(f"Errore CSI: {exc}", file=sys.stderr)
        return 2

if __name__ == "__main__":
    sys.exit(main())
