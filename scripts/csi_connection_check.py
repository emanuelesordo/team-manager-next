#!/usr/bin/env python3
"""Non-authenticated CSI Live reachability probe for GitHub Actions.

No credentials, session data, match pages or personal information are fetched.
This is NOT the automated CSI data importer.
"""
import json
import sys
import urllib.error
import urllib.request
from urllib.parse import urlsplit

HOST = "live.centrosportivoitaliano.it"
URL = "https://" + HOST + "/robots.txt"


class RestrictedRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parts = urlsplit(newurl)
        if parts.scheme != "https" or parts.hostname != HOST:
            raise ValueError("Redirect outside approved CSI Live host")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def check() -> int:
    opener = urllib.request.build_opener(RestrictedRedirect())
    request = urllib.request.Request(
        URL,
        headers={
            "User-Agent": "TeamManagerNext-IntegrationCheck/1.0",
            "Accept": "text/plain",
        },
    )
    try:
        with opener.open(request, timeout=15) as response:
            data = response.read(64 * 1024 + 1)
            if len(data) > 64 * 1024:
                raise ValueError("CSI robots.txt exceeds safe probe size")
            rules = data.decode("utf-8", errors="replace")
            allowed = "User-Agent: *" in rules or "User-agent: *" in rules
            print(json.dumps({"host": HOST, "http_status": response.status, "robots_global_group_present": allowed, "csi_login": "not_configured", "import": "not_executed"}))
            return 0 if response.status == 200 else 1
    except (urllib.error.URLError, TimeoutError, ValueError) as error:
        print(json.dumps({"host": HOST, "status": "unreachable", "error_type": type(error).__name__, "csi_login": "not_configured", "import": "not_executed"}), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(check())
