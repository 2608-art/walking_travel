"""한걸음 로컬 미리보기와 카카오맵 경로 API 중계 서버.

실행: python server.py
REST 키는 이 파일 옆의 .env 또는 KAKAO_REST_API_KEY 환경 변수에서만 읽습니다.
"""

import json
import os
import time
from collections import defaultdict
from functools import partial
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
        if parsed.path != "/api/route":
            return super().do_GET()
        key = rest_key()
        if not key:
            return self.send_json(503, {"error": "REST API 키가 설정되지 않았습니다."})
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
        cache_key = (mode, tuple(coords.values()))
        cached = CACHE.get(cache_key)
        if cached and cached[0] > time.time():
            return self.send_json(200, cached[1])
        day_key = (time.strftime("%Y-%m-%d"), mode)
        if DAILY_CALLS[day_key] >= MAX_CALLS_PER_DAY:
            return self.send_json(429, {"error": "오늘의 로컬 경로 조회 안전 한도에 도달했습니다."})
        endpoint = "walk" if mode == "walk" else "publictraffic"
        url = f"https://dapi.kakao.com/v2/routing/{endpoint}?{urlencode(coords)}"
        request = Request(url, headers={"Authorization": f"KakaoAK {key}"})
        DAILY_CALLS[day_key] += 1
        try:
            with urlopen(request, timeout=12) as response:
                raw = response.read(4_000_001)
            if len(raw) > 4_000_000:
                raise ValueError("응답이 너무 큽니다.")
            result = summarize(mode, json.loads(raw))
        except HTTPError as exc:
            return self.send_json(502, {"error": f"카카오 경로 API 오류 ({exc.code})"})
        except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
            return self.send_json(502, {"error": "카카오 경로 API에 연결하지 못했습니다."})
        CACHE[cache_key] = (time.time() + 600, result)
        return self.send_json(200, result)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8765"))
    server = ThreadingHTTPServer(("127.0.0.1", port), Handler)
    print(f"한걸음 로컬 서버: http://127.0.0.1:{port}/")
    print("카카오 경로 API:", "설정됨" if rest_key() else "REST 키 미설정")
    server.serve_forever()
