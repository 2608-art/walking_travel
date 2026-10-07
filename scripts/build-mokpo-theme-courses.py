"""Build offline, saved Mokpo theme courses from the app's place pins.

Routing is generated once against the same public gpx.studio GraphHopper
walking endpoint used by its editor. The app consumes only the saved outputs.
"""
from __future__ import annotations

import concurrent.futures
import datetime as dt
import html
import itertools
import json
import math
import os
import random
import re
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLACES_PATH = ROOT / "public" / "places.json"
CATALOG_PATH = ROOT / "public" / "theme-courses.json"
GEOJSON_PATH = ROOT / "public" / "theme-courses.geojson"
GPX_PATH = ROOT / "public" / "theme-courses.gpx"
THEME_PLAN_PATH = ROOT / "public" / "theme-review-plans.json"
PLAN_RESEARCH_PATH = ROOT / "research" / "mokpo-review-plans-2026-10-07.json"
ENDPOINT = "https://graphhopper.gpx.studio/route"
THEME_NAMES = {
    "oldtown": "근대거리·시장",
    "seosandong": "서산동 골목",
    "gatbawi": "갓바위 문화타운",
    "peace": "평화광장·밤바다",
    "samhakdo": "삼학도 해양·평화",
    "cafeWalk": "원도심 카페 산책",
}
RADIUS_KM = {"oldtown": 1.15, "seosandong": 0.8, "gatbawi": 1.55, "peace": 1.25, "samhakdo": 1.25}
VISIT_MINUTES = {"culture": 45, "experience": 40, "outdoors": 35, "market": 25, "food": 60, "cafe": 40, "books": 25}

