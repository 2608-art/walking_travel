/* 미리 검증해 둔 도보 구간. 좌표와 방향이 맞을 때만 API 대신 사용한다. */
(() => {
  'use strict';
  let paths = [];
  const finite = Number.isFinite;
  const near = (a,b) => Math.abs(a.lat-b.lat) < .0005 && Math.abs(a.lon-b.lon) < .0005;
  const validEndpoint = (p) => p && typeof p.id === 'string' && p.id && finite(p.lat) && finite(p.lon);
  function validVariant(v,from,to) {
    if (!v || typeof v.id !== 'string' || !v.id || typeof v.label !== 'string' || !v.label ||
        !finite(v.meters) || v.meters <= 0 || !finite(v.minutes) || v.minutes <= 0 ||
        !Array.isArray(v.points) || v.points.length < 2 ||
        !v.points.every(p => Array.isArray(p) && p.length === 2 && p.every(finite))) return false;
    const first={lat:v.points[0][1],lon:v.points[0][0]};
    const last={lat:v.points.at(-1)[1],lon:v.points.at(-1)[0]};
    return near(first,from) && near(last,to);
  }
  function setCatalog(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.paths)) throw new Error('저장 도보 경로 형식이 올바르지 않습니다.');
    const seen=new Set();
    const accepted=[];
    for (const path of data.paths) {
      if (!validEndpoint(path.from) || !validEndpoint(path.to) || !path.source ||
          typeof path.source.label !== 'string' || !path.source.label ||
          typeof path.source.url !== 'string' || !path.source.url.startsWith('https://') ||
          !Array.isArray(path.variants) || !path.variants.length ||
          path.from.id === path.to.id || !path.variants.every(v => validVariant(v,path.from,path.to))) throw new Error('저장 도보 구간의 좌표 또는 길선이 올바르지 않습니다.');
      const key=choiceKey(path.from,path.to);
      if (seen.has(key) || new Set(path.variants.map(v => v.id)).size !== path.variants.length) throw new Error('저장 도보 경로 ID가 중복됩니다.');
      seen.add(key);
      accepted.push(path);
    }
    paths=accepted;
  }
  function choiceKey(a,b) { return `${a?.id || ''}:${a?.lat}:${a?.lon}>${b?.id || ''}:${b?.lat}:${b?.lon}`; }
  function options(a,b) {
    const path=paths.find(item=>item.from.id === a?.id && item.to.id === b?.id && near(item.from,a) && near(item.to,b));
    return path ? path.variants.map(v=>({...v,source:path.source})).sort((a,b)=>a.meters-b.meters || a.minutes-b.minutes) : [];
  }
  function select(a,b,id='') {
    const variants=options(a,b);
    const selected=variants.find(v=>v.id===id) || variants[0];
    return selected ? {meters:selected.meters,minutes:selected.minutes,points:selected.points,savedPathId:selected.id,savedPathLabel:selected.label,source:selected.source} : null;
  }
  const api={setCatalog,choiceKey,options,select};
  if (typeof module !== 'undefined' && module.exports) module.exports=api;
  if (typeof window !== 'undefined') window.HangeoreumSavedWalkPaths=api;
})();
