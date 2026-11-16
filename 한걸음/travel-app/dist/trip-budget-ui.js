(() => {
  'use strict';
  const B=window.HangeoreumBudget;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const won=value=>value.toLocaleString('ko-KR')+'원';
  function status(e) {
    if(e.status==='over')return '예산 '+won(-e.remaining)+' 초과'+(e.unknown?' · 미확인 비용 별도':'');
    if(e.status==='unknown')return '미확인 비용 '+e.unknown+'건 · 예산 충족 판단 보류';
    if(e.status==='within')return '예상 기준 '+won(e.remaining)+' 여유';
    return '총예산 미입력'+(e.unknown?' · 미확인 '+e.unknown+'건':'');
  }
  function compact(e) {
    return `<span class="budget-compact">${e.unknown?'계산 가능한 금액':'예상 합계'} <b>${won(e.sum)}${e.unknown?' + 미확인':''}</b><small>${esc(status(e))}</small></span>`;
  }
  function formHTML(raw,plan=false) {
    const s=B.settings(raw);
    const input=(key,label,value,min=0,max=B.MAX)=>`<label class="field-group"><span class="field-label">${label}</span><input class="text-field" type="number" inputmode="numeric" step="1" min="${min}" max="${max}" data-budget-field="${key}" value="${value??''}" ${key==='people'?'required':''}></label>`;
    return `<section class="budget-settings" aria-label="현지 하루 예산 설정"><label class="check-line"><input type="checkbox" data-budget-enabled ${s.enabled?'checked':''}> 현지 하루 예산 비교하기</label><div data-budget-fields ${s.enabled?'':'hidden'}><p class="small">성인 기준 · 일행 전체 하루 비용. 식비·카페·현지 교통비·입장/체험료를 비교해요. 왕복 이동·숙박·쇼핑은 제외합니다.</p><div class="budget-fields">${input('people','여행 인원 (명)',s.people,1,50)}${input('total','일행 전체 총예산 (원)',s.total)}${input('extraFood','추가 식비·간식 · 일행 전체 (원)',s.extraFood)}${input('busFare','버스 1회 1인 예상 요금 (원)',s.busFare)}</div><p class="small">식당을 아직 고르지 않았다면 추가 식비를 입력하세요. 0원도 직접 정할 수 있어요. 버스 요금은 본인의 교통수단·할인 조건에 맞게 입력하며 환승 할인은 자동 적용하지 않습니다.</p><button type="button" class="btn btn-outline btn-sm" data-budget-apply>예산 적용</button><p class="small" data-budget-error role="status" aria-live="polite"></p></div></section>`;
  }
  function mountSettings(container,raw,onChange,plan=false) {
    container.innerHTML=formHTML(raw,plan);
    const section=container.firstElementChild;
    section.querySelector('.budget-fields').insertAdjacentHTML('beforeend',`<label class="field-group"><span class="field-label">추가 현지 교통비 · 일행 전체 (원)</span><input class="text-field" type="number" inputmode="numeric" min="0" max="${B.MAX}" step="1" data-budget-field="extraTransport" value="${B.settings(raw).extraTransport??''}" placeholder="택시 등 추가 비용"></label>`);
    if(plan) section.querySelector('.budget-fields').insertAdjacentHTML('beforeend',`<label class="field-group"><span class="field-label">현지 버스 탑승 횟수 (계획 전체)</span><input class="text-field" type="number" inputmode="numeric" min="0" max="100" step="1" data-budget-field="busCount" value="${B.settings(raw).busCount??''}"></label>`);
    section.querySelector('[data-budget-enabled]').onchange=event=>{
      const enabled=event.target.checked;
      onChange({...B.settings(raw),enabled});
    };
    section.querySelector('[data-budget-apply]').onclick=()=>{
      const config=B.settings(raw), error=section.querySelector('[data-budget-error]');
      for(const input of section.querySelectorAll('[data-budget-field]')) {
        const key=input.dataset.budgetField,value=B.amount(input.value);
        if(!input.checkValidity()||Number.isNaN(value)||(key==='people'&&(value===null||value<1||value>50))) {
          error.textContent=key==='people'?'인원은 1~50명의 정수로 입력해 주세요.':'금액은 0~100,000,000원의 정수로 입력해 주세요. 비워두면 미입력으로 처리합니다.';
          input.focus();return;
        }
        config[key]=value;
      }
      onChange(config);
    };
  }
  function mountDetails(container,estimate,onOverride) {
    const e=estimate;
    container.innerHTML=`<section class="budget-detail" aria-label="현지 하루 예상 비용"><div class="budget-summary"><div><span class="eyebrow">${e.config.people}명 · 일행 전체</span><h2>현지 하루 예상 비용</h2></div><strong>${won(e.sum)}${e.unknown?' + 미확인':''}</strong></div><p class="budget-status" role="status">${esc(status(e))}</p><div class="budget-totals">${Object.entries(B.groups).map(([key,label])=>`<div><small>${label}</small><b>${won(e.breakdown[key].sum)}</b>${e.breakdown[key].unknown?`<small>미확인 ${e.breakdown[key].unknown}건 별도</small>`:''}</div>`).join('')}</div><p class="small">선택한 방문과 입력한 추가 비용만 계산합니다. 대표 메뉴/상품을 성인 1인당 1개 이용하는 가정이며 실제 주문·할인·선택 체험에 따라 달라져요. 미확인 금액을 0원으로 확정하지 않습니다.</p><details class="budget-evidence"><summary>장소별 금액·출처 확인 및 수정</summary>${e.items.map((item,index)=>`<div class="budget-line"><div><strong>${esc(item.name)}</strong><p>${item.total===null?'미확인':won(item.total)+(item.open?'부터':'')} · ${esc(item.reason)}</p>${item.info?`<p class="small">자료: ${esc(item.info.label)} · ${esc(item.info.price)}<br>확인일 ${esc(item.info.checked)} ${/^https?:\/\//.test(item.info.source||'')?`<a href="${esc(item.info.source)}" target="_blank" rel="noopener noreferrer">출처 ↗</a>`:''}${item.info.note?'<br>'+esc(item.info.note):''}</p>`:''}</div>${item.key.startsWith('place:')?`<div class="budget-override"><label><span class="field-label">이번 방문 일행 전체 금액 (원)</span><input class="text-field" type="number" inputmode="numeric" step="1" min="0" max="${B.MAX}" value="${item.manual?item.total:''}" data-cost-input="${index}" placeholder="자료 기준 사용"></label><button type="button" class="btn btn-outline btn-sm" data-cost-save="${index}">적용</button></div>`:''}</div>`).join('')}<p class="small" data-cost-error role="status"></p><p class="small">통합권·공유 메뉴는 일행 전체 결제액을 직접 정해 주세요. 같은 상품을 이미 결제했다면 중복 방문에는 0원을 입력할 수 있습니다. 입력을 지우고 적용하면 자료 기준으로 돌아갑니다.</p></details>`;
    container.querySelectorAll('[data-cost-save]').forEach(button=>button.onclick=()=>{
      const index=Number(button.dataset.costSave),input=container.querySelector(`[data-cost-input="${index}"]`),value=B.amount(input.value);
      if(!input.checkValidity()||Number.isNaN(value)) {container.querySelector('[data-cost-error]').textContent='금액은 0~100,000,000원의 정수로 입력해 주세요.';input.focus();return;}
      onOverride(e.items[index].key,value);
    });
  }
  function mountComparison(container,estimates,onSelect) {
    container.innerHTML=`<section class="budget-profiles" aria-label="예산 기준 코스 비교"><h2>어떤 하루가 좋을까요?</h2><p class="small">현재 화면의 후보 안에서 비교해요. 미확인 비용이 남으면 유형 선택도 잠정 판단입니다. 같은 코스가 여러 유형에 맞을 수 있으며 전체 여행지의 최저가를 보장하지 않습니다.</p><div class="budget-profile-grid">${B.choices(estimates).map(choice=>`<button type="button" class="btn btn-outline budget-profile" data-budget-choice="${choice.index}"><strong>${choice.label}</strong><span>코스 ${choice.index+1}</span>${compact(estimates[choice.index])}<small>${choice.description}</small></button>`).join('')}</div></section>`;
    container.querySelectorAll('[data-budget-choice]').forEach(button=>button.onclick=()=>onSelect(Number(button.dataset.budgetChoice)));
  }
  window.HangeoreumBudgetUI={compact,status,mountSettings,mountDetails,mountComparison};
})();
