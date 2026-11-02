/* Переиспользуемые UI-компоненты */

/* ===== Сегментный переключатель версий ===== */
function versionSwitcher(project, onChange){
  const wrap = h(`<div class="seg"></div>`);
  VERSIONS.forEach(v=>{
    const b = h(`<button class="${project.activeVersion===v?'on':''}">${VERSION_LABELS[v]}</button>`);
    b.onclick = ()=>{ project.activeVersion=v; Store.save(); onChange&&onChange(v); };
    wrap.appendChild(b);
  });
  return wrap;
}

/* ===== Кнопка «Заполнить данными с…» ===== */
function fillFromParentButton(project, obj, version, renderFn){
  if(version==='desktop') return null;
  const label = version==='tablet' ? 'Заполнить данными с десктопа' : 'Заполнить данными с планшета';
  const btn = h(`<button class="btn btn-sm">${ICONS.download}${label}</button>`);
  btn.onclick = async ()=>{
    const ok = await confirmDialog({title:label, text:'Текущие значения этой версии будут заменены, ручные правки сброшены, связи восстановлены.', okLabel:'Заполнить'});
    if(!ok) return;
    fillFromParentVersion(obj, version);
    Store.save(); renderFn(); toast('Заполнено');
  };
  return btn;
}

/* ===== Кружок цвета ===== */
function swatchEl(hex, big){
  const el = h(`<span class="swatch ${big?'big':''} ${hex?'':'empty'}"></span>`);
  if(hex) el.style.background = hex;
  return el;
}

/* ===== Выпадающий список выбора с ссылкой + переход «Добавить» ===== 
   kind: 'color'|'typo'|'radius'|'shadow' ; value — текущий ref (uuid или magic)
   onChange(refOrNull) ; allowAdd — показывать ли кнопку добавления (переход в раздел)
*/
function linkSelect(project, kind, value, onChange, opts={}){
  const wrap = h('<div class="colorpick"></div>');
  const sel = h(`<select class="input"></select>`);
  let options = [];
  let brokenCurrent = false;
  if(kind==='color'){
    options = colorOptions(project).map(c=>({id:c.id,label:c.name+(c.hex?' · '+c.hex:'')}));
  }else if(kind==='typo'){
    options = typoOptions(project).map(t=>{
      const g=TYPO_GROUPS.find(x=>x.key===t.group);
      return {id:t.id,label:(g?g.prefix+'-группа: ':'')+t.name};
    });
  }else if(kind==='radius'){
    options = radiusOptions(project).map(r=>({id:r.id,label:r.name}));
  }else if(kind==='shadow'){
    options = shadowOptions(project).map(s=>({id:s.id,label:s.name}));
  }
  sel.appendChild(h(`<option value="">— не выбрано —</option>`));
  options.forEach(o=>sel.appendChild(h(`<option value="${o.id}" ${o.id===value?'selected':''}>${esc(o.label)}</option>`)));
  // если текущее значение — magic-ref, отображаем resolved имя
  if(value && String(value).startsWith('auto-')){
    const resolved = kind==='radius'?resolveRadiusRef(project,value):resolveShadowRef(project,value);
    if(resolved){
      const op = h(`<option value="${value}" selected>${esc(resolved.name)} (связь по умолчанию)</option>`);
      sel.insertBefore(op, sel.children[1]);
    } else brokenCurrent = true;
  } else if(value && !options.some(o=>o.id===value)){
    brokenCurrent = true;
  }
  if(brokenCurrent){
    sel.appendChild(h(`<option value="${value}" selected>⚠ ${esc(opts.brokenText||'связь разорвана — объект удалён')}</option>`));
  }
  sel.onchange = ()=>{ onChange(sel.value||null); };
  wrap.appendChild(sel);

  if(brokenCurrent){
    wrap.appendChild(h(`<span class="badge-broken" title="Связь разорвана">${ICONS.linkBroken}</span>`));
  }
  if(opts.allowAdd!==false){
    const addBtn = h(`<button class="link-add" title="Добавить новое значение">${ICONS.plus}</button>`);
    addBtn.onclick = ()=> App.gotoCreateLinked(kind);
    wrap.appendChild(addBtn);
  }
  return wrap;
}

/* Числовое поле с px */
function numField(label, value, onCommit, opts={}){
  const f = h(`<div class="field"><label>${esc(label)}${opts.unit?' ('+opts.unit+')':''}</label><input class="input" inputmode="decimal" placeholder="${opts.placeholder||''}"></div>`);
  const inp = f.querySelector('input');
  inp.value = value||'';
  inp.addEventListener('change', ()=>{
    let v = inp.value.trim();
    if(v!==''){
      const n = parseFloat(v.replace(',','.'));
      if(isNaN(n)){ toast('Введите число'); inp.value=value||''; return; }
      v = String(n);
    }
    onCommit(v);
  });
  return f;
}

