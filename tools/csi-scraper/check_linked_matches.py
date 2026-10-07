"""Read linked fixtures from JSON and produce JSONL proposals; never edits official data.

Usage: .venv/bin/python check_linked_matches.py fixtures.json results.jsonl
Input: [{id, source_url, match_code, home_team, away_team, minutes_per_period}]
"""
import json
import sys
import time
import re
import unicodedata
from urllib.parse import urlparse, urljoin
import requests
import csi_match


def validate_url(url):
    parsed = urlparse(url)
    if (parsed.scheme != 'https' or parsed.hostname != 'live.centrosportivoitaliano.it'
            or parsed.port or parsed.username or parsed.password
            or not re.fullmatch(r'/\d+/Calcio-a-11/[^/]+/[^/]+/[^/]+/', parsed.path)):
        raise ValueError('Link CSI non valido')
    return url


def fetch_page(url):
    for _ in range(4):
        validate_url(url)
        with requests.get(url, headers={'User-Agent': csi_match.USER_AGENT},
                          timeout=20, allow_redirects=False, stream=True) as response:
            if response.status_code in (301, 302, 303, 307, 308):
                url = urljoin(url, response.headers['Location'])
                continue
            response.raise_for_status()
            if 'text/html' not in response.headers.get('Content-Type', '').lower():
                raise ValueError('La risposta CSI non è HTML')
            parts, size = [], 0
            for chunk in response.iter_content(65536):
                size += len(chunk)
                if size > 2000000:
                    raise ValueError('Pagina CSI troppo grande')
                parts.append(chunk)
            return b''.join(parts).decode('utf-8')
    raise ValueError('Troppi redirect CSI')


def norm(value):
    value = unicodedata.normalize('NFD', str(value or '').strip().lower())
    value = ''.join(c for c in value if not unicodedata.combining(c))
    return re.sub('[^a-z0-9]+', ' ', value).strip()


def check_fixture(fixture):
    csi_match.HALF_LENGTH = int(fixture.get('minutes_per_period') or 40)
    payload = csi_match.parse_match(fetch_page(fixture['source_url']), fixture['source_url'])
    if not payload.get('code') or not payload['home']['name'] or not payload['away']['name']:
        raise ValueError('Identità gara CSI incompleta')
    for expected, actual in [(fixture.get('match_code'), payload['code']),
                             (fixture['home_team'], payload['home']['name']),
                             (fixture['away_team'], payload['away']['name'])]:
        if expected and norm(expected) != norm(actual):
            raise ValueError(f'Identità gara non corrispondente: atteso {expected}, ricevuto {actual}')
    return payload


def main():
    fixtures = json.load(open(sys.argv[1], encoding='utf-8'))
    errors = 0
    with open(sys.argv[2], 'w', encoding='utf-8') as output:
        for fixture in fixtures:
            row = {'fixture_id': fixture['id'], 'source_url': fixture['source_url']}
            try:
                row['payload'] = check_fixture(fixture)
                print(f"{fixture['match_code']}: OK, {len(row['payload']['events'])} eventi", flush=True)
            except Exception as exc:
                # Do not copy request URLs or query strings into persistent error messages.
                row['error'] = (f'CSI HTTP {exc.response.status_code}' if isinstance(exc, requests.HTTPError)
                                else 'Timeout CSI' if isinstance(exc, requests.Timeout)
                                else str(exc).split('?')[0][:300])
                errors += 1
                print(f"{fixture['match_code']}: {row['error']}", flush=True)
            output.write(json.dumps(row, ensure_ascii=False) + '\n')
            output.flush()
            time.sleep(1)
    print(f'{len(fixtures)} controlli, {errors} errori', flush=True)
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
