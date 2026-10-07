"""한걸음 로컬 미리보기와 카카오맵 경로 API 중계 서버.

실행: python server.py
REST 키는 이 파일 옆의 .env 또는 KAKAO_REST_API_KEY 환경 변수에서만 읽습니다.
키 없는 미리보기에서 HANGEORUM_ROUTE_PROXY를 설정하면 해당 사이트의 경로 API를 사용합니다.
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
DIST = ROOT / "dist" / "client" if (ROOT / "dist" / "client").is_dir() else ROOT / "dist"
DAILY_CALLS = defaultdict(int)
MAX_CALLS_PER_DAY = 200  # 무료 한도(종류별 1,000건/일)보다 낮은 로컬 안전 한도
WALK_CACHE_DB = Path(os.environ.get("HANGEORUM_ROUTE_CACHE_DB", ROOT / "route-cache.sqlite3"))
WALK_LOCKS = [threading.Lock() for _ in range(64)]
CALLS_LOCK = threading.Lock()


def registered_points():
    """저장 자격은 클라이언트 플래그가 아닌 앱 원본 장소 데이터로 판정한다."""
    places = json.loads((DIST / "places.json").read_text(encoding="utf-8"))["places"]
    places.extend(json.loads((DIST / "gangneung-places.json").read_text(encoding="utf-8"))["places"])
    places.extend(json.loads((DIST / "gyeongju-places.json").read_text(encoding="utf-8"))["places"])
    places.append({"id": "station", "lat": 34.7914, "lon": 126.3859})
    places.append({"id": "gangneung-station", "lat": 37.7641331, "lon": 128.8997106})
    places.append({"id": "gyeongju-station", "lat": 35.7983772522824, "lon": 129.138999419567})
    return {p["id"]: (f'{p["lon"]:.7f}', f'{p["lat"]:.7f}') for p in places
            if isinstance(p.get("lat"), (int, float)) and isinstance(p.get("lon"), (int, float))}


REGISTERED_POINTS = registered_points()


def can_persist_walk(coords, start_id, end_id):
    return (REGISTERED_POINTS.get(start_id) == (coords["start_x"], coords["start_y"])
            and REGISTERED_POINTS.get(end_id) == (coords["end_x"], coords["end_y"]))


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
    connection.execute("""CREATE TABLE IF NOT EXISTS bus_routes (
        route_key TEXT PRIMARY KEY,
        response TEXT NOT NULL,
        average_ride_seconds INTEGER NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 1,
        saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    return connection


def cached_walk_route(coords, start_id="", end_id=""):
    if not can_persist_walk(coords, start_id, end_id):
        return None
    with closing(open_walk_cache()) as connection:
        row = connection.execute("SELECT response FROM walk_routes WHERE route_key = ?", (walk_cache_key(coords),)).fetchone()
    return json.loads(zlib.decompress(row[0])) if row else None


def save_walk_route(coords, result, start_id="", end_id=""):
    if not can_persist_walk(coords, start_id, end_id):
        return
    payload = zlib.compress(json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))
    with closing(open_walk_cache()) as connection:
        connection.execute("INSERT OR IGNORE INTO walk_routes (route_key, response) VALUES (?, ?)",
                           (walk_cache_key(coords), payload))
        connection.commit()


def bus_identity(route):
    if route.get("transfers", 0) > 0 or any(step.get("type") not in ("WALK", "WALKING", "BUS") for step in route.get("steps", [])):
        return ""
    buses = [step for step in route.get("steps", []) if step.get("type") == "BUS"]
    if len(buses) != 1 or not buses[0].get("vehicle") or len(buses[0].get("stops") or []) < 2:
        return ""
    bus = buses[0]
    return ":".join((bus["vehicle"], bus["stops"][0], bus["stops"][-1]))


def route_with_bus_average(route, seconds):
    minutes = round(seconds / 60)
    walking = route.get("walkMinutes")
    return {**route, "minutes": max(1, walking + minutes) if isinstance(walking, (int, float)) else None,
            "busRideSeconds": seconds, "busRideMinutes": minutes,
            "steps": [{**step, "minutes": minutes} if step["type"] == "BUS" else step
                      for step in route["steps"]]}


def valid_point(point):
    return (isinstance(point, list) and len(point) == 2
            and all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in point)
            and 124 <= point[0] <= 132 and 33 <= point[1] <= 39)