/* Текстовое поле с коммитом по change/blur (без перерисовки на каждый символ) */
function textField(label, value, onCommit, opts={}){
  const f = h(`<div class="field"><label>${esc(label)}</label></div>`);
  const inp = h(opts.multiline?`<textarea class="input" placeholder="${esc(opts.placeholder||'')}"></textarea>`:`<input class="input" placeholder="${esc(opts.placeholder||'')}">`);
  inp.value = value||'';
  inp.addEventListener('change', ()=> onCommit(inp.value));
  inp.addEventListener('blur', ()=>{ if(inp.value!==(value||'')) onCommit(inp.value); });
  f.appendChild(inp);
  return f;
}

/* Поле комментария */
function commentField(obj, renderFn){
  return textField('Комментарий', obj.comment||'', v=>{ obj.comment=v; Store.save(); }, {multiline:true, placeholder:'Комментарий к элементу'});
}

/* Переключатель % ↔ коэффициент */
function unitToggle(current, onToggle){
  const b = h(`<button class="btn btn-sm" style="min-width:56px">${current==='%'?'%':'×'}</button>`);
  b.title='Переключить % / коэффициент';
  b.onclick=()=>onToggle(current==='%'?'ratio':'%');
  return b;
}

/* Числовое поле с переключателем единиц */
function unitNumField(label, value, unit, onValue, onUnit){
  const f = h(`<div class="field"><label>${esc(label)}</label><div style="display:flex;gap:8px;"><input class="input" inputmode="decimal" style="flex:1"><span data-u></span></div></div>`);
  const inp = f.querySelector('input');
  inp.value = value||'';
  inp.addEventListener('change', ()=>{
    let v=inp.value.trim();
    if(v!==''){ const n=parseFloat(v.replace(',','.')); if(isNaN(n)){toast('Введите число');inp.value=value||'';return;} v=String(n);}
    onValue(v);
  });
  const uSlot=f.querySelector('[data-u]');
  uSlot.appendChild(unitToggle(unit, onUnit));
  return f;
}

/* Индикаторы раздела (галочка / разорванная цепь) */
function sectionIndicators(project, sectionId, version){
  const wrap = document.createElement('span');
  wrap.style.display='inline-flex'; wrap.style.gap='6px'; wrap.style.alignItems='center';
  if(sectionHasData(project, sectionId, version)){
    wrap.appendChild(h(`<span class="check-ok" title="Есть данные">${ICONS.checkCircle}</span>`));
  }
  const broken = sectionBrokenLinks(project).filter(b=>true);
  if(broken.length){
    wrap.appendChild(h(`<span class="badge-broken" title="Есть разорванные связи">${ICONS.linkBroken}</span>`));
  }
  return wrap;
}

/* ===== Нижняя панель ===== */
function bottomBar({left, center, right, leftTitle, rightTitle}){
  const bar = h('<div class="bottombar"></div>');
  const l = h(`<button class="iconbtn ${left?'':'disabled'}">${ICONS.left}</button>`);
  if(left) l.onclick=left;
  bar.appendChild(l);

  const mid = document.createElement('div');
  mid.style.display='flex'; mid.style.alignItems='center'; mid.style.gap='14px';
  const flt = h(`<button class="iconbtn ${App.state.filtersOpen?'active':''}" title="Фильтры">${ICONS.filter}</button>`);
  flt.onclick = ()=> App.toggleFilters();
  mid.appendChild(flt);
  if(center) mid.appendChild(center);
  bar.appendChild(mid);

  const r = h(`<button class="iconbtn ${right?'':'disabled'}">${ICONS.right}</button>`);
  if(right) r.onclick=right;
  bar.appendChild(r);
  return bar;
}

/* ===== Верхняя панель ===== */
function topBar(title, opts={}){
  const bar = h(`<div class="topbar"></div>`);
  if(opts.back){
    const b = h(`<button class="iconbtn" title="Назад">${ICONS.left}</button>`);
    b.onclick = opts.back;
    bar.appendChild(b);
  }
  bar.appendChild(h(`<h1>${esc(title)}</h1>`));
  bar.appendChild(h('<div class="spacer"></div>'));
  if(opts.settings!==false){
    const s = h(`<button class="iconbtn" title="Настройки">${ICONS.gear}</button>`);
    s.onclick = ()=> App.navigate('settings');
    bar.appendChild(s);
  }
  return bar;
}

