"""Resolve researched Mokpo road addresses once with Kakao Local; keep matched results only.

Reads the private REST key from .env and writes public building-address pins. The
points are building representatives, never guaranteed entrances.
"""
import json
import os
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent
places = json.loads((ROOT / "dist" / "places.json").read_text(encoding="utf-8"))["places"]
out = ROOT / "address-pins.json"
pins = json.loads(out.read_text(encoding="utf-8")) if out.exists() else {}
key = os.environ.get("KAKAO_REST_API_KEY", "").strip()
if not key:
    key = next((line.partition("=")[2].strip().strip('"') for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines() if line.startswith("KAKAO_REST_API_KEY=")), "")
if not key:
    raise SystemExit("Kakao REST key is not configured")

added = 0
priority = {"고호의 책방", "작은낙", "물망초", "나비팩토리", "가죽공방 모닉", "비팡이네", "유유랜드", "포도책방(목포점)", "구보책방", "오늘의 페이지", "웨이브", "서산동 시화골목", "연희네슈퍼", "목포스카이워크", "목포근대역사관 2관"}
for place in sorted(places, key=lambda p: (p["name"] not in priority, p["name"])):
    query = place.get("addressQuery")
    if not query or place["name"] in pins:
        continue
    url = "https://dapi.kakao.com/v2/local/search/address.json?" + urlencode({"query": query})
    request = Request(url, headers={"Authorization": "KakaoAK " + key})
    try:
        with urlopen(request, timeout=5) as response:
            documents = json.load(response).get("documents", [])
    except Exception as exc:
        print(f"skip {place['name']}: {type(exc).__name__}")
        continue
    expected = query.removeprefix("목포시 ").replace(" ", "")
    hit = next((doc for doc in documents if expected in str(doc.get("road_address", {}).get("address_name") or doc.get("address_name", "")).replace(" ", "")), None)
    if not hit:
        print(f"unmatched {place['name']}")
        continue
    lat, lon = float(hit["y"]), float(hit["x"])
    if not (34.7 <= lat <= 34.9 and 126.3 <= lon <= 126.6):
        continue
    pins[place["name"]] = {"query": query, "lat": lat, "lon": lon, "basis": "Kakao road address", "source": "https://developers.kakao.com/docs/ko/local/dev-guide"}
    added += 1
    out.write_text(json.dumps(pins, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"matched {place['name']}", flush=True)
    if added >= int(os.environ.get("MAX_NEW_PINS", "20")):
        break

out.write_text(json.dumps(pins, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Added {added}; verified address pins {len(pins)}")
