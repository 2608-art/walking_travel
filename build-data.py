"""Build a cautious map catalogue from the project's Mokpo research notes."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs" / "지역" / "목포" / "장소.md"
TARGET = Path(__file__).resolve().parent / "dist" / "places.json"


def plain(value):
    value = re.sub(r"\[([^]]+)\]\([^)]+\)", r"\1", value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"\1", value)
    return re.sub(r"\s+", " ", value).strip()


# Only explicit, comparatively stable operating rules are structured here.
# Anything else remains visible as source text and needs confirmation.
HOURS = {
    "목포근대역사관 1관": {"open": "09:00", "close": "18:00", "lastEntry": "17:00", "closedWeekdays": [1], "note": "월요일·1월 1일 휴관. 특별휴무 확인 필요.", "source": "https://www.mokpo.go.kr/tour/tourguide/information/admission"},
    "목포자연사박물관": {"open": "09:00", "close": "18:00", "lastEntry": "17:00", "closedWeekdays": [1], "note": "월요일 휴관. 공휴일·연휴에는 대체휴관 확인 필요.", "source": "https://www.mokpo.go.kr/tour/tourguide/information/admission"},
    "목포스카이워크": {"open": "09:00", "close": "21:00", "note": "공식 마지막 입장 미확인. 현장 통제 확인 필요.", "source": "https://m.mokpo.go.kr/www/introduce/thanksgiving/notice_closure"},
    "목포문예역사관": {"open": "09:00", "close": "18:00", "closedWeekdays": [1], "note": "독립 입장 마감 미확인. 통합권 조건 확인 필요.", "source": "https://www.mpcc1897.or.kr/base/culturalSpace/read?culturalSpaceNo=18&menuLevel=3&menuNo=25"},
    "목포생활도자박물관": {"open": "09:00", "close": "18:00", "closedWeekdays": [1], "note": "체험실은 17:00까지. 예약·마감 별도 확인.", "source": "https://www.mokpo.go.kr/tour/attraction/area?idx=7455&mode=view"},
    "목포대중음악의전당": {"open": "09:00", "close": "18:00", "closedWeekdays": [1], "note": "공식 마지막 입장 미확인. 특별휴관 확인 필요.", "source": "https://biz.mokpo.go.kr/www/introduce/new_year/notice_closure"},
    "초원음식점(초원식당)": {"open": "09:30", "close": "19:30", "breaks": [["15:00", "17:00"]], "lastOrder": "19:00", "note": "점심 주문 마감 14:30. 날짜별 영업 확인 필요.", "source": "https://www.diningcode.com/profile.php?rid=UDC5XmLS66Eg"},
    "장터식당 본점": {"open": "11:30", "close": "20:00", "breaks": [["15:00", "17:30"]], "lastOrder": "19:30", "note": "주간 휴무·당일 영업 확인 필요.", "source": "https://www.diningcode.com/profile.php?rid=Cr9J91gdeE25"},
    "해빔": {"open": "11:00", "close": "20:00", "breaks": [["15:00", "16:30"]], "lastOrder": "19:30", "note": "주말 종료·주문 마감은 다름. 당일 확인 필요.", "source": "https://www.diningcode.com/profile.php?rid=UkGylKAoTRkI"},
    "카와루라멘": {"open": "11:00", "close": "20:30", "breaks": [["14:50", "17:00"]], "lastOrder": "20:00", "note": "점심 주문 마감 14:20. 당일 확인 필요.", "source": "https://www.diningcode.com/profile.php?rid=PC1EN9MY0W2g"},
}

section = ""
places = {}
for line in SOURCE.read_text(encoding="utf-8").splitlines():
    if line.startswith("## 검토 보류"):
        break
    if line.startswith("## 관광"):
        section = "spot"
    elif line.startswith("## 음식점"):
        section = "food"
    elif line.startswith("## 카페"):
        section = "cafe"
    elif line.startswith("## 서점"):
        section = "shop"
    if not section or not line.startswith("| ") or line.startswith("| ---"):
        continue
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    if len(cells) < 3 or cells[0] in ("장소", "장소·분류"):
        continue
    name = plain(cells[0]).split(" · ")[0]
    if not name or name in places:
        continue
    coords = re.search(r"mlat=([0-9.]+)&mlon=([0-9.]+)", line)
    if not coords:
        coords = re.search(r"약\s*([0-9.]+),\s*([0-9.]+)", line)
    lat, lon = (float(coords.group(1)), float(coords.group(2))) if coords else (None, None)
    link = re.search(r"\]\((https?://[^)]+)\)", line)
    places[name] = {
        "id": f"p{len(places)+1}",
        "name": name,
        "category": section,
        "lat": lat,
        "lon": lon,
        "locationText": plain(cells[1])[:160],
        "source": link.group(1) if link else None,
        "hours": HOURS.get(name),
    }

TARGET.write_text(json.dumps({"updated": "2026-10-01", "region": "목포", "places": list(places.values())}, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {len(places)} places ({sum(p['lat'] is not None for p in places.values())} pins) to {TARGET}")