# Hand-reviewed orders prioritize a continuous walk over names or content order.
# Use the saved pedestrian network to check the chosen order; never treat straight
# line proximity as proof that a connection is walkable. Keep unresolved legs review-only.
WALK_ORDER_POLICY = (
    "테마에 맞는 대표성과 고유한 콘텐츠가 있는 장소를 먼저 고르고, 후보 간 적합성이 비슷하면 실제 보행 거리가 짧고 자연스럽게 이어지는 곳을 우선한다. "
    "최종 방문 순서는 지도 핀 직선이 아니라 실제 보행 동선과 진행 방향을 우선한다. "
    "직선거리만으로 순서를 정하지 않고, 저장 보행망과 방향을 기준으로 가까운 다음 장소로 이어가며 "
    "이미 지난 권역으로 불필요하게 되돌아가지 않는다. 시내 대표점에서 시작하고 식사·카페도 동선에 배치한다. "
    "사용자가 지정한 장소 순서가 있으면 우선한다. 지도 UI·출입구를 확인하지 못한 구간은 미확인으로 표시한다."
)
CURATED_ROUTES = {
    "oldtown": {
        "stops": ["p115", "p113", "p125", "p96", "p9", "p120", "p64", "p31"],
        "start": 9 * 60,
        "meal_policy": "snack-half-day",
        "meal_slots": {"p64": "점심"},
        "stay_minutes": {"p64": 45, "p96": 30},
        "specialty_menu_overrides": {"p115": {"label": "목화솜빵·비파다쿠아즈·맛김새우칩(목포 대표 주전부리)", "price": "가격 확인 필요", "source": "https://tour.mokpo.go.kr/tour/food_100/mokpo_snack", "checked": "2026-10-07"}},
        "review": "목포역 인근에서 09:00 출발해 책방과 시장 간식거리에서 남쪽으로 이어가는 반일 코스. 비팡이네 이후 노적봉 방향의 U자형 보행 우회와 전시관 권역의 되짚기를 피하려고 노적봉·노적봉예술공원미술관·근대역사관 1관은 제외하고, 무가보·근대역사관 2관·목포쫀드기·정성김밥·소년 김대중 공부방으로 연결했다. 씨엘비베이커리의 목포 대표 주전부리 3종과 무가보 치즈케이크를 포함해 간식·카페 중심으로 구성하고 식사는 점심 한 곳만 둔다. 아침은 09:00 출발이라 제외하고 저녁 식사 시간 전 마친다. 가격·당일 판매와 재고는 방문 전에 확인.",
        "access": "목포역 인근 대표 출발점에서 시작해 남쪽으로 진행하는 반일 동선. 종점은 소년 김대중 공부방이며 목포역 귀환 경로는 별도 포함하지 않았다. 실제 보행 UI·출입구·방문일 운영은 미확인.",
    },
    "seosandong": {
        "stops": ["p61", "p8", "p128", "p118", "p83", "p10", "p11"],
        "start": 8 * 60 + 30,
        "fixed_arrivals": {"p128": 11 * 60, "p118": 11 * 60 + 30, "p83": 12 * 60},
        "meal_slots": {"p61": "아침", "p83": "점심"},
        "walk_ui_checks": [
            {"fromId": "p83", "toId": "p10", "meters": 1300, "minutes": 26,
             "source": "https://map.kakao.com/link/by/walk/%EB%9D%BC%EB%A9%98%EC%A7%91%EC%95%84%EC%A0%80%EC%94%A8,34.7900432,126.3835452/%EC%84%9C%EC%82%B0%EB%8F%99%20%EC%8B%9C%ED%99%94%EA%B3%A8%EB%AA%A9,34.7826234,126.3768046",
             "note": "Kakao 도보 UI의 최단거리 1.3km·26분(큰길우선 1.5km·27분). 최단 경로선은 계단·경사 여부를 별도 확인하지 못해 큰길우선 안을 우선 참고."},
        ],
        "review": "목포역 인근 시내 아침에서 시작해 근대역사관·책방·점심을 거쳐 서산동 시화골목과 보리마당에서 마치는 반일 코스.",
        "access": "목포역 인근 시내에서 서산동까지의 저장 보행망은 기존 선을 분리해 재사용. 실제 숙소 위치·출입구·언덕·계단 확인 필요.",
    },
    "gatbawi": {
        "stops": ["p61", "p43", "p33", "p25", "p16", "p55", "p101", "p56"],
        "start": 8 * 60 + 30,
        "fixed_arrivals": {"p55": 13 * 60 + 45, "p56": 17 * 60},
        "meal_slots": {"p61": "아침", "p55": "점심", "p56": "저녁"},
        "review": "시내 콩물 아침 후 남농로 전시시설을 서쪽에서 동쪽으로 걷고, 해초비빔밥 점심·드립커피·회굴비 저녁으로 구성. 갓바위 다리(p7)는 재개방 근거가 불명확해 제외. 통합권 시설을 중복 방문으로 세지 않도록 p20·p21은 제외.",
        "access": "목포역 인근 대표 출발점부터 아침 식사와 전시구역까지 모두 도보 길선에 포함. 숙소 실제 위치와 경사·횡단은 별도 확인 필요.",
    },
    "peace": {
        "stops": ["p101", "p14", "p55", "p74"],
        "start": 15 * 60 + 30,
        "fixed_arrivals": {"p14": 17 * 60 + 15, "p55": 18 * 60 + 30, "p15": 20 * 60, "p74": 20 * 60 + 50},
        "stay_minutes": {"p14": 60, "p15": 30, "p74": 40},
        "meal_slots": {"p55": "저녁", "p74": "간식"},
        "events": [{"placeId": "p15", "name": "춤추는 바다분수 공연", "arrival": "20:00", "durationMinutes": 30, "source": "https://www.mokpo.go.kr/www/mokpo_news/press_release/report_material?idx=543778&mode=view", "note": "공연 무대 핀은 바다 위 좌표라 도보 길선에 연결하지 않음. 광장 쪽 관람 진입점·당일 운영은 미확인."}],
        "transit_access": {"fromId": "station", "toId": "p101", "mode": "bus", "route": "66", "minutes": 50, "lastMileWalkMinutes": 14, "headwayMinutes": 20, "source": "https://www.google.com/maps/dir/?api=1&origin=34.7914%2C126.3859&destination=34.7956475%2C126.4306203&travelmode=transit", "checkedOn": "2026-10-07", "note": "Google 지도 결과에 66번 1회, 총 50분, 마지막 도보 14분, 20분 간격이 표시됨. 실제 승하차 정류장·대기시간·카페 출입구 접근은 출발 시각과 현장에서 재확인 필요."},
        "map_walk_legs": [
            {"fromId": "p101", "toId": "p14", "meters": 292, "minutes": 5,
             "source": "https://map.kakao.com/link/by/walk/%EC%BB%A4%ED%94%BC%EC%B0%BD%EA%B3%A0%EB%A1%9C,34.7956475,126.4306203/%ED%8F%89%ED%99%94%EA%B4%91%EC%9E%A5,34.7960696,126.4330925",
             "note": "Kakao 도보 UI에서 경로선 292m·5분 확인. gpx.studio 길선 1.20km와 불일치해 잘못된 길선을 제외. Kakao UI에 표시된 경로는 링크에서 재확인."},
            {"fromId": "p14", "toId": "p55", "meters": 444, "minutes": 7,
             "source": "https://map.kakao.com/link/by/walk/%ED%8F%89%ED%99%94%EA%B4%91%EC%9E%A5,34.7960696,126.4330925/%ED%95%B4%EB%B9%94,34.7946403,126.4300707",
             "note": "Kakao 도보 UI에서 경로선 444m·7분 확인. gpx.studio 길선 1.14km와 불일치해 잘못된 길선을 제외. Kakao UI에 표시된 경로는 링크에서 재확인."}
        ],
        "access": "목포역 대표점에서 평화광장 첫 카페까지 버스 66번 1회 접근. Google 지도 표시 50분에 마지막 도보 14분 포함, 배차 간격 20분. 승하차 정류장·실제 대기·출입구는 미확인. 저녁 전용 테마이므로 점심까지는 시내에서 따로 해결하는 일정.",
        "review": "평화광장 저녁 코스로 구성. 카페에서 시작해 광장 산책 후 저녁 한 끼를 먹고, 날짜별 운영이 맞으면 20:00 바다분수 공연을 본 뒤 원형로 포장마차 간식으로 마침. 늦은 점심과 저녁을 1시간 간격으로 붙이던 이전 구성은 제거. Kakao 도보 UI는 카페→광장 292m·5분, 광장→해빔 444m·7분을 표시했으나 gpx.studio는 각각 1.20km·1.14km 우회해 그 선형을 제거하고 Kakao 경로 링크만 남김. 공연은 요일·계절·기상에 따라 운영 여부를 다시 확인해야 함.",
    },
    "samhakdo": {
        # Map stop numbers 7 → 5 → 6 → 8: park → memorial → science museum → harbor.
        "stops": ["p61", "p114", "p31", "p51", "p26", "p30", "p32", "p53"],
        "start": 8 * 60 + 30,
        "fixed_arrivals": {"p51": 11 * 60 + 30, "p53": 17 * 60 + 30},
        "stay_minutes": {"p32": 90, "p26": 90},
        "meal_slots": {"p61": "아침", "p51": "점심", "p53": "저녁"},
        "walk_ui_checks": [
            {"fromId": "p30", "toId": "p32", "provider": "Naver", "meters": 398, "minutes": 6,
             "source": "https://map.naver.com/p/directions/3yT5DQ,2yTfv4,%EA%B9%80%EB%8C%80%EC%A4%91%20%EB%85%B8%EB%B2%A8%ED%8F%89%ED%99%94%EC%83%81%20%EA%B8%B0%EB%85%90%EA%B4%80,32465867,PLACE_POI/3ySWGa,2yTda8,%EB%AA%A9%ED%8F%AC%EC%96%B4%EB%A6%B0%EC%9D%B4%EB%B0%94%EB%8B%A4%EA%B3%BC%ED%95%99%EA%B4%80,31554191,PLACE_POI/-/walk?c=12.00,0,0,0,dh",
             "note": "네이버 지도 도보 경로에서 398m·6분, 횡단보도 1회를 확인."},
        ],
        "review": "시내 아침에서 시작해 수산시장과 원도심의 공부방·점심 식당을 지난 뒤, 지도 번호 순서대로 7 난영공원→5 평화기념관→6 바다과학관→8 항구포차 저녁으로 이동한다. 삼학도 안에서 장소 번호 순서를 고정해 동선을 다시 만들었다. 버스 없이 저장 보행망 한 줄로 연결했으며, 지도 UI에서 대조하지 않은 새 구간과 실제 출입구는 미확인이다. 크루즈는 운항 날짜·회차와 선착장을 확인해야 하므로 제외.",
        "access": "목포역 인근 대표 출발점부터 삼학도 방문지까지 도보 길선을 포함. 시장 대표점과 공원 대표점은 점포·산책로 입구가 아니며 출입구 접근은 미확인.",
    },
    "cafeWalk": {
        "stops": ["p102", "p103", "p93", "p98", "p96", "p95", "p94", "p97"],
        "start": 10 * 60,
        "review": "식당은 제외하고 원도심 카페의 당근케이크·아몬드크림커피·바다레몬에이드·옥수수크림커피·치즈케이크·무화과빙수·송자라떼·흑임자라떼를 중심으로 구성. p103은 평일만 운영 안내가 있어 평일 코스이며 방문 전 확인 필요. 메뉴 이름만으로 당일 판매·품절 여부는 보장하지 않음.",
        "access": "목포역 인근 대표 출발점에서 첫 카페까지의 보행 길선은 포함. 마지막 카페 이후 역 귀환 시간과 실제 숙소 접근은 별도 확인 필요.",
    },
}


