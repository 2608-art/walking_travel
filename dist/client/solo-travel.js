/* 혼자 여행 선택: 메뉴 조건과 직접 방문 근거를 구분한다. */
(() => {
  'use strict';
  const REVIEW_FOOD_IDS = new Set(['p60','p72','p77','p79']);
  const INFERRED_FOOD_IDS = new Set(['p57','p84','p91']);
  const MEAL_CAFE_IDS = new Set(['p94','p105']);
  const diningReview = (p) => !!p?.soloResearch?.reviews?.some(r => r.kind === 'solo_dining' && r.url);
  const unsuitable = (p) => p?.soloResearch
    ? p.soloResearch.takeout?.status === 'only' || p.soloResearch.verdict === 'takeout_only' || p.soloResearch.minimumOrder?.appliesToAll === true && p.soloResearch.verdict === 'not_possible'
    : ['not_possible','takeout_only'].includes(p?.soloVerdict);
  function canEat(p) {
    if (!p || unsuitable(p)) return false;
    if (p.soloResearch) {
      if (!['food','cafe'].includes(p.category)) return false;
      if (diningReview(p)) return true;
      if (p.category === 'cafe') return p.soloResearch.mealMenu?.confirmed === true;
      return ['specific_menu','single_item_unverified','solo_allowed_conditions'].includes(p.soloResearch.verdict);
    }
    if (p.category === 'cafe') return MEAL_CAFE_IDS.has(p.id);
    if (p.category !== 'food') return false;
    return ['specific_menu','single_item_unverified'].includes(p.soloVerdict) ||
      REVIEW_FOOD_IDS.has(p.id) || INFERRED_FOOD_IDS.has(p.id);
  }
  function canVisit(p) {
    return !!p && !unsuitable(p) && (p.category !== 'food' || canEat(p));
  }
  function evidenceLevel(p) {
    if (diningReview(p)) return '혼자 식사 후기 확인';
    if (p?.soloResearch?.reviews?.some(r => r.kind === 'solo_visit' && r.url)) return '혼자 방문 후기 확인';
    if (p?.soloResearch?.verdict === 'solo_allowed_conditions') return '1인 방문 허용 확인 · 주문 조건 있음';
    if ((p?.soloResearch?.verdict || p?.soloVerdict) === 'specific_menu') return '특정 1인 메뉴 확인';
    if ((p?.soloResearch?.verdict || p?.soloVerdict) === 'single_item_unverified') return '단품 메뉴 확인 · 1인 주문 미확인';
    return '혼자 이용 근거 미확인';
  }
  const api={canEat,canVisit,evidenceLevel};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  if (typeof window !== 'undefined') window.HangeoreumSoloTravel=api;
})();
