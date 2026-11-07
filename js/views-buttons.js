/* Раздел «Кнопки» */

const BtnFilters = { open:false, queryShown:false, query:'', styles:{fill:true,outline:true}, sizes:{}, filledOnly:false };

function renderButtons(project, params){
  const scr = h('<div class="screen"></div>');
  const s = project.sections;
  const version = project.activeVersion;

  if(BtnFilters.queryShown){
    const sb=h(`<div class="searchbar">${ICONS.search}<input placeholder="Поиск"><button class="iconbtn" data-x="x">${ICONS.close}</button></div>`);
    const inp=sb.querySelector('input'); inp.value=BtnFilters.query;
    inp.oninput=()=>{BtnFilters.query=inp.value;App.rerenderList();};
    sb.querySelector('[data-x=x]').onclick=()=>{BtnFilters.queryShown=false;BtnFilters.query='';App.render();};
    setTimeout(()=>inp.focus(),10);
    scr.appendChild(sb);
  }

  BUTTON_STYLES.forEach(st=>{
    if(!BtnFilters.styles[st.key]) return;
    const cells = s.buttons.filter(b=>b.style===st.key).sort((a,b)=>BUTTON_SIZE_ORDER.indexOf(a.size)-BUTTON_SIZE_ORDER.indexOf(b.size))
      .filter(b=>{
        const q=BtnFilters.query.trim().toLowerCase();
        if(q && !(b.size+' '+b.comment).toLowerCase().includes(q)) return false;
        if(BtnFilters.filledOnly && !versionHasButton(project,b,'desktop')&&!versionHasButton(project,b,'tablet')&&!versionHasButton(project,b,'mobile')) return false;
        return true;
      });
    scr.appendChild(h(`<h2 class="sec">Стиль: ${st.label}</h2>`));
    const card=h('<div class="card"></div>');
    if(!cells.length) card.appendChild(h(`<div class="empty-state">${ICONS.buttonUI}<div>Нет ячеек. Добавьте размер кнопкой ниже.</div></div>`));
    cells.forEach(b=>card.appendChild(buttonCell(project,b,st,version)));
    const addRow=h('<div style="padding:10px 16px;display:flex;gap:8px;flex-wrap:wrap;align-items:center"></div>');
    const selSize=h(`<select class="input" style="width:auto"><option value="">Размер…</option>${BUTTON_SIZE_ORDER.map(x=>`<option>${x}</option>`).join('')}</select>`);
    const addBtn=h(`<button class="link-add">${ICONS.plus} Добавить размер</button>`);
    addBtn.onclick=()=>{
      const sz=selSize.value; if(!sz){toast('Выберите размер');return;}
      if(s.buttons.some(b=>b.style===st.key&&b.size===sz)){toast('Такой размер уже есть');return;}
      s.buttons.push(makeButtonCell(st.key,sz)); Store.save(); toast('Ячейка добавлена'); App.render();
    };
    addRow.appendChild(selSize); addRow.appendChild(addBtn);
    card.appendChild(addRow);
    scr.appendChild(card);
  });
  return scr;
}