def coordinate(place):
    lat = place.get("lat") if place.get("lat") is not None else place.get("mapLat")
    lon = place.get("lon") if place.get("lon") is not None else place.get("mapLon")
    if isinstance(lat, (float, int)) and isinstance(lon, (float, int)):
        return float(lat), float(lon)
    return None


def distance_m(a, b):
    lat1, lon1 = a
    lat2, lon2 = b
    return 111_200 * math.hypot(lat2 - lat1, (lon2 - lon1) * math.cos(math.radians((lat1 + lat2) / 2)))


def nearest_order(group, preferred_start=None):
    if preferred_start:
        seed = min(group, key=lambda p: distance_m(coordinate(preferred_start), coordinate(p)))
        starts = [seed]
    else:
        starts = group
    orders = []
    for start in starts:
        remaining = [p for p in group if p["id"] != start["id"]]
        order = [start]
        while remaining:
            current = order[-1]
            next_place = min(remaining, key=lambda p: distance_m(coordinate(current), coordinate(p)))
            order.append(next_place)
            remaining.remove(next_place)
        length = sum(distance_m(coordinate(a), coordinate(b)) for a, b in zip(order, order[1:]))
        orders.append((length, order))
    return min(orders, key=lambda x: x[0])[1]


def course_order_variants(group, theme, places_by_id):
    variants = [nearest_order(group)]
    if theme == "cafeWalk":
        station = {"lat": 34.7914, "lon": 126.3859}
        variants.insert(0, nearest_order(group, station))
    else:
        core = [p for p in group if p["id"] in places_by_id["_core"]]
        for start in core:
            variants.append(nearest_order(group, start))
    seen = set()
    for order in variants:
        signature = tuple(p["id"] for p in order)
        if signature not in seen:
            seen.add(signature)
            yield order


def parse_theme_pools(source):
    block = re.search(r"const THEME_PLACE_IDS = \{(.*?)\n  \};", source, re.S).group(1)
    return {
        theme: re.findall(r"'([^']+)'", raw)
        for theme, raw in re.findall(r"(\w+):new Set\(\[(.*?)\]\)", block)
    }


def make_pools(places, themes):
    by_id = {p["id"]: p for p in places}
    pools = {}
    cores = {}
    for theme, ids in themes.items():
        if theme not in THEME_NAMES:
            continue
        core = [by_id[i] for i in ids if i in by_id and coordinate(by_id[i])]
        if theme == "cafeWalk":
            anchors = [by_id[i] for i in ("p8", "p12") if i in by_id and coordinate(by_id[i])]
            pool = [p for p in places if p.get("category") == "cafe" and coordinate(p)
                    and min(distance_m(coordinate(p), coordinate(a)) for a in anchors) <= 2_200]
            core = [p for p in pool if p["id"] in ids]
        else:
            radius = RADIUS_KM[theme] * 1_000
            anchors = core
            if theme == "gatbawi":
                # Keep the museum zone local; p14/p15 belong to Peace Plaza and are far away.
                center = by_id.get("p7")
                anchors = [center] if center and coordinate(center) else core
            pool = [p for p in places if coordinate(p) and
                    (p["id"] in ids or min(distance_m(coordinate(p), coordinate(a)) for a in anchors) <= radius)]
        pools[theme] = pool
        cores[theme] = {p["id"] for p in core if p in pool}
    return by_id, pools, cores