def coordinate_pair(start, end):
    return {"start_x": f"{start[0]:.7f}", "start_y": f"{start[1]:.7f}",
            "end_x": f"{end[0]:.7f}", "end_y": f"{end[1]:.7f}"}


def access_walk(start, end, saved=None):
    pair = coordinate_pair(start, end)
    if saved and saved.get("coords") == pair:
        return saved
    if start == end:
        return {"coords": pair, "minutes": 0, "meters": 0, "points": [start]}
    status, result = fetch_kakao_route("walk", pair)
    if status != 200 or result.get("status") != "OK" or not result.get("routes"):
        return None
    route = result["routes"][0]
    points = route.get("points") or []
    if len(points) < 2 or not all(valid_point(point) for point in points):
        return None
    if not isinstance(route.get("minutes"), (int, float)) or not isinstance(route.get("meters"), (int, float)):
        return None
    return {"coords": pair, "minutes": route["minutes"], "meters": route["meters"],
            "points": points}


def saved_bus_response(connection, coords, identity):
    key = "bus:" + walk_cache_key(coords) + ":" + identity
    row = connection.execute("SELECT response FROM bus_routes WHERE route_key = ?", (key,)).fetchone()
    return json.loads(row[0]) if row else None


def complete_bus_access(route, coords, saved=None):
    buses = [step for step in route.get("steps", []) if step.get("type") == "BUS"]
    if len(buses) != 1 or not bus_identity(route):
        return route
    bus = buses[0]
    path = bus.get("points") or []
    if len(path) < 2 or not valid_point(path[0]) or not valid_point(path[-1]):
        return route
    boarding, alighting = path[0], path[-1]
    bus_stops = {"boarding": {"name": bus["stops"][0], "lon": boarding[0], "lat": boarding[1]},
                 "alighting": {"name": bus["stops"][-1], "lon": alighting[0], "lat": alighting[1]},
                 "positionBasis": "bus-step-path"}
    if not route.get("busAccessUnknown"):
        return {**route, "busStops": bus_stops}
    origin = [float(coords["start_x"]), float(coords["start_y"])]
    destination = [float(coords["end_x"]), float(coords["end_y"])]
    before = access_walk(origin, boarding, (saved or {}).get("accessWalk"))
    after = access_walk(alighting, destination, (saved or {}).get("egressWalk"))
    if before is None or after is None:
        return {**route, "busStops": bus_stops}
    access_step = {"type": "WALK", "guidance": "승차 정류장까지 도보", "minutes": before["minutes"],
                   "meters": before["meters"], "vehicle": "", "stops": [], "points": before["points"]}
    egress_step = {"type": "WALK", "guidance": "하차 정류장에서 도보", "minutes": after["minutes"],
                   "meters": after["meters"], "vehicle": "", "stops": [], "points": after["points"]}
    walking_minutes = before["minutes"] + after["minutes"]
    return {**route, "minutes": walking_minutes + (route.get("busRideMinutes") or 0),
            "walkMeters": before["meters"] + after["meters"], "walkMinutes": walking_minutes,
            "busAccessUnknown": False, "accessWalk": before, "egressWalk": after,
            "busStops": bus_stops, "steps": [access_step, bus, egress_step],
            "points": (before["points"] + path + after["points"])[:5000]}