/* ===== Подтверждение удаления с учётом связей (п. 4.1) ===== */
/* links — массив [{label, goto:fn}] активных связей на удаляемый объект */
async function confirmDeleteWithLinks(itemName, links){
  if(!links || !links.length){
    return confirmDialog({title:'Удалить?', text:itemName, danger:true, okLabel:'Удалить'});
  }
  return new Promise(resolve=>{
    const m = h(`<div class="modal"><h3>Нарушаются связи</h3>
      <div class="muted small">«${esc(itemName)}» используется в ${links.length} месте(ах):</div>
      <ul class="broken-list"></ul>
      <div class="modal-actions">
        <button class="btn" data-x="no">Отмена</button>
        <button class="btn btn-danger" data-x="ok">Удалить и разорвать связи</button>
      </div></div>`);
    const ul = m.querySelector('ul');
    links.slice(0,30).forEach(lk=>{
      const li = document.createElement('li');
      const btn = h(`<button class="broken-link">${ICONS.linkBroken}${esc(lk.label)}</button>`);
      btn.onclick=()=>{ closeModal(); lk.goto&&lk.goto(); resolve(false); };
      li.appendChild(btn); ul.appendChild(li);
    });
    if(links.length>30) ul.appendChild(h(`<li class="muted small">…и ещё ${links.length-30}</li>`));
    m.querySelector('[data-x=no]').onclick=()=>{closeModal();resolve(false);};
    m.querySelector('[data-x=ok]').onclick=()=>{closeModal();resolve(true);};
    openModal(m);
  });
}

/* Найти все ссылки проекта на объект данного типа/ id — для confirmDeleteWithLinks */
function findLinksTo(project, kind, id, name){
  const out=[];
  const s=project.sections;
  const where=(sectionId,itemId,itemLabel,fieldLabel)=>out.push({
    label:`${secTitle(sectionId)}: ${itemLabel} — ${fieldLabel}`,
    goto:()=>App.navigate('section',{projectId:project.id, sectionId, focusItem:itemId})
  });
  if(kind==='color'){
    s.typography.items.forEach(t=>{ if(t.shared.colorRef===id) where('typography',t.id,t.name,'Цвет текста'); });
    s.buttons.forEach(b=>{
      allButtonStates(b).forEach(st=>{
        if(st.bgRef===id) where('buttons',b.id,`${buttonStyleLabel(b.style)} ${b.size}`,`Фон (${st.label})`);
        if(st.textColorRef===id) where('buttons',b.id,`${buttonStyleLabel(b.style)} ${b.size}`,`Цвет текста (${st.label})`);
        if(st.borderColorRef===id) where('buttons',b.id,`${buttonStyleLabel(b.style)} ${b.size}`,`Обводка (${st.label})`);
      });
    });
    s.inputs.forEach(f=>{
      allInputStates(f).forEach(st=>{
        if(st.bgRef===id) where('inputs',f.id,`Поле ${f.size}`,`Фон (${st.label})`);
        if(st.textColorRef===id) where('inputs',f.id,`Поле ${f.size}`,`Цвет текста (${st.label})`);
        if(st.phColorRef===id) where('inputs',f.id,`Поле ${f.size}`,`Цвет плейсхолдера (${st.label})`);
        if(st.borderColorRef===id) where('inputs',f.id,`Поле ${f.size}`,`Обводка (${st.label})`);
      });
      if(f.shared.labelColorRef===id) where('inputs',f.id,`Поле ${f.size}`,'Цвет label');
    });
    s.shadows.forEach(sh=>sh.layers.forEach((l,i)=>{ if(l.colorRef===id) where('shadows',sh.id,sh.name,`Слой ${i+1}: цвет`); }));
  }
  if(kind==='typo'){
    s.buttons.forEach(b=>{
      if(b.shared.typoRef===id) where('buttons',b.id,`${buttonStyleLabel(b.style)} ${b.size}`,'Типографика');
      allButtonStates(b).forEach(st=>{ if(st.typoRef===id) where('buttons',b.id,`${buttonStyleLabel(b.style)} ${b.size}`,`Текст (${st.label})`); });
    });
    s.inputs.forEach(f=>{
      if(f.shared.labelTypoRef===id) where('inputs',f.id,`Поле ${f.size}`,'Label');
      allInputStates(f).forEach(st=>{
        if(st.textTypoRef===id) where('inputs',f.id,`Поле ${f.size}`,`Текст (${st.label})`);
        if(st.phTypoRef===id) where('inputs',f.id,`Поле ${f.size}`,`Плейсхолдер (${st.label})`);
      });
    });
  }
  if(kind==='radius'){
    s.buttons.forEach(b=>{
      if(matchAuto(b.shared.radiusRef,'radius',project,id)) where('buttons',b.id,`${buttonStyleLabel(b.style)} ${b.size}`,'Скругление');
      VERSIONS.forEach(v=>{ if(matchAuto(b.perVersion[v]?.radiusOverride,'radius',project,id)) where('buttons',b.id,`${buttonStyleLabel(b.style)} ${b.size}`,`Скругление (${VERSION_LABELS[v]})`); });
    });
    s.inputs.forEach(f=>{
      VERSIONS.forEach(v=>{ if(matchAuto(f.perVersion[v]?.radiusRef,'radius',project,id)) where('inputs',f.id,`Поле ${f.size}`,`Скругление (${VERSION_LABELS[v]})`); });
    });
  }
  if(kind==='shadow'){
    s.buttons.forEach(b=>{
      if(matchAuto(b.shared.shadowRef,'shadow',project,id)) where('buttons',b.id,`${buttonStyleLabel(b.style)} ${b.size}`,'Тень');
      VERSIONS.forEach(v=>{ if(matchAuto(b.perVersion[v]?.shadowOverride,'shadow',project,id)) where('buttons',b.id,`${buttonStyleLabel(b.style)} ${b.size}`,`Тень (${VERSION_LABELS[v]})`); });
    });
    s.inputs.forEach(f=>{
      VERSIONS.forEach(v=>{ if(matchAuto(f.perVersion[v]?.shadowRef,'shadow',project,id)) where('inputs',f.id,`Поле ${f.size}`,`Тень (${VERSION_LABELS[v]})`); });
    });
  }
  return out;
}
function matchAuto(ref, kind, project, id){
  if(!ref) return false;
  if(ref===id) return true;
  if(String(ref).startsWith('auto-')){
    const r = kind==='radius'?resolveRadiusRef(project,ref):resolveShadowRef(project,ref);
    return r && r.id===id;
  }
  return false;
}
function secTitle(sectionId){ const s=SECTIONS.find(x=>x.id===sectionId); return s?s.title:sectionId; }

