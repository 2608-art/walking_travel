"""Collect review candidates for place opening hours from existing public sources.

This script never edits public/places.json. Source text is evidence for a human
review, not a declaration that a place is open on a particular travel date.
"""

import argparse
import datetime as dt
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser


ROOT = Path(__file__).resolve().parents[1]
PLACE_FILES = {"mokpo": "places.json", "gangneung": "gangneung-places.json",
               "gyeongju": "gyeongju-places.json"}
USER_AGENT = "HangeoreumHoursAudit/1.0 (+https://github.com/2608-art/walking_travel)"
OFFICIAL_HOSTS = {
    "www.mmcablecar.com", "www.mpcc1897.or.kr", "hnibr.re.kr",
    "www.seamuse.go.kr", "seafountain.mokpo.go.kr", "samhakdo-cruise.co.kr",
    "podobooks.com", "mplib.jne.go.kr", "www.bbsj.kr",
}
HOUR_WORDS = re.compile(r"운영시간|영업시간|관람시간|이용시간|개관시간|휴무|휴관|정기휴일|입장마감|입장 마감|매표마감|매표 마감|라스트오더|마지막 주문|브레이크타임|운행시간")
TIME = re.compile(r"(?<!\d)(?:[01]?\d|2[0-4])[:시][0-5]?\d?(?!\d)")
DATE = re.compile(r"\d{1,2}월\s*\d{1,2}일|\d{4}[.-]\d{1,2}[.-]\d{1,2}")


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip += 1
        elif tag in {"p", "div", "li", "tr", "br", "dd", "dt", "h1", "h2", "h3"}:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "noscript", "svg"}:
            self.skip = max(0, self.skip - 1)
        elif tag in {"p", "div", "li", "tr", "dd", "dt", "h1", "h2", "h3"}:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def official(url):
    host = (urlparse(url).hostname or "").lower()
    return host.endswith(".go.kr") or host.endswith(".visitkorea.or.kr") or host in OFFICIAL_HOSTS


def source_for(place):
    candidates = []
    for field in ("officialUrl", "scheduleSource", "source", "mapWeekSource", "diningWeekSource"):
        url = place.get(field)
        if isinstance(url, str) and url.startswith("https://") and url not in candidates:
            candidates.append(url)
    for field in ("descriptionSources", "researchSources"):
        for url in place.get(field) or []:
            if isinstance(url, str) and url.startswith("https://") and url not in candidates:
                candidates.append(url)
    explicit = place.get("officialUrl")
    if isinstance(explicit, str) and explicit.startswith("https://"):
        return explicit
    return next((url for url in candidates if (urlparse(url).hostname or "").endswith(".go.kr")), None) or next(
        (url for url in candidates if official(url)), None) or next(
        (url for url in candidates if urlparse(url).hostname == "www.diningcode.com"), None
    )


def readable(raw, headers):
    declared = headers.get_content_charset()
    head = raw[:3000].decode("ascii", "ignore")
    match = re.search(r"charset\s*=\s*['\"]?([a-zA-Z0-9_-]+)", head, re.I)
    for encoding in (declared, match.group(1) if match else None, "utf-8", "euc-kr"):
        if not encoding:
            continue
        try:
            return raw.decode(encoding)
        except (UnicodeError, LookupError):
            pass
    return raw.decode("utf-8", "replace")


def evidence(page):
    parser = Text()
    parser.feed(page)
    lines = [re.sub(r"\s+", " ", html.unescape(line)).strip() for line in "".join(parser.parts).splitlines()]
    lines = [line for line in lines if line and len(line) < 250]
    found = []
    for index, line in enumerate(lines):
        if not HOUR_WORDS.search(line):
            continue
        candidate = " ".join(lines[index:index + 2])[:260]
        # Some listing pages append a rolling seven-day navigation strip.
        # It changes every day even when opening hours have not changed.
        if len(DATE.findall(candidate)) > 2:
            continue
        if candidate not in found and (TIME.search(candidate) or DATE.search(candidate) or re.search(r"휴무|휴관", candidate)):
            found.append(candidate)
        if len(found) == 5:
            break
    return found