function buttonCell(project, b, st, version){
  const wrap=h('<div class="item" data-bid="'+b.id+'"></div>');
  const head=h(`<div class="item-head">
    <span class="drag-handle" draggable="true" title="Перетащить">${ICONS.drag}</span>
    <div class="row-main"><div class="row-title">${esc(st.label)} ${esc(b.size)}</div>
      <div class="row-sub">${esc(buttonSummary(project,b))||'<span class="muted">не заполнено</span>'}</div></div>
    ${VERSIONS.some(v=>versionHasButton(project,b,v))?`<span class="check-ok">${ICONS.checkCircle}</span>`:''}
    ${findBrokenLinks(project).some(x=>x.itemId===b.id)?`<span class="badge-broken">${ICONS.linkBroken}</span>`:''}
    <span class="chevron">${ICONS.chevron}</span></div>`);
  wrap.appendChild(head);
  const body=h('<div class="item-body" style="display:none"></div>');
  restoreItemOpen('btn'+b.id, wrap, body);
  head.onclick=e=>{if(e.target.closest('.drag-handle'))return; itemToggleHandler('btn'+b.id, wrap, body)(e);};

  // Размер (редактируемый)
  body.appendChild(textField('Размер', b.size, v=>{
    const nv=v.trim().toUpperCase(); if(!nv){toast('Пустой размер');App.render();return;}
    if(project.sections.buttons.some(x=>x!==b&&x.style===b.style&&x.size===nv)){toast('Дубликат в этом стиле');App.render();return;}
    b.size=nv;b.updatedAt=nowISO();Store.save();App.render();
  }));

  // Типографика ячейки (сквозная ссылка)
  const typoF=h('<div class="field"><label>Типографика ячейки (обычное состояние)</label></div>');
  typoF.appendChild(linkSelect(project,'typo',b.shared.typoRef,ref=>{b.shared.typoRef=ref;b.updatedAt=nowISO();Store.save();App.render();},{brokenText:'стиль удалён'}));
  typoF.appendChild(h('<div class="hint">Для других состояний типографику можно задать отдельно внутри состояния.</div>'));
  body.appendChild(typoF);

  // Состояния
  body.appendChild(h('<h2 class="sec" style="margin-top:8px">Состояния</h2>'));
  allButtonStates(b).forEach(sp=>body.appendChild(stateBlock(project,b,sp,version)));

  // Добавить своё состояние
  const addState=h('<div style="padding:6px 0"></div>');
  const asBtn=h(`<button class="link-add">${ICONS.plus} Добавить своё состояние</button>`);
  asBtn.onclick=()=>{
    const name=prompt('Название состояния','Pressed');
    if(!name||!name.trim())return;
    b.customStates.push({id:uid('st'),label:name.trim(),locked:false,bgRef:null,textColorRef:null,borderColorRef:null,borderWidth:'',typoRef:null});
    Store.save();App.render();
  };
  addState.appendChild(asBtn); body.appendChild(addState);

  // Геометрия по версии
  body.appendChild(h('<h2 class="sec">Геометрия ('+VERSION_LABELS[version]+')</h2>'));
  const pv=b.perVersion[version];
  if(version!=='desktop'){
    const block=h('<div class="state-block"></div>');
    const inherit=!!pv.inherit;
    block.appendChild(h(`<div class="state-head"><label class="chk"><input type="checkbox" ${inherit?'checked':''}> Наследовать от ${version==='tablet'?'десктопа':'планшета'}</label></div>`));
    block.querySelector('input').onchange=ev=>{
      if(ev.target.checked){ b.perVersion[version]={inherit:true}; }
      else{ const parent=VERSIONS[VERSIONS.indexOf(version)-1]; b.perVersion[version]=Object.assign(deepClone(b.perVersion[parent]||{}),{inherit:false}); }
      Store.save();App.render();
    };
    if(!inherit){
      block.appendChild(numField('Высота кнопки', pv.height, v=>{setVersionField(b,version,o=>o.height=v);Store.save();App.render();}));
      const g=h('<div class="grid-2"></div>');
      g.appendChild(numField('Внутр. отступы сверху/снизу', pv.padV, v=>{setVersionField(b,version,o=>o.padV=v);Store.save();App.render();}));
      g.appendChild(numField('Внутр. отступы слева/справа', pv.padH, v=>{setVersionField(b,version,o=>o.padH=v);Store.save();App.render();}));
      block.appendChild(g);
      block.appendChild(radiusOverrideField(project,b,version,pv));
      block.appendChild(shadowOverrideField(project,b,version,pv));
    }
    const ff=fillFromParentButton(project,b,version,App.render);
    if(ff) block.appendChild(ff);
    body.appendChild(block);
  }else{
    body.appendChild(numField('Высота кнопки', pv.height, v=>{setVersionField(b,'desktop',o=>o.height=v);Store.save();App.render();}));
    const g=h('<div class="grid-2"></div>');
    g.appendChild(numField('Внутр. отступы сверху/снизу', pv.padV, v=>{setVersionField(b,'desktop',o=>o.padV=v);Store.save();App.render();}));
    g.appendChild(numField('Внутр. отступы слева/справа', pv.padH, v=>{setVersionField(b,'desktop',o=>o.padH=v);Store.save();App.render();}));
    body.appendChild(g);
    body.appendChild(radiusOverrideField(project,b,version,pv));
    body.appendChild(shadowOverrideField(project,b,version,pv));
  }

  // Сквозные ссылки скругления/тени
  const radF=h('<div class="field"><label>Скругление (по умолчанию для всех версий)</label></div>');
  radF.appendChild(linkSelect(project,'radius',b.shared.radiusRef,ref=>{b.shared.radiusRef=ref;Store.save();App.render();},{brokenText:'скругление удалено'}));
  body.appendChild(radF);
  const shF=h('<div class="field"><label>Тень (по умолчанию для всех версий)</label></div>');
  shF.appendChild(linkSelect(project,'shadow',b.shared.shadowRef,ref=>{b.shared.shadowRef=ref;Store.save();App.render();},{brokenText:'тень удалена'}));
  body.appendChild(shF);

  body.appendChild(commentField(b));

  const actions=h('<div class="modal-actions" style="justify-content:flex-start;margin-top:8px"></div>');
  const dup=h(`<button class="btn btn-sm">${ICONS.copy} Дублировать ячейку</button>`);
  dup.onclick=()=>{
    const nb=deepClone(b); nb.id=uid('btn'); nb.size=b.size+' копия'; nb.updatedAt=nowISO();
    project.sections.buttons.splice(project.sections.buttons.indexOf(b)+1,0,nb);
    Store.save(); toast('Ячейка дублирована'); App.render();
  };
  actions.appendChild(dup);
  const del=h(`<button class="btn btn-sm btn-danger">${ICONS.trash} Удалить ячейку</button>`);
  del.onclick=async ()=>{
    const ok=await confirmDialog({title:'Удалить ячейку?',text:`${buttonStyleLabel(b.style)} ${b.size}`,danger:true,okLabel:'Удалить'});
    if(!ok)return;
    project.sections.buttons.splice(project.sections.buttons.indexOf(b),1);
    Store.save(); toast('Ячейка удалена'); App.render();
  };
  actions.appendChild(del);
  body.appendChild(actions);

  wrap.appendChild(body);
  return wrap;
}