/* Разорвать все ссылки на удалённый объект (в местах остаются «битые» метки) */
function breakLinksTo(project, kind, id){
  const s=project.sections;
  const clearIf = (obj,key)=>{ if(obj[key]===id) obj[key]='__deleted__:'+id; };
  if(kind==='color'){
    s.typography.items.forEach(t=>clearIf(t.shared,'colorRef'));
    s.buttons.forEach(b=>allButtonStates(b).forEach(st=>{clearIf(st,'bgRef');clearIf(st,'textColorRef');clearIf(st,'borderColorRef');}));
    s.inputs.forEach(f=>{clearIf(f.shared,'labelColorRef');allInputStates(f).forEach(st=>{clearIf(st,'bgRef');clearIf(st,'textColorRef');clearIf(st,'phColorRef');clearIf(st,'borderColorRef');});});
    s.shadows.forEach(sh=>sh.layers.forEach(l=>clearIf(l,'colorRef')));
  }else if(kind==='typo'){
    s.buttons.forEach(b=>{clearIf(b.shared,'typoRef');allButtonStates(b).forEach(st=>clearIf(st,'typoRef'));});
    s.inputs.forEach(f=>{clearIf(f.shared,'labelTypoRef');allInputStates(f).forEach(st=>{clearIf(st,'textTypoRef');clearIf(st,'phTypoRef');});});
  }else if(kind==='radius'||kind==='shadow'){
    const isR = kind==='radius';
    s.buttons.forEach(b=>{
      if(isR){ if(matchAuto(b.shared.radiusRef,kind,project,id)) b.shared.radiusRef='__deleted__:'+id;
        VERSIONS.forEach(v=>{const pv=b.perVersion[v]; if(pv&&!pv.inherit&&matchAuto(pv.radiusOverride,kind,project,id)) pv.radiusOverride='__deleted__:'+id;});
      }else{
        if(matchAuto(b.shared.shadowRef,kind,project,id)) b.shared.shadowRef='__deleted__:'+id;
        VERSIONS.forEach(v=>{const pv=b.perVersion[v]; if(pv&&!pv.inherit&&matchAuto(pv.shadowOverride,kind,project,id)) pv.shadowOverride='__deleted__:'+id;});
      }
    });
    if(!isR){
      s.inputs.forEach(f=>VERSIONS.forEach(v=>{const pv=f.perVersion[v]; if(pv&&matchAuto(pv.shadowRef,kind,project,id)) pv.shadowRef='__deleted__:'+id;}));
    }else{
      s.inputs.forEach(f=>VERSIONS.forEach(v=>{const pv=f.perVersion[v]; if(pv&&matchAuto(pv.radiusRef,kind,project,id)) pv.radiusRef='__deleted__:'+id;}));
    }
  }
  Store.save();
}

/* Проверка refs вида __deleted__:id тоже ловится findBrokenLinks (ref не найден среди id) */
