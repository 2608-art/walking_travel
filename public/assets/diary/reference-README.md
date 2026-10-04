# 참고 이미지 반영 자산 — 2026-10-04 (한국 시간)

- `reference-landscape.png`: 사용자 제공 네 화면 참고 이미지를 입력으로 사용해 내장 `image_gen`으로 만든 홈 배경. 실제 지도·여행지 사진이 아닌 장식 일러스트다. 원본을 그대로 복사했으며 별도 비트맵 편집을 하지 않았다.
- 생성 방식: imagegen Skill, `referenced_image_paths`를 사용한 참고 이미지 기반 새 자산 생성. 투명 배경 false.
- 입력: `codex-clipboard-88a5de0c-9204-4499-ab77-d64465027db6.png`. 전체 화면 캡처를 UI로 붙이지 않고 풍경 스타일만 참고했다.
- 결과: [reference-landscape.png](reference-landscape.png). 텍스트·거북이·검색·버튼은 기존 앱의 실제 요소로 렌더링한다.
- [flowers.svg](flowers.svg), [route-doodles.svg](route-doodles.svg): AI가 코드로 만든 작은 꽃과 기존 6개 테마용 장식. ImageGen 산출물이 아니며 지도 좌표나 추천 코스를 표현하지 않는다.
- 기존 `travel-sketch.png`는 이미지가 없는 장소의 유형 배경으로 유지한다. 홈은 새 자산을 사용한다.

## 실제 생성 프롬프트

Create a production-ready website background asset, NOT a screenshot or a UI mockup. Use the attached four-screen Korean turtle travel app screenshot ONLY as the style reference. Recreate the atmosphere of the FIRST screen's hand-drawn scenery: warm pale ivory paper (#fffaf0), fine dark-olive pencil outlines, translucent watercolor sage and olive leaves, delicate powder-blue seaside water and a distant simple bridge, little winding sandy footpath. Airy friendly travel diary illustration. Landscape illustration sits in the BOTTOM 35 percent and thin left/right edges. The TOP 60 percent and middle-left must remain very quiet, almost plain ivory, for live HTML headlines. Two tiny pale-blue outlined clouds near top-right, one tiny ochre sun near upper center-right. Right lower corner has a little pale green hill and plants with room for an existing turtle mascot overlay. No people, NO TURTLES or other characters, NO text, no letters, no UI, no buttons, no phones, no photo. Match reference's hand outlined illustrative look, NOT painterly photorealism. Wide 3:2 canvas, edges softly blend into #fffaf0.
