# 한걸음 아이콘·로고 — 기본형 1번 (2026-10-04, 한국 시간)

사용자가 제공한 후보 이미지에서 **앱 아이콘 1번 기본형**과 **상단 로고 1번 기본형**을 명시적으로 선택했다. 다른 화면 구성과 마스코트 포즈는 바꾸지 않았다.

## 자산과 실제 적용

- [app-icon.png](app-icon.png): ImageGen 원본 1254×1254. 크림 배경, 웃는 거북이 얼굴 중심, 노란 강조선. 실제 생성 해상도를 보존했다.
- [header-logo-source.png](header-logo-source.png): ImageGen 원본 2172×724 RGBA, 투명 배경, 거북이와 정확한 `한걸음` 글자.
- [header-logo.png](header-logo.png): 원본 디자인 그대로 600×200으로 출력, 앱에서는 150×50 영역에 표시. `alt="한걸음"`으로 접근 가능한 브랜드명을 유지한다.
- [설치용 192px](../../icon-192.png), [설치용 512px](../../icon-512.png), [브라우저용 64px](favicon-64.png), [iPhone용 180px](apple-touch-icon.png).
- 내장 image_gen으로 생성했다. 원본은 별도로 보존하고 Windows System.Drawing으로 앱 전달 규격만 축소 출력했다. 캐릭터·글자 재그림이나 배경 제거 편집은 하지 않았다. PNG 투명 채널을 유지했다.
- 설치 아이콘은 `purpose: any`로 제공해 OS가 여백·마스크를 처리한다. 외곽 그림이 잘릴 수 있으므로 검증하지 않은 maskable 전용 아이콘으로 선언하지 않았다. [웹앱 매니페스트 공식 안내](https://web.dev/learn/pwa/web-app-manifest).
- 이전 화살표 `icon.svg`는 이력 파일로만 남고 현행 HTML·매니페스트·필수 캐시에서 참조하지 않는다.

## 생성 방식과 입력

imagegen Skill / 내장 도구 / 참고 이미지 기반 생성(두 자산 각각 호출). 아이콘 투명 배경 false, 로고 true. 참고: `codex-clipboard-6f98a5cb-1a92-4b81-b71d-4b10cb5bee27.png`. 참고 화면의 번호·설명·폰 프레임은 자산에 포함하지 않았다.

### 아이콘 프롬프트

Use case: logo-brand. Generate a final production square app icon asset, NOT a mockup or presentation. Reference image: attached board. Recreate ONLY the TOP LEFT app icon candidate numbered 1 (기본형 추천). Same adorable smiling pale sage turtle's oversized round head looking upward to the right, creamy face, small dark brown shiny eyes, peach cheeks, open happy mouth, dark olive brown pencil outlines and soft colored-pencil texture; a small amount of olive shell and tan backpack at bottom left; tiny warm golden excitement rays above left and right. Match the reference face silhouette and personality closely. Large face readable at 32px. Warm ivory cream background filling the entire square. No outer border, no baked-in rounded-corner mask, no shadow, no text, no letters, no numbering, no phone, no other candidates. Keep important face features within the central 75 percent of the square for launcher masking. Square 1024x1024.

### 로고 프롬프트

Use case: logo-brand. Create a final transparent horizontal header logo asset for the Korean travel app. Use attached board ONLY as reference. Faithfully recreate the TOP ROW RIGHT HALF candidate numbered 1 (기본형 추천): small cute sage turtle peeking up from a thin hand-drawn brown baseline on the left, oversized smiling round cream face turned upward-right, tiny black-brown eyes, peach cheeks, tiny olive shell at lower left, little golden excitement strokes around head. On the RIGHT, exact Korean text '한걸음' in dark forest green, bold rounded friendly hand-lettering, closely matching that reference wordmark. Exactly three Korean syllables 한 걸 음 with natural close spacing, rendered as one word 한걸음. Colored-pencil hand-drawn turtle, readable and refined, matches app icon candidate 1. No other text. Use a compact composition, turtle roughly 40% width and text 60%, vertically centered, small 5% outer breathing space. Transparent background, no ivory rectangle, no panel, no phone, no border or shadow. Wide canvas 3:1 aspect ratio. Do not include candidate labels or UI from reference.