def robot_for(url, cache):
    parsed = urlparse(url)
    host = parsed.scheme + "://" + parsed.netloc
    if host not in cache:
        robot = RobotFileParser()
        try:
            request = Request(host + "/robots.txt", headers={"User-Agent": USER_AGENT})
            with urlopen(request, timeout=8) as response:
                raw = response.read(100_001)
                if len(raw) > 100_000:
                    raise ValueError("robots.txt too large")
                robot.parse(readable(raw, response.headers).splitlines())
            cache[host] = robot
        except HTTPError as exc:
            if exc.code in (404, 410):
                robot.parse([])
                cache[host] = robot
            else:
                cache[host] = None
        except Exception:
            cache[host] = None
    return cache[host]


def inspect(place, robot_cache, request_cache):
    url = source_for(place)
    result = {"id": place["id"], "name": place["name"], "category": place["category"],
              "location": place.get("locationText") or "위치 미기록",
              "appHours": place.get("scheduleText") or "미확인", "appClosure": place.get("closureText") or "미확인",
              "source": url, "sourceType": "공식" if url and (official(url) or url == place.get("officialUrl"))
              else "보조" if url else "없음"}
    if not url:
        return {**result, "status": "no_source", "evidence": []}
    robot = robot_for(url, robot_cache)
    if robot is None or not robot.can_fetch(USER_AGENT, url):
        return {**result, "status": "not_fetchable", "evidence": []}
    if url not in request_cache:
        delay = robot.crawl_delay(USER_AGENT) or 0
        host = urlparse(url).netloc
        last = request_cache.get("last:" + host, 0)
        if delay and last:
            time.sleep(max(0, min(delay, 15) - (time.monotonic() - last)))
        try:
            request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
            with urlopen(request, timeout=15) as response:
                raw = response.read(1_000_001)
                if len(raw) > 1_000_000:
                    raise ValueError("응답 크기 초과")
                page = readable(raw, response.headers)
            request_cache[url] = ("ok", evidence(page))
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            request_cache[url] = ("fetch_error", [type(exc).__name__])
        request_cache["last:" + host] = time.monotonic()
    status, snippets = request_cache[url]
    if status == "ok" and not snippets:
        status = "no_hours_visible"
    return {**result, "status": status, "evidence": snippets}


def run(scope, region, ids=None):
    data = json.loads((ROOT / "public" / PLACE_FILES[region]).read_text(encoding="utf-8"))
    frequent = {"culture", "experience", "food", "cafe"}
    selected = [place for place in data["places"] if
                ((place["category"] in frequent) == (scope == "weekly")) and
                (not ids or place["id"] in ids)]
    robots, requests = {}, {}
    rows = []
    for index, place in enumerate(selected, 1):
        rows.append(inspect(place, robots, requests))
        if index % 25 == 0:
            print(f"{region}: {index}/{len(selected)} places inspected", flush=True)
    return {"checkedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
            "scope": scope, "region": region, "regionReady": region == "mokpo",
            "placesCount": len(selected), "rows": rows}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scope", choices=("weekly", "monthly"), required=True)
    parser.add_argument("--region", choices=tuple(PLACE_FILES), required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--ids", nargs="*", help="Inspect only these IDs for diagnostics")
    args = parser.parse_args()
    report = run(args.scope, args.region, set(args.ids) if args.ids else None)
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    statuses = {key: sum(row["status"] == key for row in report["rows"]) for key in
                ("ok", "no_source", "not_fetchable", "fetch_error", "no_hours_visible")}
    print(json.dumps({"scope": args.scope, "region": args.region,
                      "places": report["placesCount"], **statuses}, ensure_ascii=False))


if __name__ == "__main__":
    main()
