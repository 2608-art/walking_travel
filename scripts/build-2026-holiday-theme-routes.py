"""Save pedestrian geometry for source-checked 2026 weekend theme substitutions."""

import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
PLACE_FILES = {
    "mokpo": "public/places.json",
    "gangneung": "public/gangneung-places.json",
    "gyeongju": "public/gyeongju-places.json",
}
BASE_FILES = {
    "mokpo": ("public/theme-courses.json", "courses"),
    "gangneung": ("public/gangneung-theme-review-routes.json", "routes"),
    "gyeongju": ("public/gyeongju-six-theme-routes.geojson", "features"),
}
SUBSTITUTIONS = [
    ("mokpo", "mokpo-cafeWalk", "p103", "p105", [0, 6],
     "주말에 쉬는 인스파이어링 커피를 브릭레인으로 교체",
     ["https://www.diningcode.com/profile.php?rid=OzMg3yu7a3L4",
      "https://www.tabling.co.kr/place/677cc97a66de5f069879249c"]),
    ("gangneung", "gangneung-shops-straight-line-review", "g24", "g23", [0],
     "일요일에 쉬는 봉봉방앗간을 테라로사 임당점으로 교체",
     ["https://bonboncoffee.com/about", "https://ios.terarosa.com/store/list"]),
    ("gangneung", "gangneung-cafe-10-stop-review", "g24", "g23", [0],
     "일요일에 쉬는 봉봉방앗간을 테라로사 임당점으로 교체",
     ["https://bonboncoffee.com/about", "https://ios.terarosa.com/store/list"]),
    *[("gyeongju", route_id, "j42", "j117", [0],
       "일요일에 쉬는 경주원조콩국을 황남두꺼비로 교체",
       ["https://www.gyeongju.go.kr/tour/page.do?cmd=2&con_uid=6733&mnu_uid=4830",
        "https://www.gyeongju.go.kr/tour/page.do?cmd=2&con_uid=7482&mnu_uid=2287"])
      for route_id in ("gyeongju-hwangridan", "gyeongju-wolseong", "gyeongju-donggung",
                       "gyeongju-bunhwang", "gyeongju-bulguksa")],
]
PUBLIC_HOLIDAYS_2026 = [
    "2026-01-01", "2026-02-16", "2026-02-17", "2026-02-18",
    "2026-03-01", "2026-03-02", "2026-05-01", "2026-05-05",
    "2026-05-24", "2026-05-25", "2026-06-03", "2026-06-06",
    "2026-07-17", "2026-08-15", "2026-08-17", "2026-09-24",
    "2026-09-25", "2026-09-26", "2026-10-03", "2026-10-05",
    "2026-10-09", "2026-12-25",
]


def place_ids(region, route):
    if region == "mokpo":
        return [stop["placeId"] for stop in route["stops"]]
    if region == "gangneung":
        return route["placeIds"][:]
    props = route["properties"]
    return [item["placeId"] for item in sorted(
        [*props["stops"], *[meal for meal in props.get("meals", [])
                            if meal["placeId"] not in {stop["placeId"] for stop in props["stops"]}]],
        key=lambda item: item["sequence"])]


def pedestrian_route(ids, places):
    coordinates = ";".join(f'{places[place_id].get("mapLon") or places[place_id]["lon"]},'
                           f'{places[place_id].get("mapLat") or places[place_id]["lat"]}' for place_id in ids)
    url = ("https://routing.openstreetmap.de/routed-foot/route/v1/foot/" + coordinates
           + "?" + urlencode({"overview": "full", "geometries": "geojson", "steps": "false"}))
    request = Request(url, headers={"User-Agent": "HangeoreumHolidayRouteAudit/1.0"})
    with urlopen(request, timeout=45) as response:
        result = json.load(response)
    if result.get("code") != "Ok" or len(result.get("routes", [])) != 1:
        raise RuntimeError("Pedestrian route not found: " + url)
    route = result["routes"][0]
    if len(route["legs"]) != len(ids) - 1:
        raise RuntimeError("Wrong pedestrian leg count: " + url)
    snaps = [round(waypoint["distance"]) for waypoint in result["waypoints"]]
    if max(snaps) > 100:
        raise RuntimeError(f"Waypoint more than 100 m from pedestrian network: {ids} {snaps}")
    return {"coordinates": route["geometry"]["coordinates"],
            "meters": round(route["distance"]), "minutes": round(route["duration"] / 60),
            "legMeters": [round(leg["distance"]) for leg in route["legs"]],
            "legMinutes": [round(leg["duration"] / 60) for leg in route["legs"]],
            "snapMeters": snaps, "url": url}


