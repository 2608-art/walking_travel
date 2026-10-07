/* 장소 예약 정보. 시간표 저장과 실제 예약을 구분한다. */
(() => {
  'use strict';
  const labels = {required:'예약 필수',recommended:'예약 권장',unknown:'필수 여부 미확인'};
  function items(p) { return (p?.reservation?.items || []).filter(x => labels[x.status] && x.scope); }
  function warnings(places) {
    const seen = new Set();
    return places.filter(Boolean).flatMap(p => {
      if (seen.has(p.id)) return []; seen.add(p.id);
      return items(p).map(item => ({placeId:p.id,name:p.name,...item,message:item.status === 'required' ? '사전 예약 필요' : '방문 전 확인 필요'}));
    });
  }
  const api = {items,warnings,label:status => labels[status] || labels.unknown};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  if (typeof window !== 'undefined') window.HangeoreumPlaceBooking=api;
})();