function radiusOverrideField(project,b,version,pv){
  const f=h('<div class="field"><label>Переопределение скругления для '+VERSION_LABELS[version]+'</label></div>');
  f.appendChild(linkSelect(project,'radius',pv.radiusOverride||null,ref=>{setVersionField(b,version,o=>o.radiusOverride=ref);Store.save();App.render();},{brokenText:'скругление удалено'}));
  f.appendChild(h('<div class="hint">Если не задано — используется сквозное значение выше.</div>'));
  return f;
}
function shadowOverrideField(project,b,version,pv){
  const f=h('<div class="field"><label>Переопределение тени для '+VERSION_LABELS[version]+'</label></div>');
  f.appendChild(linkSelect(project,'shadow',pv.shadowOverride||null,ref=>{setVersionField(b,version,o=>o.shadowOverride=ref);Store.save();App.render();},{brokenText:'тень удалена'}));
  f.appendChild(h('<div class="hint">Если не задано — используется сквозное значение выше.</div>'));
  return f;
}

function stateBlock(project,b,sp,version){
  const block=h('<div class="state-block"></div>');
  const head=h(`<div class="state-head"></div>`);
  head.appendChild(h(`<span>${esc(sp.label)}</span>`));
  if(sp.locked) head.appendChild(h('<span class="pill">предустан.</span>'));
  const dot=h('<span class="dot-sep"></span>'); block.appendChild(head);
  if(!sp.locked){
    const rm=h(`<button class="iconbtn" title="Удалить состояние" style="min-width:32px;height:32px">${ICONS.trash}</button>`);
    rm.onclick=()=>{ b.customStates=(b.customStates||[]).filter(x=>x.id!==sp.id); Store.save(); App.render(); };
    head.appendChild(rm);
  }

  // Фон (ссылка на цвет)
  const bgF=h('<div class="field"><label>Фон</label></div>');
  bgF.appendChild(linkSelect(project,'color',sp.bgRef,ref=>{sp.bgRef=ref;sp.updatedAt=nowISO();b.updatedAt=nowISO();Store.save();App.render();},{brokenText:'цвет удалён'}));
  block.appendChild(bgF);

  // Обводка (для обоих стилей)
  const brF=h('<div class="field"><label>Обводка: цвет</label></div>');
  brF.appendChild(linkSelect(project,'color',sp.borderColorRef,ref=>{sp.borderColorRef=ref;Store.save();App.render();},{brokenText:'цвет удалён'}));
  block.appendChild(brF);
  block.appendChild(numField('Толщина обводки (px)', sp.borderWidth, v=>{sp.borderWidth=v;Store.save();App.render();}));

  // Текст: ссылка на стиль + переопределение цвета
  const txF=h('<div class="field"><label>Типографика текста (переопределение)</label></div>');
  txF.appendChild(linkSelect(project,'typo',sp.typoRef,ref=>{sp.typoRef=ref;Store.save();App.render();},{brokenText:'стиль удалён'}));
  txF.appendChild(h('<div class="hint">Если не выбрано — используется типографика ячейки.</div>'));
  block.appendChild(txF);
  const tcF=h('<div class="field"><label>Цвет текста (поверх типографики)</label></div>');
  tcF.appendChild(linkSelect(project,'color',sp.textColorRef,ref=>{sp.textColorRef=ref;Store.save();App.render();},{brokenText:'цвет удалён'}));
  block.appendChild(tcF);

  return block;
}

function buttonsFilterPanel(){
  const fp=h(`<div class="card filters-panel"><h3>Фильтры <button class="iconbtn" data-x="close">${ICONS.close}</button></h3></div>`);
  fp.querySelector('[data-x=close]').onclick=()=>{App.state.filtersOpen=false;App.render();};
  const g=h('<div class="filter-group"><label>Стили</label><div class="chips"></div></div>');
  BUTTON_STYLES.forEach(st=>{
    const c=h(`<button class="chip ${BtnFilters.styles[st.key]?'on':''}">${st.label}</button>`);
    c.onclick=()=>{BtnFilters.styles[st.key]=!BtnFilters.styles[st.key];App.render();};
    g.querySelector('.chips').appendChild(c);
  });
  fp.appendChild(g);
  const chips=h('<div class="chips"></div>');
  [['filledOnly','Заполненные']].forEach(([k,l])=>{
    const c=h(`<button class="chip ${BtnFilters[k]?'on':''}">${l}</button>`);
    c.onclick=()=>{BtnFilters[k]=!BtnFilters[k];App.render();};
    chips.appendChild(c);
  });
  fp.appendChild(chips);
  return fp;
}