def candidate_groups(theme, pool, core_ids, by_id):
    snackable = {p["id"] for p in pool if p.get("category") in ("market", "cafe")}
    food = {p["id"] for p in pool if p.get("category") == "food"}
    must_core = {"oldtown": 3, "seosandong": 4, "gatbawi": 4, "peace": 2, "samhakdo": 3}.get(theme, 0)
    raw = []
    seen = set()
    rng = random.Random(f"mokpo:{theme}")
    sample_size = min(10, len(pool))
    sampled = []
    for _ in range(24_000):
        group = tuple(sorted(rng.sample(pool, sample_size), key=lambda p: pool.index(p)))
        signature = tuple(p["id"] for p in group)
        if signature not in seen:
            seen.add(signature)
            sampled.append(group)
    groups = iter(sampled)
    for group in groups:
        ids = {p["id"] for p in group}
        if sum(place_id in core_ids for place_id in ids) < must_core:
            continue
        if theme == "peace" and not {"p14", "p15"}.issubset(ids):
            continue
        if theme == "cafeWalk" and any(p.get("category") != "cafe" for p in group):
            continue
        if theme != "cafeWalk" and (not ids.intersection(food) or not ids.intersection(snackable)):
            continue
        # A far pin should not be pulled into a local outing just because it shares a theme label.
        if any(distance_m(coordinate(a), coordinate(b)) > 2_100 for a, b in zip(group, group[1:])):
            continue
        core_count = sum(place_id in core_ids for place_id in ids)
        avg_walk = sum(distance_m(coordinate(a), coordinate(b)) for a, b in itertools.combinations(group, 2)) / 10
        raw.append((group, core_count, avg_walk))
    return raw


def balanced_selection(theme, candidates, count=5):
    ranked = []
    for group, core_count, avg_walk in candidates:
        order = nearest_order(group)
        route_estimate = sum(distance_m(coordinate(a), coordinate(b)) for a, b in zip(order, order[1:]))
        category_mix = len({p.get("category") for p in group})
        menu_count = sum(bool(p.get("priceInfo", {}).get("label")) for p in group)
        # Keep the selected stops compact while giving the named district and local food a real presence.
        score = route_estimate + (10 - core_count) * 180 - category_mix * 80 - menu_count * (90 if theme == "cafeWalk" else 35)
        ranked.append((score, group))
    ranked.sort(key=lambda item: item[0])
    return [group for _, group in ranked[:count]]