def compare_and_save_bus_route(connection, coords, route):
    identity = bus_identity(route)
    seconds = route.get("busRideSeconds")
    if not identity or not isinstance(seconds, (int, float)) or seconds <= 0:
        return route
    key = "bus:" + walk_cache_key(coords) + ":" + identity
    previous = connection.execute(
        "SELECT average_ride_seconds, sample_count FROM bus_routes WHERE route_key = ?", (key,)
    ).fetchone()
    if previous is None:
        connection.execute(
            "INSERT OR IGNORE INTO bus_routes (route_key, response, average_ride_seconds, sample_count) VALUES (?, ?, ?, 1)",
            (key, json.dumps(route, ensure_ascii=False, separators=(",", ":")), seconds)
        )
        return {**route, "busCacheStatus": "new", "baselineBusRideSeconds": seconds, "baselineSampleCount": 1}
    baseline, count = previous
    if baseline <= 0 or count < 1:
        return route
    difference = seconds - baseline
    significant = abs(difference) >= 300 and abs(difference) >= baseline * .2
    if significant and difference > 0:
        connection.execute(
            "UPDATE bus_routes SET response = ?, checked_at = CURRENT_TIMESTAMP WHERE route_key = ?",
            (json.dumps(route, ensure_ascii=False, separators=(",", ":")), key)
        )
        return {**route, "busCacheStatus": "longer", "baselineBusRideSeconds": baseline,
                "baselineSampleCount": count, "currentBusRideSeconds": seconds,
                "rideDifferenceSeconds": difference}
    if significant and difference < 0:
        connection.execute(
            "UPDATE bus_routes SET response = ?, average_ride_seconds = ?, sample_count = 1, checked_at = CURRENT_TIMESTAMP WHERE route_key = ?",
            (json.dumps(route, ensure_ascii=False, separators=(",", ":")), seconds, key)
        )
        return {**route, "busCacheStatus": "shorter-reset", "baselineBusRideSeconds": seconds,
                "baselineSampleCount": 1}
    next_count = min(20, count + 1)
    average = round((baseline * min(count, 19) + seconds) / next_count)
    connection.execute(
        "UPDATE bus_routes SET response = ?, average_ride_seconds = ?, sample_count = ?, checked_at = CURRENT_TIMESTAMP WHERE route_key = ?",
        (json.dumps(route, ensure_ascii=False, separators=(",", ":")), average, next_count, key)
    )
    return {**route_with_bus_average(route, average),
            "busCacheStatus": "reused", "baselineBusRideSeconds": average,
            "baselineSampleCount": next_count, "currentBusRideSeconds": seconds}