def main():
    places = {region: {place["id"]: place for place in json.loads((ROOT / filename).read_text(encoding="utf-8"))["places"]}
              for region, filename in PLACE_FILES.items()}
    bases = {region: {route["id"]: route for route in json.loads((ROOT / filename).read_text(encoding="utf-8"))[key]}
             for region, (filename, key) in BASE_FILES.items()}
    variants = []
    for region, route_id, old, new, weekdays, reason, sources in SUBSTITUTIONS:
        ids = place_ids(region, bases[region][route_id])
        assert ids.count(old) == 1 and new not in ids, (route_id, old, new)
        ids[ids.index(old)] = new
        if route_id == "gyeongju-bulguksa":
            groups = [ids[1:4]]
        elif route_id == "gangneung-cafe-10-stop-review":
            groups = [ids[:3], ids[3:7], ids[7:]]
        else:
            groups = [ids]
        paths = [pedestrian_route(group, places[region]) for group in groups]
        transit_legs = [{"from": leg["from"], "to": leg["to"], "route": leg["buses"],
                         "minutes": leg["minutes"], "meters": leg["meters"],
                         "sourceUrl": leg.get("routeUrl")}
                        for leg in bases[region][route_id].get("legs", []) if leg.get("mode") == "transit"]
        variant = {
            "id": route_id + "-holiday-2026", "region": region, "baseRouteId": route_id,
            "themeId": (bases[region][route_id].get("theme") or bases[region][route_id].get("themeId") or
                        bases[region][route_id].get("properties", {}).get("themeId")),
            "title": (bases[region][route_id].get("title") or bases[region][route_id]["properties"]["title"]) + " · 휴일 버전",
            "start": (bases[region][route_id].get("start") or
                      bases[region][route_id].get("properties", {}).get("startTime") or
                      ("11:15" if route_id.endswith("cafe-10-stop-review") else "10:00")),
            "year": 2026, "weekdays": weekdays, "reason": reason,
            "replace": {"from": old, "to": new}, "placeIds": ids,
            "mealSlots": {new if meal["placeId"] == old else meal["placeId"]: meal["slot"]
                          for meal in bases[region][route_id].get("properties", {}).get("meals", [])},
            "walkGroups": groups, "walkPaths": paths,
            "transitLegs": transit_legs,
            "walkingMeters": sum(path["meters"] for path in paths),
            "walkingMinutes": sum(path["minutes"] for path in paths),
            "operationSources": sources, "routingSource": "FOSSGIS OSRM foot / OpenStreetMap",
            "checkedAt": "2026-10-08", "status": "substitution-and-pedestrian-network-checked",
            "limit": "대체 장소의 공개 운영표와 보행망을 확인했습니다. 나머지 장소의 선택일 영업, 실제 출입구, 현장 통제 및 버스 운행은 확정하지 않았습니다.",
        }
        variants.append(variant)
        print(region, route_id, len(ids), variant["walkingMeters"],
              max(max(path["snapMeters"]) for path in paths))
    output = {"version": 1, "checkedAt": "2026-10-08",
              "publicHolidays": PUBLIC_HOLIDAYS_2026,
              "calendarSources": ["https://www.kasi.re.kr/kor/post/newsMaterial/32031",
                                  "https://www.mpm.go.kr/mpm/comm/newsPress/newsPressRelease/?boardId=bbs_0000000000000029&cntId=4250&mode=view"],
              "variants": variants}
    (ROOT / "public/holiday-theme-routes-2026.json").write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
