/* Optional budget calculations. Never changes routes, times or stored plans. */
(() => {
  'use strict';
  const MAX = 100000000;
  const groups = {food:'식비·간식',cafe:'카페',admission:'입장·체험',transport:'현지 교통'};
  const money = value => Number.isSafeInteger(value) && value >= 0 && value <= MAX;
  function amount(value) {
    if (value === '' || value == null) return null;
    const text=String(value).trim();
    if (!/^\d+$/.test(text)) return NaN;
    const number=Number(text); return money(number) ? number : NaN;
  }
  function settings(raw={}) {
    if(!raw || typeof raw!=='object')raw={};
    const people=Number(raw.people);
    return {version:1,enabled:raw.enabled===true,people:Number.isInteger(people)&&people>=1&&people<=50?people:1,
      total:money(raw.total)?raw.total:null,extraFood:money(raw.extraFood)?raw.extraFood:null,
      busFare:money(raw.busFare)?raw.busFare:null,
      extraTransport:money(raw.extraTransport)?raw.extraTransport:null,
      busCount:Number.isInteger(raw.busCount)&&raw.busCount>=0&&raw.busCount<=100?raw.busCount:null,
      overrides:Object.fromEntries(Object.entries(raw.overrides||{}).filter(([key,value])=>key.length<150&&money(value)))};
  }
  const category = place => place?.category==='cafe'?'cafe':['food','market'].includes(place?.category)?'food':'admission';
  function price(place) {
    const info=place?.priceInfo;
    const unknown=reason=>({unit:null,open:false,reason,info});
    if(!info || !/^https?:\/\//.test(info.source||'') || !info.checked) return unknown('가격 자료·출처 미확인');
    const text=String(info.price||'').trim(), label=String(info.label||''), note=String(info.note||'');
    if(text==='무료') return {unit:0,open:false,reason:label||'자료상 무료',info};
    if(/충돌|가격.{0,12}(달라|차이|변동)|다른.{0,8}가격|\d[\d,]*원도/.test(note+' '+text)) return unknown('가격 충돌·변동 확인 필요');
    if(/통합|동일 상품/.test(note)) return unknown('통합권·중복 결제 여부 확인 필요');
    if(/(?:[2-9]\d*\s*인|\d+\s*[~～-]\s*\d+\s*인|한상|한 상|반마리|한마리|\d+\s*g\b|\d+\s*kg\b|한판|한 판)/i.test(label)) return unknown('공유 메뉴·주문 수량 직접 확인');
    const match=text.match(/^(?:성인\s*|각\s*)?([\d,]+)원\s*(부터)?$/);
    if(!match) return unknown('메뉴·요금 구분 직접 확인');
    const unit=Number(match[1].replaceAll(',',''));
    if(!money(unit)) return unknown('금액 확인 필요');
    return {unit,open:!!match[2],reason:(label||'대표 비용')+' · 성인 1인당 대표 상품 1개 가정',info};
  }
  function routeItems(route,lookup) {
    const visits=route.stops || route.rows || [];
    const seen=new Map();
    const items=visits.map((row,index)=>{
      const place=lookup(row.placeId)||row;
      const occurrence=(seen.get(row.placeId)||0)+1;seen.set(row.placeId,occurrence);
      return {key:'place:'+row.placeId+(occurrence>1?':visit:'+occurrence:''),name:place.name||row.name||'직접 입력 장소',place,category:category(place),index};
    });
    const legs=route.legs || [...(route.rows||[]),...(route.endWalk?[route.endWalk]:[])];
    let busCount=0,unknownTransport=false;
    for(const leg of legs) {
      const detail=leg.busLeg||leg;
      if(['bus','transit'].includes(detail.mode||leg.mode)) {
        const steps=detail.steps?.filter(step=>step.type==='BUS');
        busCount+=Math.max(1,steps?.length||0);
      } else if(!['walk',undefined].includes(detail.mode||leg.mode)) unknownTransport=true;
    }
    return {items,busCount,unknownTransport,walkMeters:route.walkMeters||0};
  }
  function estimate(model,raw) {
    const config=settings(raw), breakdown=Object.fromEntries(Object.keys(groups).map(key=>[key,{sum:0,unknown:0}]));
    const items=model.items.map(item=>{
      const quoted=price(item.place), custom=config.overrides[item.key];
      const total=money(custom)?custom:quoted.unit===null?null:quoted.unit*config.people;
      return {...item,...quoted,total,open:money(custom)?false:quoted.open,manual:money(custom),reason:money(custom)?'직접 입력 · 이번 방문의 일행 전체 금액':quoted.reason};
    });
    const foodPresent=items.some(item=>item.place?.category==='food');
    items.push({key:'extraFood',name:'추가 식비·간식',category:'food',total:config.extraFood??(foodPresent?0:null),open:false,
      reason:config.extraFood!==null?'직접 입력 · 일행 전체 금액':foodPresent?'선택한 식당 외 추가 지출 미입력':'식당 미선택 · 식비를 입력하거나 식당을 추가하세요'});
    items.push({key:'transport',name:model.unknownTransport?'현지 교통 (이동수단 확인 필요)':`현지 교통 · 버스 ${model.busCount}회`,category:'transport',
      total:model.unknownTransport?null:model.busCount?config.busFare===null?null:model.busCount*config.people*config.busFare:0,open:false,
      reason:model.unknownTransport?'계획 변경 또는 이동수단 미확인':model.busCount?config.busFare===null?'버스 요금 미입력':'직접 입력한 1회 1인 요금 × 탑승 횟수 × 인원 · 환승 할인 미적용':model.transportManual?'직접 입력한 버스 탑승 0회 · 추가 교통비는 별도':'선택한 코스는 도보 · 0원'});
    items.push({key:'extraTransport',name:'추가 현지 교통비',category:'transport',total:config.extraTransport??0,open:false,reason:config.extraTransport!==null?'직접 입력 · 택시 등 일행 전체 추가 금액':'선택한 경로 외 추가 교통비 미입력'});
    for(const item of items) {
      const part=breakdown[item.category];
      if(item.total!==null) part.sum+=item.total;
      if(item.total===null||item.open) part.unknown++;
    }
    const sum=Object.values(breakdown).reduce((n,p)=>n+p.sum,0), unknown=Object.values(breakdown).reduce((n,p)=>n+p.unknown,0);
    const status=config.total===null?'unset':sum>config.total?'over':unknown?'unknown':'within';
    return {config,items,breakdown,sum,unknown,status,remaining:config.total===null?null:config.total-sum,
      experienceCount:model.items.filter(item=>['culture','experience'].includes(item.place?.category)).length,walkMeters:model.walkMeters||0};
  }
  function choices(estimates) {
    if(!estimates.length)return [];
    const indexes=estimates.map((_,i)=>i);
    const certainty=(a,b)=>(estimates[a].unknown>0)-(estimates[b].unknown>0)||estimates[a].unknown-estimates[b].unknown;
    const affordable=(a,b)=>(estimates[a].status==='over')-(estimates[b].status==='over');
    return [
      {id:'saving',label:'절약형',index:[...indexes].sort((a,b)=>affordable(a,b)||certainty(a,b)||estimates[a].sum-estimates[b].sum)[0],description:'예산 초과 여부·확인 범위·낮은 비용 순으로 비교'},
      {id:'balanced',label:'균형형',index:[...indexes].sort((a,b)=>affordable(a,b)||certainty(a,b)||estimates[a].walkMeters-estimates[b].walkMeters||estimates[a].sum-estimates[b].sum)[0],description:'예산 초과 여부·확인 범위·짧은 도보 거리 순으로 비교'},
      {id:'experience',label:'체험형',index:[...indexes].sort((a,b)=>affordable(a,b)||certainty(a,b)||estimates[b].experienceCount-estimates[a].experienceCount||estimates[a].sum-estimates[b].sum)[0],description:'예산 초과 여부·확인 범위·문화/체험 수 순으로 비교'}
    ];
  }
  const api={MAX,groups,amount,settings,price,routeItems,estimate,choices};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.HangeoreumBudget=api;
})();
