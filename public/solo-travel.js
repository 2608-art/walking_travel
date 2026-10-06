/* 지역별 혼자 여행 선택: 확인된 1인 메뉴와 직접 혼자 식사한 후기를 식사 후보에 반영한다. */
(() => {
  'use strict';
  const REVIEW_FOOD_IDS = new Set(['p60','p72','p77','p79']);
  const INFERRED_FOOD_IDS = new Set(['p57','p84','p91']);
  const MEAL_CAFE_IDS = new Set(['p94','p105']);
  const unsuitable = (p) => ['not_possible','takeout_only'].includes(p?.soloVerdict);
  function canEat(p) {
    if (!p || unsuitable(p)) return false;
    if (p.category === 'cafe') return MEAL_CAFE_IDS.has(p.id);
    if (p.category !== 'food' && !(p.category === 'market' && p.soloMeal === true)) return false;
    return p.soloVerdict === 'specific_menu' ||
      (p.soloVerdict === 'single_item_unverified' && !String(p.id).startsWith('g')) ||
      (p.soloVerdict === 'review_only' && p.soloVisit === 'solo_visit_review' && !!p.soloReviewSource) ||
      REVIEW_FOOD_IDS.has(p.id) || INFERRED_FOOD_IDS.has(p.id);
  }
  function canVisit(p) {
    return !!p && !unsuitable(p) && (p.category !== 'food' && !(p.category === 'market' && p.soloMeal === true) || canEat(p));
  }
  const api={canEat,canVisit};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  if (typeof window !== 'undefined') window.HangeoreumSoloTravel=api;
})();