def route_order(points):
    body = {
        "points": [[coordinate(p)[1], coordinate(p)[0]] for p in points],
        "profile": "foot",
        "elevation": True,
        "points_encoded": False,
        "details": ["road_class", "surface", "hike_rating", "mtb_rating"],
        "custom_model": {},
    }
    request = urllib.request.Request(ENDPOINT, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def geometry_summary(points, coordinates, total_meters, total_ms):
    route = [(float(c[0]), float(c[1]), float(c[2]) if len(c) > 2 else None) for c in coordinates]
    anchors = []
    last = -1
    for place in points:
        lat, lon = coordinate(place)
        first_available = max(0, last + 1)
        index = min(range(first_available, len(route)), key=lambda i: distance_m((lat, lon), (route[i][1], route[i][0])))
        anchors.append({"index": index, "offsetMeters": round(distance_m((lat, lon), (route[index][1], route[index][0])) )})
        last = index
    legs = []
    for i in range(len(points) - 1):
        start, end = anchors[i]["index"], anchors[i + 1]["index"]
        if end <= start:
            print("  duplicate/out-of-order route anchors", points[i]["id"], start, points[i + 1]["id"], end, flush=True)
            return None
        meters = sum(distance_m((route[j][1], route[j][0]), (route[j + 1][1], route[j + 1][0])) for j in range(start, end))
        straight = distance_m(coordinate(points[i]), coordinate(points[i + 1]))
        ratio = meters / max(straight, 1)
        legs.append({"fromId": points[i]["id"], "toId": points[i + 1]["id"], "meters": round(meters),
                     "minutes": max(1, round(total_ms / 60_000 * (meters / max(total_meters, 1)))),
                     "straightMeters": round(straight), "detourRatio": round(ratio, 2),
                     "pinOffsetMeters": max(anchors[i]["offsetMeters"], anchors[i + 1]["offsetMeters"])})
    if len(legs) != len(points) - 1:
        return None
    if any(leg["detourRatio"] > 7.5 and leg["meters"] > 500 or leg["pinOffsetMeters"] > 350 for leg in legs):
        return None
    return route, legs, anchors


def hhmm(minutes):
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def opening_check(place, arrival, duration):
    hours = place.get("hours")
    if not hours:
        if place.get("unrestrictedAccess"):
            return {"status": "outdoor-check", "text": "야외 구간 · 통제·기상·현장 안전 확인"}
        return {"status": "unknown", "text": "운영시간 미확인 · 방문 전 확인"}
    start = int(hours["open"][:2]) * 60 + int(hours["open"][3:5])
    close = int(hours["close"][:2]) * 60 + int(hours["close"][3:5])
    end = arrival + duration
    breaks = []
    for item in hours.get("breaks", []):
        breaks.append((int(item[0][:2]) * 60 + int(item[0][3:5]), int(item[1][:2]) * 60 + int(item[1][3:5])))
    fits = arrival >= start and end <= close and not any(arrival < b and end > a for a, b in breaks)
    return {"status": "fits-hours" if fits else "check-hours", "text": (
        f"예상 {hhmm(arrival)}–{hhmm(end)} · 저장 운영 {hours['open']}–{hours['close']}" +
        (" · 브레이크 " + ", ".join(f"{a}-{b}" for a, b in hours.get("breaks", [])) if hours.get("breaks") else "") +
        (" · 요일·특별휴무 별도 확인" if hours.get("closedWeekdays") or hours.get("closedDates") else "")
    )}


def course_stops(points, legs, start_minute=9 * 60 + 30, fixed_arrivals=None, stay_minutes=None, meal_slots=None, origin_leg_minutes=0):
    fixed_arrivals = fixed_arrivals or {}
    stay_minutes = stay_minutes or {}
    meal_slots = meal_slots or {}
    rows, minute = [], start_minute
    minute += origin_leg_minutes
    for i, place in enumerate(points):
        wait = max(0, fixed_arrivals.get(place["id"], minute) - minute)
        if place["id"] in fixed_arrivals and minute > fixed_arrivals[place["id"]]:
            raise ValueError(f"{place['id']} arrives {hhmm(minute)} after fixed {hhmm(fixed_arrivals[place['id']])}")
        minute += wait
        duration = stay_minutes.get(place["id"], VISIT_MINUTES.get(place.get("category"), 35))
        hours = opening_check(place, minute, duration)
        specialty = place.get("priceInfo") or {}
        rows.append({
            "placeId": place["id"], "name": place["name"], "category": place.get("category"),
            "arrival": hhmm(minute), "departure": hhmm(minute + duration), "stayMinutes": duration,
            "waitMinutesBefore": wait,
            "mealSlot": meal_slots.get(place["id"]),
            "hoursStatus": hours["status"], "hoursReview": hours["text"],
            "specialtyMenu": specialty.get("label"), "specialtyPrice": specialty.get("price"), "specialtySource": specialty.get("source"),
            "hours": place.get("hours"), "scheduleText": place.get("scheduleText"),
            "deadlineText": place.get("deadlineText"), "closureText": place.get("closureText"),
            "locationText": place.get("locationText"),
        })
        minute += duration
        if i < len(legs):
            minute += legs[i]["minutes"]
    return rows, hhmm(minute)


def make_exports(courses, places_by_id):
    features = []
    tracks = []
    for course in courses:
        props = {key: course[key] for key in ("id", "theme", "themeName", "title", "visitCount", "distanceMeters", "savedLineDistanceMeters", "walkingMinutes", "start", "end", "hoursStatus", "mealPolicy", "routeOrderPolicy", "source", "routeReview", "accessReview", "origin", "originLeg", "accessLeg", "geometryWarnings", "events") if key in course}
        props["stopIds"] = [row["placeId"] for row in course["stops"]]
        props["stops"] = [{key: stop[key] for key in ("placeId", "name", "category", "arrival", "departure", "mealSlot", "specialtyMenu", "specialtyPrice", "specialtySource") if key in stop} for stop in course["stops"]]
        props["originLeg"] = course["originLeg"]
        props["legs"] = course["legs"]
        coordinate_segments = course.get("coordinateSegments") or [course["coordinates"]]
        geometry = ({"type": "LineString", "coordinates": [[x, y] for x, y, _ in coordinate_segments[0]]}
                    if len(coordinate_segments) == 1 else
                    {"type": "MultiLineString", "coordinates": [[[x, y] for x, y, _ in segment] for segment in coordinate_segments]})
        features.append({"type": "Feature", "id": course["id"], "properties": props, "geometry": geometry})
        track_segments = "".join('<trkseg>' + "".join(f'<trkpt lat="{lat:.7f}" lon="{lon:.7f}">{f"<ele>{ele:.1f}</ele>" if ele is not None else ""}</trkpt>' for lon, lat, ele in segment) + '</trkseg>' for segment in coordinate_segments if len(segment) > 1)
        start = course["origin"]
        stops = ("" if course.get("accessLeg") else f'<wpt lat="{start["lat"]:.7f}" lon="{start["lon"]:.7f}"><name>{html.escape(start["name"])}</name><desc>{html.escape("시내 숙소 대표 출발 좌표")}</desc></wpt>') + "".join(f'<wpt lat="{coordinate(places_by_id[row["placeId"]])[0]:.7f}" lon="{coordinate(places_by_id[row["placeId"]])[1]:.7f}"><name>{html.escape(row["name"])}</name><desc>{html.escape(row["arrival"] + " 방문 · " + (row.get("specialtyMenu") or ""))}</desc></wpt>' for row in course["stops"]) + "".join(f'<wpt lat="{coordinate(places_by_id[event["placeId"]])[0]:.7f}" lon="{coordinate(places_by_id[event["placeId"]])[1]:.7f}"><name>{html.escape(event["name"])}</name><desc>{html.escape(event["arrival"] + " 행사 · 도보 경로 미연결")}</desc></wpt>' for event in course.get("events", []))
        tracks.append(f'<trk><name>{html.escape(course["title"])}</name><desc>{html.escape(course["source"]["label"] + " · " + str(course["distanceMeters"]) + "m · " + course["hoursStatus"])}</desc>{track_segments}</trk>{stops}')
    geojson = {"type": "FeatureCollection", "metadata": {"generated": dt.date.today().isoformat(), "source": "gpx.studio walking route planner", "profile": "foot"}, "features": features}
    CATALOG_PATH.write_text(json.dumps({"version": 1, "generated": dt.date.today().isoformat(), "source": {"label": "gpx.studio · GraphHopper foot profile · OpenStreetMap pedestrian network", "url": "https://gpx.studio/", "endpoint": ENDPOINT}, "courses": courses}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    GEOJSON_PATH.write_text(json.dumps(geojson, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    GPX_PATH.write_text('<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="한걸음 · gpx.studio" xmlns="http://www.topografix.com/GPX/1/1">\n' + "\n".join(tracks) + "\n</gpx>\n", encoding="utf-8")
    generated_plans = []
    for course in courses:
        entries, meal_times = {}, []
        legs_by_pair = {(leg["fromId"], leg["toId"]): leg for leg in course["legs"]}
        for index, stop in enumerate(course["stops"]):
            minute = int(stop["arrival"][:2]) * 60 + int(stop["arrival"][3:])
            memo = f'검토용·미확정 · 방문 {index + 1}/{course["visitCount"]}'
            if stop.get("mealSlot"):
                memo += f' · {stop["mealSlot"]}'
            if stop.get("specialtyMenu"):
                memo += f' · 특색 메뉴 {stop["specialtyMenu"]}'
            if stop.get("specialtyPrice"):
                memo += f' · {stop["specialtyPrice"]}'
            if stop.get("scheduleText"):
                memo += f' · 일정 참고 {stop["scheduleText"]}'
            if stop.get("closureText"):
                memo += f' · 휴무 참고 {stop["closureText"]}'
            if stop.get("hoursStatus") != "fits-hours":
                memo += ' · 운영·휴무·출입구 당일 확인'
            if index:
                leg = legs_by_pair.get((course["stops"][index - 1]["placeId"], stop["placeId"]))
                if leg and leg.get("mode") == "bus":
                    memo += f' · 버스 {leg["route"]} · 전체 약 {leg["minutes"]}분(정류장 도보 포함), 승하차·대기 미확인'
                elif leg and leg.get("mode") == "walk-ui":
                    memo += f' · Kakao 지도 도보 {leg["meters"]}m/{leg["minutes"]}분, 실제 선형은 지도에서 확인'
            entries[str(minute)] = {"placeId": stop["placeId"], "duration": stop["stayMinutes"], "memo": memo}
            if stop.get("mealSlot") in ("아침", "점심", "저녁"):
                meal_times.append(stop["arrival"])
        for event in course.get("events", []):
            minute = int(event["arrival"][:2]) * 60 + int(event["arrival"][3:])
            while str(minute) in entries:
                minute += 1
            entries[str(minute)] = {"placeId": event["placeId"], "duration": event["durationMinutes"],
                                    "memo": f'검토용 행사 · {event["durationMinutes"]}분 · {event.get("note", "") }'}
        generated_plans.append({
            "id": f'mokpo-review-{course["theme"]}-rules-20261007',
            "title": f'[검토용·미확정] {course["themeName"]} · {course["visitCount"]}곳',
            "date": "", "start": course["start"], "end": course["end"],
            "origin": "station", "destination": course["stops"][-1]["placeId"] if course["theme"] == "oldtown" else "station", "theme": course["theme"],
            "mealTimes": meal_times, "entries": entries,
            "reviewStatus": "검토용·미확정: 저장 보행망/지도 UI 대조·실제 출입구·당일 영업 확인 미완료",
            "routeReview": course.get("routeReview"), "transitCount": course.get("transitCount", 0),
            "routeOrderPolicy": course.get("routeOrderPolicy", WALK_ORDER_POLICY),
            "transitMinutes": course.get("transitMinutes", 0),
        })
    public_plan_data = {"app": "hangeoreum-mokpo", "version": 1, "plans": generated_plans}
    THEME_PLAN_PATH.write_text(json.dumps(public_plan_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    prior_data = json.loads(PLAN_RESEARCH_PATH.read_text(encoding="utf-8")) if PLAN_RESEARCH_PATH.exists() else {"app": "hangeoreum-mokpo", "version": 1, "plans": []}
    prior_plans = {plan.get("id"): plan for plan in prior_data.get("plans", [])}
    prior_plans.update({plan["id"]: plan for plan in generated_plans})
    prior_data.update({"app": "hangeoreum-mokpo", "version": 1, "plans": list(prior_plans.values())})
    PLAN_RESEARCH_PATH.parent.mkdir(parents=True, exist_ok=True)
    PLAN_RESEARCH_PATH.write_text(json.dumps(prior_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def validate_common_rules(courses):
    for course in courses:
        if not course.get("routeOrderPolicy"):
            raise ValueError(f'{course["theme"]}: shared walk-order policy is required')
        if not 5 <= course["visitCount"] <= 15:
            raise ValueError(f'{course["theme"]}: visit count must be 5–15')
        if course.get("transitCount", 0) > 3:
            raise ValueError(f'{course["theme"]}: bus rides exceed the 3-ride limit')
        if course["distanceMeters"] > 8_000:
            raise ValueError(f'{course["theme"]}: walking total exceeds 8km')
        if course["origin"]["id"] != "station":
            raise ValueError(f'{course["theme"]}: route must begin in the downtown area')
        meals = [stop for stop in course["stops"] if stop.get("mealSlot") in ("아침", "점심", "저녁")]
        cafes = sum(stop.get("category") == "cafe" for stop in course["stops"])
        if course.get("mealPolicy") == "snack-half-day":
            if len(meals) != 1 or meals[0].get("mealSlot") != "점심" or course["end"] > "18:00":
                raise ValueError(f'{course["theme"]}: snack half-day route must include one lunch and finish by 18:00')
        elif course["theme"] not in ("peace", "cafeWalk", "seosandong") and len(meals) != 3:
            raise ValueError(f'{course["theme"]}: a full-day route needs breakfast, lunch, and dinner')
        if course["theme"] != "cafeWalk" and cafes > len(meals):
            raise ValueError(f'{course["theme"]}: cafe count exceeds meal count')
        if course["theme"] == "cafeWalk" and any(stop.get("category") != "cafe" for stop in course["stops"]):
            raise ValueError("cafeWalk: restaurant/non-cafe stops are not allowed")
        if course["theme"] == "samhakdo":
            island_order = [stop["placeId"] for stop in course["stops"]][-4:]
            if island_order != ["p26", "p30", "p32", "p53"]:
                raise ValueError(f'samhakdo: user-ordered island stops must remain p26→p30→p32→p53, got {island_order}')


def main():
    places = json.loads(PLACES_PATH.read_text(encoding="utf-8"))["places"]
    source = (ROOT / "public" / "route-engine.js").read_text(encoding="utf-8")
    themes = parse_theme_pools(source)
    by_id, pools, core_sets = make_pools(places, themes)
    only_themes = {value.strip() for value in os.environ.get("MOKPO_ONLY_THEMES", "").split(",") if value.strip()}
    courses = []
    if only_themes and CATALOG_PATH.exists():
        previous = json.loads(CATALOG_PATH.read_text(encoding="utf-8")).get("courses", [])
        courses = [course for course in previous if course.get("theme") not in only_themes]
        for course in courses:
            course["routeOrderPolicy"] = WALK_ORDER_POLICY
    for theme in THEME_NAMES:
        if theme not in pools or (only_themes and theme not in only_themes):
            continue
        by_id["_core"] = core_sets[theme]
        curated = CURATED_ROUTES.get(theme)
        if curated:
            group = [dict(by_id[place_id]) for place_id in curated["stops"]]
            for place in group:
                override = curated.get("specialty_menu_overrides", {}).get(place["id"])
                if override:
                    place["priceInfo"] = override
            selections = [group]
            groups = []
        else:
            groups = candidate_groups(theme, pools[theme], core_sets[theme], by_id)
            selections = balanced_selection(theme, groups)
        print(f"{theme}: pool={len(pools[theme])}, curated={bool(curated)}, routing candidates={len(selections)}", flush=True)
        for group in selections:
            title = THEME_NAMES[theme]
            accepted = None
            origin = {"id": "station", "name": "목포역 인근 시내 숙소 대표 출발점", "lat": 34.7914, "lon": 126.3859}
            orders = [group] if curated else course_order_variants(group, theme, by_id)
            for order in orders:
                try:
                    access = curated.get("transit_access") if curated else None
                    transit_specs = curated.get("transit_legs", []) if curated else []
                    map_walk_specs = curated.get("map_walk_legs", []) if curated else []
                    coordinate_segments, place_offsets = [], [None] * len(order)
                    leg_by_pair, origin_leg = {}, None
                    if transit_specs or map_walk_specs:
                        transit_by_pair = {(item["fromId"], item["toId"]): item for item in transit_specs}
                        map_walk_by_pair = {(item["fromId"], item["toId"]): item for item in map_walk_specs}
                        chunks, chunk_start = [], 0
                        for index, (left, right) in enumerate(zip(order, order[1:])):
                            if (left["id"], right["id"]) in transit_by_pair or (left["id"], right["id"]) in map_walk_by_pair:
                                chunks.append((chunk_start, index))
                                chunk_start = index + 1
                        chunks.append((chunk_start, len(order) - 1))
                        for chunk_number, (first, last) in enumerate(chunks):
                            chunk = order[first:last + 1]
                            if len(chunk) < 2 and not (chunk_number == 0 and not access):
                                continue
                            route_points = ([origin] if chunk_number == 0 and not access else []) + chunk
                            response = route_order(route_points)
                            path = response["paths"][0]
                            summary = geometry_summary(route_points, path["points"]["coordinates"], path["distance"], path["time"])
                            if summary is None:
                                raise ValueError(f"walking geometry rejected for {route_points[0]['id']}–{route_points[-1]['id']}")
                            coordinates, segment_legs, anchors = summary
                            coordinate_segments.append(coordinates)
                            offset = 1 if route_points[0]["id"] == "station" else 0
                            for local_index, anchor in enumerate(anchors[offset:]):
                                place_offsets[first + local_index] = anchor["offsetMeters"]
                            if offset:
                                origin_leg = segment_legs[0]
                                segment_legs = segment_legs[1:]
                            for local_index, leg in enumerate(segment_legs):
                                leg_by_pair[(chunk[local_index]["id"], chunk[local_index + 1]["id"])] = leg
                        legs = []
                        for left, right in zip(order, order[1:]):
                            key = (left["id"], right["id"])
                            if key in transit_by_pair:
                                transit = transit_by_pair[key]
                                legs.append({"fromId": key[0], "toId": key[1], "mode": "bus", "route": transit["route"],
                                             "minutes": transit["minutes"], "headwayMinutes": transit.get("headwayMinutes"),
                                             "meters": 0, "source": transit["source"], "checkedOn": transit["checkedOn"], "note": transit["note"]})
                            elif key in map_walk_by_pair:
                                checked = map_walk_by_pair[key]
                                legs.append({"fromId": key[0], "toId": key[1], "mode": "walk-ui", "minutes": checked["minutes"],
                                             "meters": checked["meters"], "geometrySaved": False, "mapVerified": True,
                                             "source": checked["source"], "checkedOn": "2026-10-07", "note": checked["note"]})
                            else:
                                legs.append(leg_by_pair[key])
                    else:
                        route_points = order if access else [origin, *order]
                        response = route_order(route_points)
                        path = response["paths"][0]
                        summary = geometry_summary(route_points, path["points"]["coordinates"], path["distance"], path["time"])
                        if summary is None:
                            print("  walking geometry rejected", [p["id"] for p in [origin, *order]], flush=True)
                            continue
                        coordinates, legs, anchors = summary
                        coordinate_segments = [coordinates]
                        if access:
                            origin_leg = None
                            place_offsets = [anchor["offsetMeters"] for anchor in anchors]
                        else:
                            origin_leg, legs = legs[0], legs[1:]
                            place_offsets = [anchor["offsetMeters"] for anchor in anchors[1:]]
                    walk_checks = {(item["fromId"], item["toId"]): item for item in curated.get("walk_ui_checks", [])} if curated else {}
                    for leg in legs:
                        check = walk_checks.get((leg["fromId"], leg["toId"]))
                        if check:
                            leg["mapCheck"] = {
                                "provider": check.get("provider", "Kakao"), "meters": check["meters"], "minutes": check["minutes"],
                                "source": check["source"], "checkedOn": "2026-10-07", "note": check["note"]
                            }
                    geometry_warnings = [
                        f'{leg["fromId"]}→{leg["toId"]}: 보행망 길선 {leg["meters"]}m / 직선 {leg["straightMeters"]}m (약 {leg["detourRatio"]}배)'
                        for leg in ([origin_leg] if origin_leg else []) + [leg for leg in legs if not leg.get("mode")] if leg["detourRatio"] > 3.4 and leg["meters"] > 500
                    ]
                    total_meters = round(sum(leg["meters"] for leg in legs if leg.get("mode") != "bus"))
                    line_meters = round(sum(leg["meters"] for leg in legs if not leg.get("mode")) + (origin_leg["meters"] if origin_leg and not origin_leg.get("mode") else 0))
                    rows, end_time = course_stops(
                        order, legs,
                        start_minute=curated.get("start", 9 * 60 + 30) if curated else 9 * 60 + 30,
                        fixed_arrivals=curated.get("fixed_arrivals") if curated else None,
                        stay_minutes=curated.get("stay_minutes") if curated else None,
                        meal_slots=curated.get("meal_slots") if curated else None,
                        origin_leg_minutes=access["minutes"] if access else origin_leg["minutes"],
                    )
                    if origin_leg:
                        total_meters += origin_leg["meters"]
                    walking_minutes = sum(leg["minutes"] for leg in legs if leg.get("mode") != "bus") + (origin_leg["minutes"] if origin_leg and not origin_leg.get("mode") else 0)
                    statuses = {row["hoursStatus"] for row in rows}
                    hours_status = "hours-and-closures-check" if statuses - {"fits-hours"} else "saved-hours-fit"
                    accepted = {
                        "id": f"mokpo-{theme}", "theme": theme, "themeName": THEME_NAMES[theme],
                        "title": title, "visitCount": len(rows) + len({event["placeId"] for event in (curated.get("events", []) if curated else []) if event.get("placeId") not in {row["placeId"] for row in rows}}), "stops": rows, "legs": legs,
                        "start": hhmm(curated.get("start", 9 * 60 + 30) if curated else 9 * 60 + 30), "end": end_time,
                        "distanceMeters": total_meters, "walkingMinutes": walking_minutes,
                        "savedLineDistanceMeters": line_meters,
                        "hoursStatus": hours_status,
                        "mealPolicy": curated.get("meal_policy", "three-meals") if curated else "three-meals",
                        "hoursReview": " · ".join(f'{row["name"]}: {row["hoursReview"]}' for row in rows),
                        "routeReview": curated.get("review") if curated else None,
                        "events": curated.get("events", []) if curated else [],
                        "accessReview": curated.get("access") if curated else "목포역 인근 시내 숙소 대표 출발점부터 첫 방문지까지 도보 길선을 포함. 실제 숙소 위치에 따라 접근 거리는 달라짐.",
                        "origin": origin,
                        "originLeg": origin_leg,
                        "accessLeg": access,
                        "transitCount": sum(leg.get("mode") == "bus" for leg in legs) + (1 if access else 0),
                        "transitMinutes": sum(leg["minutes"] for leg in legs if leg.get("mode") == "bus") + (access["minutes"] if access else 0),
                        "geometryWarnings": geometry_warnings,
                        "reviewStatus": "검토용 · 지도 교차 확인 전",
                        "routeOrderPolicy": WALK_ORDER_POLICY,
                        "coordinateSegments": coordinate_segments,
                        "coordinates": coordinate_segments[0] if coordinate_segments else [],
                        "pinOffsetsMeters": place_offsets,
                        "source": {"label": "gpx.studio GraphHopper foot profile · OpenStreetMap pedestrian network", "url": "https://gpx.studio/", "checkedOn": dt.date.today().isoformat(), "profile": "foot"},
                    }
                    break
                except Exception as error:
                    print(f"  route retry {title}: {type(error).__name__}: {error}", flush=True)
                    time.sleep(0.4)
            if accepted:
                courses.append(accepted)
                print(f"  saved {title}: {len(accepted['stops'])} places, {accepted['distanceMeters']}m, ends {accepted['end']}", flush=True)
                break
            else:
                print(f"  trying another place group for {theme}", flush=True)
            time.sleep(0.15)
    if courses:
        courses.sort(key=lambda course: list(THEME_NAMES).index(course["theme"]))
        validate_common_rules(courses)
        make_exports(courses, by_id)
    counts = {theme: sum(course["theme"] == theme for course in courses) for theme in THEME_NAMES}
    print("final counts", json.dumps(counts, ensure_ascii=False))


if __name__ == "__main__":
    main()
