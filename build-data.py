"""Build a cautious map catalogue from the project's Mokpo research notes."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "docs" / "지역" / "목포" / "장소.md"
TARGETS = (ROOT / "public" / "places.json", ROOT / "dist" / "client" / "places.json")
SOLO_EVIDENCE = Path(__file__).resolve().parent / "solo-evidence.json"
solo_research = json.loads(SOLO_EVIDENCE.read_text(encoding="utf-8"))
ADDRESS_PINS = Path(__file__).resolve().parent / "address-pins.json"
verified_pins = json.loads(ADDRESS_PINS.read_text(encoding="utf-8")) if ADDRESS_PINS.exists() else {}
MAP_PINS = Path(__file__).resolve().parent / "map-representative-pins.json"
representative_pins = json.loads(MAP_PINS.read_text(encoding="utf-8"))


def plain(value):
    value = re.sub(r"\[([^]]+)\]\([^)]+\)", r"\1", value)
    value = re.sub(r"\*\*([^*]+)\*\*", r"\1", value)
    return re.sub(r"\s+", " ", value).strip()


# Only explicit, comparatively stable operating rules are structured here.
# Anything else remains visible as source text and needs confirmation.
HOURS = {
    "목포모자아트갤러리(옛 갑자옥모자점)": {"open": "09:00", "close": "18:00", "closedWeekdays": [1], "note": "월요일·1월 1일 휴관. 입장 마감은 운영 주체에서 확인되지 않아 방문 전 재확인.", "source": "https://www.mpcc1897.or.kr/base/culturalSpace/read?culturalSpaceNo=6&menuLevel=3&menuNo=25"},
    "수중유산박물관(옛 국립해양유물전시관)": {"open": "09:00", "close": "18:00", "lastEntry": "17:00", "closedWeekdays": [1], "note": "어린이체험관은 10:00~16:30, 입장 16:00까지. 임시휴관은 공식 공지 확인.", "source": "https://www.seamuse.go.kr/mokpo/preview/exhibition_preview"},
    "김대중노벨평화상기념관": {"open": "09:00", "close": "18:00", "lastEntry": "17:00", "closedWeekdays": [1], "note": "월요일 휴관. 행사·특별휴관 확인.", "source": "https://m.mokpo.go.kr/tour/attraction/museum?idx=7465&mode=view"},
    "소년 김대중 공부방": {"open": "09:00", "close": "18:00", "closedWeekdays": [1], "note": "관광공사 안내 기준. 지도 날짜별 표시와 월요일 운영 여부 충돌 가능.", "source": "https://korean.visitkorea.or.kr/detail/rem_detail.do?cotid=101dd63f-9cb9-482e-9fa2-f9d7ceba6b67"},
    "목포어린이바다과학관": {"open": "09:00", "close": "18:00", "lastEntry": "17:00", "closedWeekdays": [1], "note": "특별휴관 확인.", "source": "https://biz.mokpo.go.kr/tour/tourguide/information/admission"},
    "목포문학관": {"open": "09:00", "close": "18:00", "lastEntry": "17:00", "closedWeekdays": [1], "note": "월요일·1월 1일 휴관. 특별휴관 확인.", "source": "https://www.mokpo.go.kr/tour/tourguide/information/admission"},
    "국립호남권생물자원관": {"open": "09:30", "close": "17:30", "lastEntry": "16:30", "closedWeekdays": [1], "note": "월요일과 공식 휴관일. 월요일이 공휴일인 경우 예외·대체휴관 확인.", "source": "https://hnibr.re.kr/ko/M000000408/html/view"},
    "옥공예전시관": {"open": "09:00", "close": "18:00", "closedWeekdays": [1], "note": "문화도시센터 시설 안내 기준. 목포시 관광의 0시~0시는 잘못된 값으로 판단. 체험은 별도 예약·회차 확인.", "source": "https://www.mpcc1897.or.kr/base/culturalSpace/read?culturalSpaceNo=12&menuLevel=3&menuNo=25"},
    "씨엘비베이커리(원도심점)": {"open": "08:00", "close": "21:00", "note": "목포시 연중무휴 안내. 품절·특별휴무 확인.", "source": "https://tour.mokpo.go.kr/tour/food_100/mokpo_snack"},
    "코롬방제과점": {"open": "08:00", "close": "21:00", "note": "목포시 연중무휴 안내. 품절·특별휴무 확인.", "source": "https://tour.mokpo.go.kr/tour/food_100/mokpo_snack"},
    "포도책방(목포점)": {"open": "12:00", "close": "19:00", "closedWeekdays": [3], "note": "운영자 공식 사이트 기준. 지도와 개점·정기휴무 정보가 충돌하므로 공식 공지 우선, 당일 변동 확인.", "source": "https://podobooks.com/"},
    "목포근대역사관 1관": {"open": "09:00", "close": "18:00", "lastEntry": "17:00", "closedWeekdays": [1], "note": "월요일·1월 1일 휴관. 특별휴무 확인 필요.", "source": "https://www.mokpo.go.kr/tour/tourguide/information/admission"},
    "목포근대역사관 2관": {"open": "09:00", "close": "18:00", "closedWeekdays": [1], "note": "목포시 관광안내의 관람시간. 특별휴무와 입장 마감 확인 필요.", "source": "https://biz.mokpo.go.kr/tour/tourguide/information/admission"},
    "목포자연사박물관": {"open": "09:00", "close": "18:00", "lastEntry": "17:00", "closedWeekdays": [1], "note": "월요일 휴관. 공휴일·연휴에는 대체휴관 확인 필요.", "source": "https://www.mokpo.go.kr/tour/tourguide/information/admission"},
    "목포스카이워크": {"open": "09:00", "close": "21:00", "note": "공식 마지막 입장 미확인. 현장 통제 확인 필요.", "source": "https://m.mokpo.go.kr/www/introduce/thanksgiving/notice_closure"},
    "목포문예역사관": {"open": "09:00", "close": "18:00", "closedWeekdays": [1], "note": "독립 입장 마감 미확인. 통합권 조건 확인 필요.", "source": "https://www.mpcc1897.or.kr/base/culturalSpace/read?culturalSpaceNo=18&menuLevel=3&menuNo=25"},
    "목포생활도자박물관": {"open": "09:00", "close": "18:00", "closedWeekdays": [1], "note": "체험실은 17:00까지. 예약·마감 별도 확인.", "source": "https://www.mokpo.go.kr/tour/attraction/area?idx=7455&mode=view"},
    "목포대중음악의전당": {"open": "09:00", "close": "18:00", "closedWeekdays": [1], "note": "공식 마지막 입장 미확인. 특별휴관 확인 필요.", "source": "https://biz.mokpo.go.kr/www/introduce/new_year/notice_closure"},
    "초원음식점(초원식당)": {"open": "09:30", "close": "19:30", "breaks": [["15:00", "17:00"]], "lastOrder": "19:00", "note": "점심 주문 마감 14:30. 날짜별 영업 확인 필요.", "source": "https://www.diningcode.com/profile.php?rid=UDC5XmLS66Eg"},
    "장터식당 본점": {"open": "11:30", "close": "20:00", "breaks": [["15:00", "17:30"]], "lastOrder": "19:30", "closedDates": ["2026-10-04", "2026-10-08"], "note": "10/4·8 휴무 표시. 그 밖의 날짜도 방문일 확인 필요.", "source": "https://www.diningcode.com/profile.php?rid=Cr9J91gdeE25"},
    "해빔": {"open": "11:00", "close": "20:00", "breaks": [["15:00", "16:30"]], "lastOrder": "19:30", "closedDates": ["2026-10-07"], "note": "10/7 휴무 표시. 주말은 20:30 종료·20:00 주문 마감으로 평일과 다름.", "source": "https://www.diningcode.com/profile.php?rid=UkGylKAoTRkI"},
    "카와루라멘": {"open": "11:00", "close": "20:30", "breaks": [["14:50", "17:00"]], "lastOrder": "20:00", "note": "점심 주문 마감 14:20. 당일 확인 필요.", "source": "https://www.diningcode.com/profile.php?rid=PC1EN9MY0W2g"},
    "노적봉예술공원미술관": {"open": "09:00", "close": "18:00", "lastEntry": "17:30", "closedWeekdays": [1], "closedDates": ["2026-10-03", "2026-10-09"], "note": "10/3 개천절·10/9 한글날은 카카오맵 휴관 표시. 월요일 휴관(공휴일이면 다음날). 현재 전시와 2·3층 출입구 확인.", "source": "https://www.mokpo.go.kr/artmuseum/visit"},
    "그때그짜장집": {"open": "10:30", "close": "20:00", "breaks": [["16:00", "17:00"]], "lastOrder": "19:20", "closedWeekdays": [1], "note": "장소 정보 기준. 방문일 재확인.", "source": "https://www.diningcode.com/profile.php?rid=HRAAghPr360h"},
    "트라이팟": {"open": "11:30", "close": "21:00", "breaks": [["15:00", "17:00"]], "lastOrder": "20:00", "closedWeekdays": [1], "note": "점심 주문 마감 14:00. 예약·특별휴무 확인.", "source": "https://www.diningcode.com/profile.php?rid=RgFf44xolOx6"},
    "오늘의 페이지": {"open": "12:00", "close": "19:00", "closedWeekdays": [1, 2], "note": "목포도서관 2026년 명단 기준. 월·화 휴무.", "source": "https://mplib.jne.go.kr/menu.es?mid=a20108010100"},
    "유유랜드": {"open": "12:00", "close": "18:00", "closedWeekdays": [1], "note": "업주 프로필 기준. 체험은 100% 예약제.", "source": "https://www.daangn.com/kr/local-profile/%EC%9C%A0%EC%9C%A0%EB%9E%9C%EB%93%9C-8nefzfc216z2/"},
}

# Public outdoor access has no published admission schedule. Facilities inside
# these areas (shows, shops, ferries, buildings) retain their own time rules.
UNRESTRICTED_OUTDOORS = {
    "유달산", "노적봉", "서산동 시화골목", "보리마당",
    "목포진 역사공원", "평화광장", "유달산 조각공원",
    "삼학도 공원·이난영공원", "북항 노을공원",
    "양을산산림욕장", "유달산 낙조대", "옥단이길",
    "외달도", "달리도",
}

# Only the public approach side of these areas is used for a short optional
# stroll. The mapped point is an approach marker, not a claim that every mural
# lane or the full deck has been walked and verified.
SHORT_SCENIC_WALKS = {
    "서산동 시화골목": {
        "minutes": 20,
        "label": "연희네슈퍼 위쪽 공개 골목 일부 산책",
        "source": "https://tour.mokpo.go.kr/tour/theme/movie",
    },
    "고하도 전망대·해안데크": {
        "minutes": 20,
        "label": "전망대 쪽 해안데크 일부 왕복",
        "source": "https://youth.mokpo.go.kr/tour/support/popup?idx=454942&mode=view&page=8",
    },
}

# Kakao Map's dated seven-day display, read on 2026-10-03. These are not
# inferred permanent weekly rules; each place keeps its own independent text.
MAP_WEEK = {
    "노적봉예술공원미술관": "10/3(토) 개천절 휴관 · 10/4(일) 09:00~18:00 · 10/5(월) 휴관 · 10/6(화)~8(목) 09:00~18:00 · 10/9(금) 한글날 휴관",
    "김대중노벨평화상기념관": "10/3(토)~4(일) 09:00~18:00 · 10/5(월) 휴관 · 10/6(화)~9(금) 09:00~18:00",
    "소년 김대중 공부방": "10/3(토)~9(금) 매일 09:00~18:00로 지도 표시. 관광공사의 월요일 휴무 안내와 충돌",
    "목포어린이바다과학관": "10/3(토)~4(일) 09:00~18:00 · 10/5(월) 휴관 · 10/6(화)~9(금) 09:00~18:00",
    "목포문학관": "10/3(토)~4(일) 09:00~18:00 · 10/5(월) 휴관 · 10/6(화)~9(금) 09:00~18:00",
    "국립호남권생물자원관": "10/3(토)~4(일) 09:30~17:30 · 10/5(월) 휴관 · 10/6(화)~9(금) 09:30~17:30",
    "목포문화예술회관": "10/3(토)~4(일) 전시관 09:00~18:00 · 10/5(월) 휴관 · 10/6(화)~9(금) 전시관 09:00~18:00. 실제 전시 일정 별도",
    "남농기념관": "10/3(토)~4(일) 14:00~18:00 · 10/5(월)~6(화) 휴관 · 10/7(수)~9(금) 14:00~18:00. 목포시 요금표와 충돌",
    "에스타시옹1913": "10/3(토) 17:00~21:00 · 10/4(일)~6(화) 휴무 · 10/7(수)~8(목) 17:00~22:00 · 10/9(금) 17:00~21:00",
    "그때그짜장집": "10/3(토)~4(일) 10:30~20:00 · 10/5(월) 휴무 · 10/6(화)~9(금) 10:30~20:00",
    "라멘집아저씨": "10/3(토)~5(월) 11:00~20:00 · 10/6(화) 휴무 · 10/7(수)~9(금) 11:00~20:00",
    "예향밥상": "10/3(토) 11:30~14:00 · 10/4(일) 휴무 · 10/5(월)~9(금) 11:30~20:00",
    "금강뻘낙지장어요리전문점": "10/3(토) 10:30~21:00 · 10/4(일) 휴무 · 10/5(월)~9(금) 10:30~21:00",
    "형제꼬막짬뽕": "10/3(토)~4(일) 10:20~19:30 · 10/5(월) 휴무 · 10/6(화)~9(금) 10:20~19:30",
    "삼학만두": "10/3(토)~9(금) 매일 10:00~19:00",
    "압해도뻘낙지": "10/3(토) 11:30~21:30 · 10/4(일) 휴무 · 10/5(월)~9(금) 11:30~21:30",
    "청호식당": "10/3(토) 11:00~15:00 · 10/4(일) 휴무 · 10/5(월)~9(금) 11:00~15:00",
    "이가네고기국수": "10/3(토)~8(목) 10:30~19:00 · 10/9(금) 10:30~14:00",
    "구라파소년": "10/3(토) 11:30~21:00 · 10/4(일) 휴무 · 10/5(월)~9(금) 11:30~21:00. 지도에는 매월 첫째·셋째 월요일 휴무 설명도 있어 10/5 표시와 충돌",
    "트라이팟": "10/3(토)~4(일) 11:30~21:00 · 10/5(월) 휴무 · 10/6(화)~9(금) 11:30~21:00",
    "아르볼": "10/3(토) 08:00~19:00 · 10/4(일) 시간 미표시 · 10/5(월)~6(화) 08:00~19:00 · 10/7(수) 08:00~17:00 · 10/8(목)~9(금) 08:00~19:00",
    "브릭레인": "10/3(토)~4(일) 10:30~20:30 · 10/5(월) 휴무 · 10/6(화)~9(금) 10:30~20:30",
    "더왈츠": "10/3(토)~4(일) 10:00~22:00 · 10/5(월) 휴무 · 10/6(화)~9(금) 10:00~22:00",
    "산들소리찻집": "10/3(토)~9(금) 매일 09:30~22:30",
    "손소영갤러리앤카페": "10/3(토)~4(일) 10:00~17:00 · 10/5(월)~6(화) 휴무 · 10/7(수)~9(금) 10:00~17:00",
    "아마빌레": "10/3(토)~9(금) 매일 11:00~21:30",
    "티하우스클리프": "10/3(토)~4(일) 12:00~21:00 · 10/5(월)~9(금) 10:00~21:00",
    "기찻길315": "10/3(토)~4(일) 12:30~22:30 · 10/5(월)~9(금) 10:30~22:30",
    "라니카이": "10/3(토) 11:00~22:00 · 10/4(일) 11:00~21:00 · 10/5(월)~7(수) 11:00~20:30 · 10/8(목) 휴무 · 10/9(금) 11:00~20:30",
    "고호의 책방": "10/3(토) 10:00~20:00 · 10/4(일)~8(목) 11:00~19:00 · 10/9(금) 10:00~20:00",
    "목포종합수산시장": "10/3(토) 07:00~20:00 · 10/4(일) 휴무 · 10/5(월)~9(금) 07:00~20:00 (시장 대표 시간, 점포별 상이)",
    "작은낙": "10/3(토)~6(화) 11:00~18:00 · 10/7(수)~8(목) 시간 미표시 · 10/9(금) 11:00~18:00",
    "물망초": "10/3(토) 11:00~18:00 · 10/4(일) 12:00~18:00 · 10/5(월) 11:00~17:00 · 10/6(화) 휴무 · 10/7(수)~8(목) 11:00~17:00 · 10/9(금) 11:00~18:00",
    "청호시장": "10/3(토) 09:00~21:30 · 10/4(일) 휴무 · 10/5(월)~9(금) 09:00~21:30 (시장 대표 시간, 점포별 상이)",
    "목포동부시장": "10/3(토)~9(금) 매일 08:00~22:00로 지도 표시 (시장 대표 시간, 점포별 상이)",
    "나비팩토리": "10/3(토)~9(금) 매일 12:00~19:00로 지도 표시. 체험 회차는 예약 별도",
    "가죽공방 모닉": "10/3(토) 11:00~19:00 · 10/4(일) 시간 미표시 · 10/5(월)~9(금) 11:00~19:00. 외부 출강 시 매장을 비울 수 있음",
    "비팡이네": "10/3(토)~9(금) 매일 09:00~20:00로 지도 표시",
    "유유랜드": "10/3(토)~4(일) 12:00~18:00 · 10/5(월) 휴무 · 10/6(화)~9(금) 12:00~18:00 (소품샵 시간, 클래스 예약 별도)",
    "포도책방(목포점)": "10/3(토)~5(월) 11:00~19:00 · 10/6(화) 휴무 · 10/7(수)~9(금) 11:00~19:00. 공식 사이트의 수요일 휴무·12:00 시작과 충돌",
    "오늘의 페이지": "10/3(토)~4(일) 12:00~19:00 · 10/5(월)~6(화) 휴무 · 10/7(수)~9(금) 12:00~19:00",
    "웨이브": "10/3(토)~9(금) 매일 09:35~22:00로 지도 표시",
}

# DiningCode's dated display read on 2026-10-03. Each entry belongs to one
# business. An absent published schedule is explicitly marked unknown.
DINING_WEEK = {
    "영란횟집": "10/3(토)~9(금) 매일 10:30~21:30, 주문 20:30까지",
    "초원음식점(초원식당)": "10/3(토)~9(금) 매일 09:30~19:30, 브레이크 15:00~17:00. 점심 주문 14:30, 저녁 주문 19:00까지(10/6은 점심 주문 마감 미표시)",
    "장터식당 본점": "10/3(토) 11:30~20:00 · 10/4(일) 휴무 · 10/5(월)~7(수) 11:30~20:00 · 10/8(목) 휴무 · 10/9(금) 11:30~20:00. 영업일 브레이크 15:00~17:30, 주문 19:30까지",
    "인동주마을": "10/3(토) 10:00~20:00 · 10/4(일)~7(수) 10:30~22:00, 주문 20:40까지 · 10/8(목) 휴무 · 10/9(금) 10:00~20:00(주문 마감 미표시)",
    "은빛바다회센터(율석수산)": "10/3(토)~5(월) 12:00~21:30 · 10/6(화) 휴무 · 10/7(수)~9(금) 12:00~21:30. 영업일 브레이크 15:00~17:00, 주문 마감 미표시",
    "연희네포차(항구포차 9호)": "10/3(토)~4(일) 12:30~익일 01:00 · 10/5(월)~7(수) 15:00~24:00 · 10/8(목)~9(금) 15:00~익일 01:00. 주문 마감 미표시",
    "목포관광오리탕(시내본점)": "10/3(토)~9(금) 매일 10:00~21:00, 브레이크 15:30~16:30. 주문 마감 미표시",
    "해빔": "10/3(토)~4(일) 11:00~20:30, 주문 20:00까지 · 10/5(월)~6(화) 11:00~20:00, 주문 19:30까지 · 10/7(수) 휴무 · 10/8(목)~9(금) 11:00~20:00, 주문 19:30까지. 영업일 브레이크 15:00~16:30",
    "어락": "10/3(토)~9(금) 매일 10:00~22:00, 주문 21:00까지",
    "대명춘": "10/3(토)~6(화) 11:00~19:30 · 10/7(수) 휴무 · 10/8(목)~9(금) 11:00~19:30. 주문 마감 미표시",
    "솜리치킨 목포점": "10/3(토)~9(금) 매일 08:00~익일 05:00로 표시. 이례적으로 긴 시간이므로 전화 재확인 필요",
    "카와루라멘": "10/3(토)~9(금) 매일 11:00~20:30, 브레이크 14:50~17:00, 점심 주문 14:20·저녁 주문 20:00까지",
    "너구리식당": "10/3(토) 휴무 · 10/4(일) 11:00~14:00 · 10/5(월) 휴무 · 10/6(화)~7(수) 11:00~21:00, 브레이크 14:00~17:00, 점심 주문 13:30까지 · 10/8(목)~9(금) 휴무",
    "유달콩물(호남로 본점)": "10/3(토)~5(월) 08:00~17:30 · 10/6(화) 휴무 · 10/7(수)~9(금) 08:00~17:30. 주문 마감 미표시",
    "소래기냉면": "10/3(토)~6(화) 11:00~17:00 · 10/7(수) 휴무 · 10/8(목)~9(금) 11:00~17:00. 영업일 주문 16:30까지",
    "김정림선지해장국": "10/3(토)~4(일) 휴무 · 10/5(월)~8(목) 10:00~21:00, 브레이크 16:00~17:00, 주문 20:15까지 · 10/9(금) 휴무",
    "정성김밥": "10/3(토) 11:00~16:30 · 10/4(일) 11:00~17:40 · 10/5(월) 휴무 · 10/6(화)~7(수) 11:00~18:40 · 10/8(목) 11:00~16:30 · 10/9(금) 11:00~15:30. 주문 마감 미표시",
    "원조제일돌곱창": "10/3(토) 11:30~22:30 · 10/4(일) 휴무 · 10/5(월)~8(목) 11:30~22:00 · 10/9(금) 11:30~22:30. 주문 마감 미표시",
    "야드레보쌈": "10/3(토) 휴무 · 10/4(일)~5(월) 11:00~21:00 · 10/6(화) 휴무 · 10/7(수) 11:00~21:00 · 10/8(목)~9(금) 휴무. 영업일 브레이크 15:00~17:00, 점심 주문 14:10·저녁 주문 20:10까지",
    "왕새우직판장 본점": "10/3(토) 확인 시 다이닝코드에 날짜별 영업시간 미표시. 다른 공개 자료의 시간이 서로 달라 매장 확인 필요",
    "조선쫄복탕": "10/3(토)~9(금) 매일 08:00~20:00, 브레이크 16:00~17:00, 주문 19:00까지",
    "춘광식당": "10/3(토) 10:30~20:00 · 10/4(일) 휴무 · 10/5(월)~9(금) 10:30~20:00. 영업일 브레이크 14:30~17:00, 주문 마감 미표시",
    "원조신선횟집": "10/3(토)~4(일) 16:30~22:00 · 10/5(월) 휴무 · 10/6(화)~9(금) 16:30~22:00. 주문 마감 미표시",
    "관우식당": "10/3(토) 11:00~17:00 · 10/4(일) 휴무 · 10/5(월)~9(금) 11:00~17:00. 주문 마감 미표시",
    "미달이네집밥": "10/3(토) 06:00~15:00 · 10/4(일) 휴무 · 10/5(월)~9(금) 06:00~15:00. 주문 마감 미표시",
    "서해반점": "10/3(토)~4(일) 휴무 · 10/5(월)~7(수) 10:30~19:00, 브레이크 15:00~17:00, 점심 주문 14:30·저녁 주문 18:30까지 · 10/8(목)~9(금) 휴무",
    "88포장마차(원형로)": "10/3(토) 17:00~익일 03:00 · 10/4(일) 휴무 · 10/5(월)~8(목) 17:00~익일 01:00 · 10/9(금) 17:00~익일 03:00. 주문 마감 미표시",
    "꼬미꼬미": "10/3(토) 15:30~23:30 · 10/4(일) 10:00~22:00 · 10/5(월)~7(수) 16:00~23:30, 주문 22:10까지 · 10/8(목) 15:30~23:30 · 10/9(금) 휴무",
    "용당반점": "10/3(토)~9(금) 매일 10:00~20:30. 주문 마감 미표시",
    "오두막집": "10/3(토) 11:30~20:00 · 10/4(일) 11:00~15:00 · 10/5(월)~9(금) 11:30~20:00. 주문 마감 미표시",
    "만났지식당": "10/3(토) 확인 시 다이닝코드·카카오맵 모두 날짜별 영업시간 미표시. 매장 확인 필요",
    "찬의여왕 식당": "10/3(토)~9(금) 매일 09:00~21:00. 주문 마감 미표시",
    "어채": "10/3(토) 확인 시 다이닝코드·카카오맵 모두 날짜별 영업시간 미표시. 예약·영업시간 매장 확인 필요",
    "그때그짜장집": "10/3(토)~4(일) 10:30~20:00 · 10/5(월) 휴무 · 10/6(화)~9(금) 10:30~20:00. 영업일 브레이크 16:00~17:00, 주문 19:20까지",
    "금강뻘낙지장어요리전문점": "10/3(토) 10:30~21:00 · 10/4(일) 휴무 · 10/5(월)~9(금) 10:30~21:00. 10/5~7 주문 20:20까지, 10/3·8~9 주문 마감 미표시",
    "이가네고기국수": "10/3(토)~4(일) 10:00~18:00 · 10/5(월)~8(목) 10:00~19:00 · 10/9(금) 10:00~14:00. 주문 마감 미표시",
    "트라이팟": "10/3(토)~4(일) 11:30~21:00 · 10/5(월) 휴무 · 10/6(화)~9(금) 11:30~21:00. 영업일 브레이크 15:00~17:00, 점심 주문 14:00·저녁 주문 20:00까지",
    "화신연쇄점": "10/3(토)~4(일) 09:00~19:00 · 10/5(월) 09:00~19:00(주문 마감 미표시) · 10/6(화)~9(금) 10:00~19:00. 10/4·6~9 주문 18:30까지",
    "송자르트": "10/3(토) 09:00~23:00 · 10/4(일)~7(수) 09:00~22:00 · 10/8(목)~9(금) 09:00~23:00. 주문 마감 미표시",
    "유달동의로망스": "10/3(토)~4(일) 08:00~22:00 · 10/5(월) 휴무 · 10/6(화)~9(금) 08:00~22:00. 주문 마감 미표시",
    "달몬트": "10/3(토)~9(금) 매일 09:00~22:00. 주문 마감 미표시",
    "쿠레레": "10/3(토) 10:00~20:00 · 10/4(일) 10:00~17:00, 주문 16:30까지 · 10/5(월)~7(수) 10:00~20:00, 주문 19:30까지 · 10/8(목) 10:00~18:00, 주문 17:30까지 · 10/9(금) 10:00~20:00, 주문 19:30까지",
    "오리진 커피 로스터스": "10/3(토)~9(금) 매일 12:00~22:00, 주문 21:30까지",
    "커피창고로(평화광장점)": "10/3(토)~9(금) 매일 10:00~22:30. 주문 마감 미표시",
    "혹호": "10/3(토)~4(일) 10:00~20:00 · 10/5(월) 휴무 · 10/6(화)~9(금) 10:00~20:00. 영업일 주문 19:30까지",
    "인스파이어링 커피": "10/3(토)~4(일) 휴무 · 10/5(월)~9(금) 08:30~18:30, 주문 18:00까지",
    "아르볼": "다이닝코드: 10/3(토) 08:00~21:00 · 10/4(일) 휴무 · 10/5(월)~6(화) 08:00~21:00 · 10/7(수) 08:00~17:00 · 10/8(목)~9(금) 08:00~21:00. 카카오맵의 19:00 종료와 충돌",
    "브릭레인": "10/3(토)~4(일) 10:30~20:30 · 10/5(월) 휴무 · 10/6(화)~9(금) 10:30~20:30. 주문 마감 미표시",
    "더왈츠": "다이닝코드: 10/3(토)~9(금) 전 기간 휴무 표시. 카카오맵의 월요일만 휴무·그 외 10:00~22:00 표시와 충돌. 방문 전 매장 확인 필요",
    "기찻길315": "10/3(토)~5(월) 12:30~22:00 · 10/6(화)~9(금) 10:30~22:00. 주문 마감 미표시",
    "라니카이": "10/3(토)~4(일) 11:00~21:00, 10/4 주문 20:30까지 · 10/5(월)~7(수) 11:00~20:30, 주문 20:00까지 · 10/8(목) 휴무 · 10/9(금) 11:00~21:00(주문 마감 미표시)",
    "한마을떡": "10/3(토) 확인 시 다이닝코드에 날짜별 영업시간 미표시. 매장 확인 필요",
    "목포쫀드기 본점": "10/3(토)~9(금) 매일 08:30~19:00. 주문 마감 미표시",
}

# Give every non-food place one primary browsing category. Filter buttons may
# combine these categories in the app; the original research sections remain
# unchanged so the source notes retain their meaning.
CATEGORY_GROUPS = {
    "outdoors": (
        "유달산", "노적봉", "고하도 전망대·해안데크", "갓바위·해상보행교",
        "서산동 시화골목", "보리마당", "목포진 역사공원", "평화광장",
        "유달산 조각공원", "삼학도 공원·이난영공원", "외달도", "달리도",
        "북항 노을공원", "유달유원지", "양을산산림욕장", "유달산 낙조대",
        "옥단이길", "장좌도", "율도(눌도)",
    ),
    "culture": (
        "목포근대역사관 1관", "목포근대역사관 2관", "연희네슈퍼",
        "목포자연사박물관", "성옥기념관", "목포문예역사관",
        "목포생활도자박물관", "목포대중음악의전당",
        "목포모자아트갤러리(옛 갑자옥모자점)",
        "수중유산박물관(옛 국립해양유물전시관)", "노적봉예술공원미술관",
        "김대중노벨평화상기념관", "소년 김대중 공부방",
        "목포어린이바다과학관", "목포문학관", "국립호남권생물자원관",
        "목포문화예술회관", "노라노미술관", "남농기념관", "옥공예전시관",
    ),
    "experience": (
        "목포해상케이블카 북항승강장", "목포해상케이블카 유달산승강장",
        "목포해상케이블카 고하도승강장", "춤추는 바다분수",
        "목포스카이워크", "목포삼학도크루즈",
    ),
    "market": (
        "목포종합수산시장", "씨엘비베이커리(원도심점)", "코롬방제과점",
        "한마을떡", "목포쫀드기 본점", "청호시장", "목포동부시장",
    ),
    "books": (
        "고호의 책방", "작은낙", "물망초", "나비팩토리", "가죽공방 모닉",
        "비팡이네", "유유랜드", "포도책방(목포점)", "구보책방",
        "오늘의 페이지", "웨이브",
    ),
}
CATEGORY_BY_NAME = {name: category for category, names in CATEGORY_GROUPS.items() for name in names}
assert len(CATEGORY_BY_NAME) == sum(len(names) for names in CATEGORY_GROUPS.values()), "Duplicate place category"

section = ""
subsection = ""
places = {}
time_rows = {}
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
    if line.startswith("### "):
        subsection = line[4:]
    if not section or not line.startswith("| ") or line.startswith("| ---"):
        continue
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    if len(cells) < 3 or cells[0] in ("장소", "장소·분류", "음식점·종류", "카페"):
        continue
    if subsection.startswith("영업·분류 재확인") or subsection.startswith("지도에서 추가 확인한 시장") and "조건부" in cells[0]:
        continue
    name = plain(cells[0]).split(" · ")[0]
    if not name or name in places:
        continue
    location_cell = cells[2] if section == "cafe" and subsection.startswith("지도 평점") else cells[1]
    if section == "shop" and subsection.startswith("문구·소품"):
        location_cell = cells[2]
    coords = re.search(r"mlat=([0-9.]+)&mlon=([0-9.]+)", line)
    if not coords:
        coords = re.search(r"약\s*([0-9.]+),\s*([0-9.]+)", line)
    lat, lon = (float(coords.group(1)), float(coords.group(2))) if coords else (None, None)
    links = re.findall(r"\]\((https?://[^)]+)\)", line)
    map_link = next((link for link in links if "place.map.kakao.com/" in link), None)
    rating_match = re.search(r"(?:\*\*)?([0-5]\.\d)\s*/\s*(?:평가\s*)?(\d+)", line)
    rating = float(rating_match.group(1)) if rating_match else None
    rating_count = int(rating_match.group(2)) if rating_match else None
    location = plain(location_cell)[:160]
    # Kakao address lookup uses the building address, never a guessed doorway.
    address = re.sub(r"^(목포시\s*)?", "", location).split(" · ")[0].split(";")[0].split(",")[0].strip()
    if "는 대표 주소" in address:
        address = address.split("는 대표 주소")[0]
    address = re.sub(r"\s+(?:1층|2층|상가|윈타워).*", "", address).strip()
    address_query = "목포시 " + address if re.search(r"(?:로|길)\d*번?길?\s*\d", address) and not any(word in location for word in ("일대", "대표 주소", "앞 바다", "자료상")) else None
    pin = verified_pins.get(name)
    if lat is None and pin and pin.get("query") == address_query:
        lat, lon = pin["lat"], pin["lon"]
    map_pin = representative_pins.get(name) if lat is None else None
    scenic_approach = name == "서산동 시화골목" and map_pin is not None
    if scenic_approach:
        lat, lon = map_pin["lat"], map_pin["lon"]
    places[name] = {
        "id": f"p{len(places)+1}",
        "name": name,
        "category": CATEGORY_BY_NAME[name] if section in ("spot", "shop") else section,
        "lat": lat,
        "lon": lon,
        "pinBasis": "scenicApproach" if scenic_approach else ("verifiedAddress" if pin and pin.get("query") == address_query else ("source" if lat is not None else None)),
        "mapLat": map_pin["lat"] if map_pin else None,
        "mapLon": map_pin["lon"] if map_pin else None,
        "mapPinBasis": map_pin["basis"] if map_pin else None,
        "locationText": location,
        "addressQuery": address_query if lat is None else None,
        "mapSource": map_link,
        "source": map_link or (links[0] if links else None),
        "rating": rating,
        "ratingCount": rating_count,
        "hours": HOURS.get(name),
        "unrestrictedAccess": name in UNRESTRICTED_OUTDOORS,
        "accessConstraint": "publicFerry" if name in ("외달도", "달리도") else None,
        "shortScenicWalk": SHORT_SCENIC_WALKS.get(name),
    }

assert set(representative_pins) <= set(places), "Unknown representative map pin"
assert all(34.7 <= pin["lat"] <= 34.9 and 126.2 <= pin["lon"] <= 126.6 for pin in representative_pins.values()), "Representative pin outside Mokpo"

in_hours = False
for line in SOURCE.read_text(encoding="utf-8").splitlines():
    if line.startswith("## 운영시간·입장·휴무 확인"):
        in_hours = True
    elif line.startswith("### 추가 확인 필요"):
        in_hours = False
    if not in_hours or not line.startswith("| ") or line.startswith("| ---"):
        continue
    cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
    if len(cells) != 4 or cells[0] in ("장소",):
        continue
    name = plain(cells[0])
    if name not in places:
        continue
    places[name]["scheduleText"] = plain(cells[1])
    places[name]["deadlineText"] = plain(cells[2])
    places[name]["closureText"] = plain(cells[3])
    links = re.findall(r"\]\((https?://[^)]+)\)", line)
    places[name]["scheduleSource"] = links[0] if links else None

for name, place in places.items():
    if place["category"] in ("food", "cafe"):
        evidence = solo_research["places"].get(name, {})
        place["soloVisit"] = evidence.get("solo", "unknown")
        place["soloVerdict"] = evidence.get("verdict") or ("single_item_unverified" if "최소 인원 미표기" in evidence.get("soloMenu", "") else "specific_menu" if evidence.get("soloMenu") else "review_only" if evidence.get("solo") in ("review_tag", "solo_visit_review") else "unknown")
        place["soloMenu"] = evidence.get("soloMenu")
        place["soloSeat"] = evidence.get("seat", "unknown")
        place["minimumOrder"] = evidence.get("minimum")
        place["soloNote"] = evidence.get("note")
        place["soloSource"] = evidence.get("source")
        place["soloMenuSource"] = evidence.get("soloMenuSource") or (evidence.get("source") if evidence.get("soloMenu") else None)
        place["minimumOrderSource"] = evidence.get("minimumSource") or (evidence.get("source") if evidence.get("minimum") else None)
        place["soloChecked"] = solo_research["checked"]
    if place["unrestrictedAccess"]:
        place["scheduleText"] = "산·공원·공공 골목의 야외 산책은 정해진 입장시간이 없는 것으로 분류. 공식 24시간 운영을 보증하는 뜻은 아니며 기상·안전 통제는 별도 확인."
        place["deadlineText"] = "야외 산책 자체의 매표·마지막 입장 없음. 구역 안 시설·공연·배편은 각각의 운영시간 적용."
        if name in ("외달도", "달리도"):
            place["scheduleText"] += " 섬 방문은 실제 여객선 운항·귀항편 시간에 제한됨."
    if name in MAP_WEEK:
        place["mapWeekText"] = MAP_WEEK[name]
        place["mapWeekSource"] = place["mapSource"]
        place["mapWeekChecked"] = "2026-10-03"
    if name in DINING_WEEK:
        place["diningWeekText"] = DINING_WEEK[name]
        place["diningWeekSource"] = place["scheduleSource"]
        place["diningWeekChecked"] = "2026-10-03"

places["더왈츠"]["closureText"] = "카카오맵은 월요일 휴무, 다이닝코드는 10/3~9 전 기간 휴무로 표시해 충돌. 방문 전 매장 직접 확인 필요"
places["아르볼"]["closureText"] = "일요일 휴무 표시는 일치하나 카카오맵과 다이닝코드의 종료 시각이 다름. 방문 전 매장 확인 필요"

for name in ("목포해상케이블카 북항승강장", "목포해상케이블카 유달산승강장", "목포해상케이블카 고하도승강장"):
    place = places[name]
    place["scheduleText"] = "10월 요일별 시간은 운영사 당일 공지 기준으로 확인 필요. 카카오 예약 안내는 월~목·일 09:00~20:00, 금·토 09:00~21:00로 표시하지만 목포시 관광 페이지의 계절 시간과 충돌한다."
    place["deadlineText"] = "운영사가 운행 종료 1시간 전 발권 종료를 공지. 정규 브레이크타임은 별도 공지되지 않았으며 중간역 재탑승 조건은 승차권별 확인 필요."
    place["closureText"] = "고정 정기휴무 공지 없음. 기상·안전상 예고 없이 조기 마감 또는 휴장 가능. 061-244-2600으로 당일 확인."
    place["scheduleSource"] = "https://www.mmcablecar.com/"

payload = json.dumps({"updated": "2026-10-05", "region": "목포", "places": list(places.values())}, ensure_ascii=False, indent=2)
for target in TARGETS:
    target.write_text(payload, encoding="utf-8")
print(f"Wrote {len(places)} places ({sum(p['lat'] is not None or p['mapLat'] is not None for p in places.values())} map pins) to {', '.join(map(str, TARGETS))}")
