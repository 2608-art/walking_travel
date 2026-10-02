"""한걸음 로컬 미리보기와 카카오맵 경로 API 중계 서버.

실행: python server.py
REST 키는 이 파일 옆의 .env 또는 KAKAO_REST_API_KEY 환경 변수에서만 읽습니다.
"""

import json
import os
import sqlite3
import threading
import time
import zlib
from collections import defaultdict
from contextlib import closing
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlencode, urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
CACHE = {}
DAILY_CALLS = defaultdict(int)
MAX_CALLS_PER_DAY = 200  # 무료 한도(종류별 1,000건/일)보다 낮은 로컬 안전 한도
WALK_CACHE_DB = Path(os.environ.get("HANGEORUM_ROUTE_CACHE_DB", ROOT / "route-cache.sqlite3"))
WALK_LOCKS = [threading.Lock() for _ in range(64)]
CALLS_LOCK = threading.Lock()


def walk_cache_key(coords):
    # 방향에 따라 경로가 다를 수 있으므로 출발→도착 순서를 유지한다.
    return "|".join(coords[name] for name in ("start_x", "start_y", "end_x", "end_y"))


def open_walk_cache():
    connection = sqlite3.connect(WALK_CACHE_DB, timeout=10)
    connection.execute("""CREATE TABLE IF NOT EXISTS walk_routes (
        route_key TEXT PRIMARY KEY,
        response BLOB NOT NULL,
        saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    return connection


def cached_walk_route(coords):
    with closing(open_walk_cache()) as connection:
        row = connection.execute("SELECT response FROM walk_routes WHERE route_key = ?", (walk_cache_key(coords),)).fetchone()
    return json.loads(zlib.decompress(row[0])) if row else None


def save_walk_route(coords, result):
    payload = zlib.compress(json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    with closing(open_walk_cache()) as connection:
        connection.execute("INSERT OR IGNORE INTO walk_routes (route_key, response) VALUES (?, ?)",
                           (walk_cache_key(coords), payload))
        connection.commit()


def rest_key():
    key = os.environ.get("KAKAO_REST_API_KEY", "").strip()
    if key:
        return key
    env_file = ROOT / ".env"
    if env_file.exists():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            if line.startswith("KAKAO_REST_API_KEY="):
                return line.partition("=")[2].strip().strip('"')
    return ""


def summarize(mode, data):
    if data.get("status") != "OK":
        return {"status": data.get("status", "NO_RESULTS"), "routes": []}
    source = [data.get("route", {})] if mode == "walk" else data.get("routes", [])[:3]
    routes = []
    for route in source:
        props = route.get("properties") or {}
        steps = route.get("steps") if mode == "transit" else [step for leg in route.get("legs", []) for step in leg.get("steps", [])]
        points = []
        summary_steps = []
        for step in steps or []:
            info = step.get("properties") or {}
            path = (step.get("path") or {}).get("points") or []
            points.extend(point for point in path if isinstance(point, list) and len(point) == 2)
            if mode == "transit":
                summary_steps.append({
                    "type": info.get("type", ""),
                    "guidance": info.get("guidance", ""),
                    "minutes": round((info.get("time") or 0) / 60),
                    "vehicle": ", ".join(v.get("name", "") for v in info.get("vehicles", []) if v.get("name")),
                })
        routes.append({
            "minutes": max(1, round((props.get("totalTime") or 0) / 60)),
            "meters": props.get("totalDistance") or 0,
            "transfers": props.get("transfers") or 0,
            "fare": (props.get("fare") or {}).get("value"),
            "points": points[:5000],
            "steps": summary_steps,
            "url": props.get("landingUrl") if mode == "walk" else (data.get("properties") or {}).get("landingURL"),
        })
    return {"status": "OK", "routes": routes}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(DIST), **kwargs)

    def send_json(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urlsplit(self.path)
        if parsed.path == "/api/place-search":
            key = rest_key()
            if not key:
                return self.send_json(503, {"error": "주소 검색용 REST API 키가 설정되지 않았습니다."})
            query = parse_qs(parsed.query).get("q", [""])[0].strip()
            if len(query) < 2 or len(query) > 100:
                return self.send_json(400, {"error": "주소나 장소명을 2~100자로 입력해 주세요."})
            day_key = (time.strftime("%Y-%m-%d"), "place-search")
            if DAILY_CALLS[day_key] >= MAX_CALLS_PER_DAY:
                return self.send_json(429, {"error": "오늘의 주소 검색 안전 한도에 도달했습니다."})
            results = []
            DAILY_CALLS[day_key] += 1
            try:
                for kind in ("address", "keyword"):
                    url = f"https://dapi.kakao.com/v2/local/search/{kind}.json?{urlencode({'query': query, 'size': 10})}"
                    request = Request(url, headers={"Authorization": f"KakaoAK {key}"})
                    with urlopen(request, timeout=12) as response:
                        raw = response.read(1_000_001)
                    if len(raw) > 1_000_000:
                        raise ValueError("응답이 너무 큽니다.")
                    for item in json.loads(raw).get("documents", []):
                        lat, lon = float(item["y"]), float(item["x"])
                        if 33 <= lat <= 39 and 124 <= lon <= 132:
                            results.append({"name": item.get("place_name") or item.get("address_name") or query,
                                            "address": item.get("road_address_name") or item.get("address_name") or "",
                                            "lat": lat, "lon": lon})
            except (HTTPError, URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError):
                return self.send_json(502, {"error": "온라인 주소 검색에 연결하지 못했습니다."})
            seen = set()
            unique = []
            for item in results:
                key = (round(item["lat"], 6), round(item["lon"], 6))
                if key not in seen:
                    seen.add(key)
                    unique.append(item)
            return self.send_json(200, {"results": unique[:10]})
        if parsed.path != "/api/route":
            return super().do_GET()
        values = parse_qs(parsed.query)
        mode = values.get("mode", [""])[0]
        if mode not in ("walk", "transit"):
            return self.send_json(400, {"error": "이동 수단이 올바르지 않습니다."})
        coords = {}
        try:
            for name, bounds in {"start_x": (124, 132), "end_x": (124, 132), "start_y": (33, 39), "end_y": (33, 39)}.items():
                value = float(values[name][0])
                if not bounds[0] <= value <= bounds[1]:
                    raise ValueError(name)
                coords[name] = f"{value:.7f}"
        except (KeyError, ValueError, OverflowError):
            return self.send_json(400, {"error": "국내 출발지·도착지 좌표가 필요합니다."})
        if mode == "walk":
            # 같은 구간의 동시 요청을 한 번의 API 조회와 한 번의 저장으로 합친다.
            lock = WALK_LOCKS[hash(walk_cache_key(coords)) % len(WALK_LOCKS)]
            with lock:
                try:
                    saved = cached_walk_route(coords)
                except (sqlite3.Error, OSError, ValueError, zlib.error, json.JSONDecodeError):
                    return self.send_json(500, {"error": "저장된 도보 경로를 읽지 못했습니다."})
                if saved is not None:
                    return self.send_json(200, saved)
                status, result = fetch_kakao_route(mode, coords)
                if status == 200 and result.get("status") == "OK" and result.get("routes"):
                    try:
                        save_walk_route(coords, result)
                    except (sqlite3.Error, OSError):
                        return self.send_json(500, {"error": "도보 경로를 저장하지 못했습니다."})
                return self.send_json(status, result)
        cache_key = (mode, tuple(coords.values()))
        cached = CACHE.get(cache_key)
        if cached and cached[0] > time.time():
            return self.send_json(200, cached[1])
        status, result = fetch_kakao_route(mode, coords)
        if status == 200:
            CACHE[cache_key] = (time.time() + 600, result)
        return self.send_json(status, result)


def fetch_kakao_route(mode, coords):
    key = rest_key()
    if not key:
        return 503, {"error": "REST API 키가 설정되지 않았습니다."}
    day_key = (time.strftime("%Y-%m-%d"), mode)
    with CALLS_LOCK:
        if DAILY_CALLS[day_key] >= MAX_CALLS_PER_DAY:
            return 429, {"error": "오늘의 로컬 경로 조회 안전 한도에 도달했습니다."}
        DAILY_CALLS[day_key] += 1
    endpoint = "walk" if mode == "walk" else "publictraffic"
    url = f"https://dapi.kakao.com/v2/routing/{endpoint}?{urlencode(coords)}"
    request = Request(url, headers={"Authorization": f"KakaoAK {key}"})
    try:
        with urlopen(request, timeout=12) as response:
            raw = response.read(4_000_001)
        if len(raw) > 4_000_000:
            raise ValueError("응답이 너무 큽니다.")
        return 200, summarize(mode, json.loads(raw))
    except HTTPError as exc:
        return 502, {"error": f"카카오 경로 API 오류 ({exc.code})"}
    except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
        return 502, {"error": "카카오 경로 API에 연결하지 못했습니다."}


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"한걸음 로컬 서버: http://127.0.0.1:{port}/")
    print("카카오 경로 API:", "설정됨" if rest_key() else "REST 키 미설정")
    server.serve_forever()