def cached_bus_route(connection, coords):
    prefix = "bus:" + walk_cache_key(coords) + ":"
    row = connection.execute(
        "SELECT response, average_ride_seconds, sample_count FROM bus_routes "
        "WHERE route_key LIKE ? ORDER BY checked_at DESC LIMIT 1", (prefix + "%",)
    ).fetchone()
    if row is None:
        return None
    route = json.loads(row[0])
    average, count = row[1:]
    return {**route_with_bus_average(route, average),
            "busCacheStatus": "currentUnavailable", "currentUnavailable": True,
            "baselineBusRideSeconds": average, "baselineSampleCount": count}


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
        walking = [step for step in steps or [] if (step.get("properties") or {}).get("type") in ("WALK", "WALKING")]
        vehicles = [step for step in steps or [] if (step.get("properties") or {}).get("type") not in ("WALK", "WALKING")]
        walking_seconds = sum((step.get("properties") or {}).get("time") or 0 for step in walking)
        walking_meters = sum((step.get("properties") or {}).get("distance") or 0 for step in walking)
        vehicle_seconds = sum((step.get("properties") or {}).get("time") or 0 for step in vehicles)
        bus_seconds = sum((step.get("properties") or {}).get("time") or 0 for step in vehicles
                          if (step.get("properties") or {}).get("type") == "BUS")
        access_unknown = mode == "transit" and not walking
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
                    "meters": info.get("distance") or 0,
                    "vehicle": ", ".join(v.get("name", "") for v in info.get("vehicles", []) if v.get("name")),
                    "stops": [stop.get("name") for stop in info.get("stops", []) if stop.get("name")],
                    "points": [point for point in path if isinstance(point, list) and len(point) == 2][:5000],
                })
        routes.append({
            "minutes": None if access_unknown else max(1, round((walking_seconds + vehicle_seconds if mode == "transit"
                                     else props.get("totalTime") or 0) / 60)),
            "meters": props.get("totalDistance") or 0,
            "walkMeters": None if access_unknown else walking_meters if mode == "transit" else props.get("totalDistance") or 0,
            "walkMinutes": None if access_unknown else max(0, round(walking_seconds / 60)) if mode == "transit"
            else max(1, round((props.get("totalTime") or 0) / 60)),
            "busRideSeconds": bus_seconds if mode == "transit" and bus_seconds > 0 else None if mode == "transit" else 0,
            "busRideMinutes": round(bus_seconds / 60) if mode == "transit" and bus_seconds > 0 else None if mode == "transit" else 0,
            **({"transitTimeBasis": "walking-and-vehicle-steps-excluding-wait"} if mode == "transit" else {}),
            **({"busAccessUnknown": access_unknown} if mode == "transit" else {}),
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

    def log_request(self, code="-", size="-"):
        # 주소 검색어와 임시 좌표가 서버 접근 로그에 남지 않도록 쿼리를 제외한다.
        self.log_message('"%s %s %s" %s %s', self.command, urlsplit(self.path).path,
                         self.request_version, str(code), str(size))

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
            start_id = values.get("start_id", [""])[0]
            end_id = values.get("end_id", [""])[0]
            if not can_persist_walk(coords, start_id, end_id):
                # 임의 주소/현재 위치는 기존 공통 캐시도 읽지 않고 요청 시 계산한다.
                status, result = fetch_kakao_route(mode, coords, start_id, end_id)
                return self.send_json(status, result)
            # 같은 구간의 동시 요청을 한 번의 API 조회와 한 번의 저장으로 합친다.
            lock = WALK_LOCKS[hash(walk_cache_key(coords)) % len(WALK_LOCKS)]
            with lock:
                try:
                    saved = cached_walk_route(coords, start_id, end_id)
                except (sqlite3.Error, OSError, ValueError, zlib.error, json.JSONDecodeError):
                    return self.send_json(500, {"error": "저장된 도보 경로를 읽지 못했습니다."})
                if saved is not None:
                    return self.send_json(200, saved)
                status, result = fetch_kakao_route(mode, coords, start_id, end_id)
                if status == 200 and result.get("status") == "OK" and result.get("routes"):
                    try:
                        save_walk_route(coords, result, start_id, end_id)
                    except (sqlite3.Error, OSError):
                        return self.send_json(500, {"error": "도보 경로를 저장하지 못했습니다."})
                return self.send_json(status, result)
        start_id = values.get("start_id", [""])[0]
        end_id = values.get("end_id", [""])[0]
        registered_pair = can_persist_walk(coords, start_id, end_id)
        # 버스는 현재 조회값을 매번 비교해야 하므로 짧은 메모리 캐시도 사용하지 않는다.
        status, result = fetch_kakao_route(mode, coords, start_id, end_id)
        if not registered_pair and status == 200 and result.get("status") == "OK":
            result["routes"] = [complete_bus_access(route, coords) for route in result.get("routes", [])]
        if registered_pair:
            try:
                with closing(open_walk_cache()) as connection:
                    if status == 200 and result.get("status") == "OK":
                        lock = WALK_LOCKS[hash(walk_cache_key(coords)) % len(WALK_LOCKS)]
                        with lock:
                            enriched = []
                            for route in result.get("routes", []):
                                identity = bus_identity(route)
                                saved = saved_bus_response(connection, coords, identity) if identity else None
                                route = complete_bus_access(route, coords, saved)
                                enriched.append(compare_and_save_bus_route(connection, coords, route))
                            result["routes"] = enriched
                            connection.commit()
                    elif status != 200:
                        saved = cached_bus_route(connection, coords)
                        if saved is not None:
                            return self.send_json(200, {"status": "OK", "routes": [saved]})
            except (sqlite3.Error, OSError, ValueError, json.JSONDecodeError, KeyError):
                return self.send_json(500, {"error": "저장된 버스 경로를 처리하지 못했습니다."})
        return self.send_json(status, result)


def fetch_kakao_route(mode, coords, start_id="", end_id=""):
    key = rest_key()
    if not key:
        proxy = os.environ.get("HANGEORUM_ROUTE_PROXY", "").rstrip("/")
        if not proxy:
            return 503, {"error": "REST API 키가 설정되지 않았습니다."}
        query = urlencode({"mode": mode, **coords, "start_id": start_id, "end_id": end_id})
        try:
            with urlopen(Request(f"{proxy}/api/route?{query}", headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"}), timeout=15) as response:
                raw = response.read(4_000_001)
            if len(raw) > 4_000_000:
                raise ValueError("응답이 너무 큽니다.")
            result = json.loads(raw)
            if result.get("status") != "OK" or not isinstance(result.get("routes"), list):
                raise ValueError("경로 응답이 올바르지 않습니다.")
            return 200, result
        except HTTPError as exc:
            return 502, {"error": f"미리보기 경로 API 오류 ({exc.code})"}
        except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
            return 502, {"error": "미리보기 경로 API에 연결하지 못했습니다."}
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
