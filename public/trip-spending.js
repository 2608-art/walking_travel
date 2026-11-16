/* Optional per-plan actual spending. Pure calculations; no storage or route changes. */
(() => {
  'use strict';
  const groups={food:'식비·간식',cafe:'카페',admission:'입장·체험',transport:'현지 교통'};
  const amount=v=>Number.isSafeInteger(v)&&v>=0&&v<=100000000;
  const text=(v,max)=>typeof v==='string'&&v.trim().length<=max;
  function read(raw) {
    if(raw==null)return {version:1,baseline:null,entries:[],complete:false};
    if(raw.version!==1||!Array.isArray(raw.entries)||raw.entries.length>1000)throw Error('지출 자료 형식을 확인해 주세요. 원본 계획 파일은 그대로 보존됩니다.');
    const ids=new Set();
    for(const e of raw.entries){if(!e||!text(e.id,100)||!e.id||ids.has(e.id)||!Object.hasOwn(groups,e.category)||!amount(e.amount)||!text(e.label,80)||!e.label.trim()||!text(e.reason,300))throw Error('읽을 수 없는 지출 기록이 있습니다. 원본 계획 파일을 확인해 주세요.');ids.add(e.id);}
    const b=raw.baseline;
    if(b!=null&&(!text(b.date,40)||!text(b.title,500)||!text(b.savedAt,50)||!Number.isInteger(b.people)||b.people<1||b.people>50||(b.cap!==null&&!amount(b.cap))||!Object.keys(groups).every(k=>b.breakdown?.[k]&&Number.isSafeInteger(b.breakdown[k].sum)&&b.breakdown[k].sum>=0&&Number.isInteger(b.breakdown[k].unknown)&&b.breakdown[k].unknown>=0)))throw Error('저장한 비교 기준을 읽을 수 없습니다. 원본 계획 파일을 확인해 주세요.');
    return JSON.parse(JSON.stringify({version:1,baseline:b??null,entries:raw.entries,complete:raw.complete===true}));
  }
  function capture(estimate,plan,now=new Date().toISOString()) {
    if(!estimate?.config.enabled)throw Error('예산 비교를 켜고 예상 비용을 먼저 확인해 주세요.');
    const b={date:plan.date,title:plan.title,people:estimate.config.people,cap:estimate.config.total,savedAt:now,breakdown:estimate.breakdown};
    return read({version:1,baseline:b,entries:[],complete:false}).baseline;
  }
  function entry(raw,id) {
    const s=String(raw.amount??'').trim();
    if(!/^\d+$/.test(s)||!amount(Number(s)))throw Error('금액은 0~100,000,000원의 정수로 입력해 주세요.');
    const e={id,category:raw.category,amount:Number(s),label:String(raw.label??'').trim(),reason:String(raw.reason??'').trim()};
    return read({version:1,entries:[e],complete:false}).entries[0];
  }
  function put(raw,e) {const s=read(raw),i=s.entries.findIndex(x=>x.id===e.id);if(i<0)s.entries.push(e);else s.entries[i]=e;s.complete=false;return read(s);}
  function remove(raw,id){const s=read(raw);s.entries=s.entries.filter(e=>e.id!==id);s.complete=false;return s;}
  function analyze(raw) {
    const s=read(raw), rows=Object.keys(groups).map(key=>{
      const entries=s.entries.filter(e=>e.category===key),actual=entries.reduce((n,e)=>n+e.amount,0),plan=s.baseline?.breakdown[key];
      return {key,actual,count:entries.length,planned:plan?.sum??null,unknown:plan?.unknown??null,variance:s.complete&&plan&&plan.unknown===0?actual-plan.sum:null,entries};
    });
    const actual=rows.reduce((n,r)=>n+r.actual,0),planned=s.baseline?rows.reduce((n,r)=>n+r.planned,0):null,unknown=s.baseline?rows.reduce((n,r)=>n+r.unknown,0):null;
    return {state:s,rows,actual,planned,unknown,variance:s.complete&&unknown===0?actual-planned:null,remaining:s.baseline?.cap!=null?s.baseline.cap-actual:null};
  }
  const api={groups,read,capture,entry,put,remove,analyze};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.HangeoreumSpending=api;
})();
