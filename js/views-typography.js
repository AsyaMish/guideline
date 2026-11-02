/* Раздел «Типографика» */

const TypoFilters = { open:false, queryShown:false, query:'', groups:{h:true,t:true,mp:true}, customOnly:false, presetOnly:false, filledOnly:false };

function renderTypography(project, params){
  const scr = h('<div class="screen"></div>');
  const s = project.sections;
  const version = project.activeVersion;

  // Первичные источники (сквозные)
  scr.appendChild(h(`<h2 class="sec">Первичные шрифты <span class="muted small">(сквозные)</span></h2>`));
  const primCard = h('<div class="card" style="padding:14px 16px"></div>');
  TYPO_PRIMARY_DEFAULTS.forEach(pd=>{
    const row = h('<div style="margin-bottom:10px"></div>');
    row.appendChild(h(`<div class="field" style="margin-bottom:4px"><label>${pd.label}</label></div>`));
    const selWrap = h('<div class="colorpick"></div>');
    const sel = h(`<select class="input"><option value="">— не выбран —</option></select>`);
    FONT_FAMILIES.forEach(f=>sel.appendChild(h(`<option value="${esc(f)}" ${s.typography.primary[pd.key].family===f?'selected':''}>${esc(f)}</option>`)));
    sel.onchange=()=>{ s.typography.primary[pd.key].family=sel.value; s.typography.primary[pd.key].updatedAt=nowISO(); Store.save(); App.render(); };
    selWrap.appendChild(sel);
    row.appendChild(selWrap);
    const wRow = h('<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap"></div>');
    wRow.appendChild(h(`<span class="muted small">Начертание по умолчанию:</span>`));
    WEIGHTS.forEach(w=>{
      const c=h(`<label class="chk"><input type="radio" name="pw-${pd.key}" ${s.typography.primary[pd.key].weight===w?'checked':''}>${w}</label>`);
      c.querySelector('input').onchange=()=>{ s.typography.primary[pd.key].weight=w; Store.save(); App.render(); };
      wRow.appendChild(c);
    });
    row.appendChild(wRow);
    primCard.appendChild(row);
  });
  scr.appendChild(primCard);

  // Поиск
  if(TypoFilters.queryShown){
    const sb=h(`<div class="searchbar" style="margin-top:16px">${ICONS.search}<input placeholder="Поиск по стилям"><button class="iconbtn" data-x="x">${ICONS.close}</button></div>`);
    const inp=sb.querySelector('input'); inp.value=TypoFilters.query;
    inp.oninput=()=>{TypoFilters.query=inp.value;App.rerenderList();};
    sb.querySelector('[data-x=x]').onclick=()=>{TypoFilters.queryShown=false;TypoFilters.query='';App.render();};
    setTimeout(()=>inp.focus(),10);
    scr.appendChild(sb);
  }

  // Группы
  TYPO_GROUPS.forEach(g=>{
    if(!TypoFilters.groups[g.key]) return;
    const items = s.typography.items.filter(t=>t.group===g.key).filter(t=>{
      const q=TypoFilters.query.trim().toLowerCase();
      if(q && !t.name.toLowerCase().includes(q)) return false;
      if(TypoFilters.customOnly && t.preset) return false;
      if(TypoFilters.presetOnly && !t.preset) return false;
      if(TypoFilters.filledOnly && !versionHasTypo(project,t,'desktop') && !versionHasTypo(project,t,'tablet') && !versionHasTypo(project,t,'mobile')) return false;
      return true;
    });
    scr.appendChild(h(`<h2 class="sec">${g.label}</h2>`));
    const card = h('<div class="card" id="typo-'+g.key+'"></div>');
    if(!items.length) card.appendChild(h(`<div class="empty-state">${ICONS.type}<div>Нет стилей. Нажмите «+» чтобы добавить.</div></div>`));
    items.forEach(t=>card.appendChild(typoItem(project, t, g, version)));
    // Кнопка добавить стиль в группу
    const addRow = h('<div style="padding:10px 16px"></div>');
    const addBtn = h(`<button class="link-add">${ICONS.plus} Добавить стиль (${g.prefix}-N)</button>`);
    addBtn.onclick=()=>{
      let i=1; while(s.typography.items.some(x=>x.group===g.key&&x.name===g.prefix+i)) i++;
      const t=makeTypoItem(g.key, g.prefix+i); t.preset=false; t.locked=false;
      s.typography.items.push(t); Store.save(); toast('Стиль добавлен'); App.render();
    };
    addRow.appendChild(addBtn);
    card.appendChild(addRow);
    scr.appendChild(card);

    // drag sort внутри группы
    setTimeout(()=>{
      const el=document.getElementById('typo-'+g.key);
      if(el) enableDragSort(el,(from,to)=>{
        const groupItems = s.typography.items.filter(t=>t.group===g.key);
        const moved = groupItems.splice(from,1)[0];
        groupItems.splice(to,0,moved);
        // пересборка общего массива с сохранением порядка других групп
        const others = s.typography.items.filter(t=>t.group!==g.key);
        let oi=0;
        s.typography.items = s.typography.items.map(t=> t.group===g.key ? groupItems.shift() : t);
        Store.save(); App.render();
      });
    },0);
  });

  return scr;
}

function typoItem(project, t, g, version){
  const wrap = h('<div class="item" data-tid="'+t.id+'"></div>');
  const e = effectiveTypo(project,t,version);
  const pvDesktop = t.perVersion.desktop||{};
  const head = h(`<div class="item-head">
    <span class="drag-handle" draggable="true" title="Перетащить">${ICONS.drag}</span>
    <div class="row-main"><div class="row-title">${esc(t.name)} ${t.preset?'<span class="pill">предустан.</span>':''}</div>
    <div class="row-sub">${esc(e.family||'шрифт не выбран')} · ${esc(e.weight||'')} ${e.size?('· '+e.size+'px'):''}${t.comment?' · '+esc(t.comment):''}</div></div>
    ${VERSIONS.some(v=>versionHasTypo(project,t,v))?`<span class="check-ok">${ICONS.checkCircle}</span>`:''}
    ${findBrokenLinks(project).some(b=>b.itemId===t.id)?`<span class="badge-broken">${ICONS.linkBroken}</span>`:''}
    <span class="chevron">${ICONS.chevron}</span>
  </div>`);
  wrap.appendChild(head);
  const body = h('<div class="item-body" style="display:none"></div>');
  head.onclick=e2=>{ if(e2.target.closest('.drag-handle'))return; wrap.classList.toggle('open'); body.style.display=wrap.classList.contains('open')?'block':'none'; };

  // Название
  body.appendChild(textField('Название', t.name, v=>{
    const nv=v.trim(); if(!nv){toast('Название пустое');App.render();return;}
    if(project.sections.typography.items.some(x=>x!==t&&x.name.toLowerCase()===nv.toLowerCase())){toast('Дубликат названия');App.render();return;}
    t.name=nv; t.updatedAt=nowISO(); Store.save(); App.render();
  }));

  // Шрифт: select из списка + ручное поле
  const famF = h('<div class="field"><label>Шрифт</label></div>');
  const chkManual = h(`<label class="chk" style="margin-bottom:6px"><input type="checkbox" ${t.shared.fontOverride?'checked':''}> Задать вручную для этого стиля</label>`);
  const manualInp = h(`<input class="input" placeholder="Название шрифта" value="${esc(t.shared.fontOverride||'')}">`);
  const sel = h(`<select class="input"><option value="">— из первичного источника —</option></select>`);
  FONT_FAMILIES.forEach(f=>sel.appendChild(h(`<option value="${esc(f)}" ${!t.shared.fontOverride && e.family===f?'selected':''}>${esc(f)}</option>`)));
  chkManual.querySelector('input').onchange=ev=>{
    if(ev.target.checked){ t.shared.fontOverride = manualInp.value.trim() || e.family || ''; }
    else { t.shared.fontOverride = null; }
    t.updatedAt=nowISO(); Store.save(); App.render();
  };
  manualInp.addEventListener('change',()=>{ t.shared.fontOverride=manualInp.value.trim()||null; t.updatedAt=nowISO(); Store.save(); });
  sel.onchange=()=>{ t.shared.fontOverride=null; /* выбор из списка тоже override: */ t.shared.fontOverride = sel.value||null; t.updatedAt=nowISO(); Store.save(); App.render(); };
  famF.appendChild(chkManual);
  famF.appendChild(t.shared.fontOverride?manualInp:sel);
  body.appendChild(famF);

  // Начертание (сквозное)
  const wF = h('<div class="field"><label>Начертание (сквозное)</label><div class="chips" style="gap:4px"></div></div>');
  const wChips = wF.querySelector('.chips');
  wChips.appendChild(makeWeightChip('—', !t.shared.weight, ()=>{t.shared.weight='';Store.save();App.render();}));
  WEIGHTS.forEach(w=>wChips.appendChild(makeWeightChip(w, t.shared.weight===w, ()=>{t.shared.weight=w;Store.save();App.render();})));
  body.appendChild(wF);

  // Цвет текста (ссылка)
  const colF = h('<div class="field"><label>Цвет текста</label></div>');
  colF.appendChild(linkSelect(project,'color', t.shared.colorRef, ref=>{ t.shared.colorRef=ref; t.updatedAt=nowISO(); Store.save(); App.render(); }, {brokenText:'цвет удалён'}));
  colF.appendChild(h(`<div class="hint">Если не выбран — используется цвет текста по умолчанию.</div>`));
  body.appendChild(colF);

  // Межстрочный и межбуквенное (сквозные единицы, значения по версиям)
  const lhF = unitNumField('Межстрочный интервал', versionValue(t,version,o=>o).lineHeight, t.shared.lineHeightUnit,
    v=>{ setVersionField(t,version,o=>o.lineHeight=v); Store.save(); },
    u=>{ t.shared.lineHeightUnit=u; t.updatedAt=nowISO(); Store.save(); App.render(); });
  body.appendChild(lhF);
  const lsF = unitNumField('Межбуквенное расстояние', versionValue(t,version,o=>o).letterSpacing, t.shared.letterSpacingUnit,
    v=>{ setVersionField(t,version,o=>o.letterSpacing=v); Store.save(); },
    u=>{ t.shared.letterSpacingUnit=u; t.updatedAt=nowISO(); Store.save(); App.render(); });
  body.appendChild(lsF);

  // Поля текущей версии
  if(version==='desktop'){
    body.appendChild(numField('Кегль (px)', t.perVersion.desktop.size, v=>{ setVersionField(t,'desktop',o=>o.size=v); Store.save(); }));
  }else{
    const inherit = !!t.perVersion[version].inherit;
    const block = h('<div class="state-block"></div>');
    block.appendChild(h(`<div class="state-head"><label class="chk"><input type="checkbox" ${inherit?'checked':''}> Наследовать от ${version==='tablet'?'десктопа':'планшета'}</label></div>`));
    block.querySelector('input').onchange=ev=>{
      if(ev.target.checked){ t.perVersion[version]={inherit:true}; }
      else { const parent=VERSIONS[VERSIONS.indexOf(version)-1]; t.perVersion[version]=Object.assign(deepClone(t.perVersion[parent]||{}),{inherit:false}); }
      t.updatedAt=nowISO(); Store.save(); App.render();
    };
    if(!inherit){
      block.appendChild(numField('Кегль (px)', t.perVersion[version].size, v=>{ setVersionField(t,version,o=>o.size=v); Store.save(); }));
    }
    const ff = fillFromParentButton(project, t, version, App.render);
    if(ff){ block.appendChild(h('<div style="margin-top:6px"></div>')); block.lastChild.appendChild(ff); }
    body.appendChild(block);
  }

  body.appendChild(commentField(t));

  const actions = h('<div class="modal-actions" style="justify-content:flex-start;margin-top:8px"></div>');
  const dup = h(`<button class="btn btn-sm">${ICONS.copy} Дублировать</button>`);
  dup.onclick=()=>{
    const nt = deepClone(t); nt.id=uid('ty'); nt.preset=false;
    let i=1; while(project.sections.typography.items.some(x=>x.name===nt.name)){ nt.name=t.name.replace(/(\d+)$/,(m)=>String(+m+1)); if(nt.name===t.name) nt.name=t.name+' '+(++i); break; }
    if(project.sections.typography.items.some(x=>x.name===nt.name)){ let n=2; while(project.sections.typography.items.some(x=>x.name===t.name.replace(/\s*\d*$/,'')+n)){n++;} nt.name=t.name.replace(/\s*\d*$/,'')+n; }
    nt.updatedAt=nowISO();
    const idx=project.sections.typography.items.indexOf(t);
    project.sections.typography.items.splice(idx+1,0,nt);
    Store.save(); toast('Стиль дублирован'); App.render();
  };
  actions.appendChild(dup);
  const del = h(`<button class="btn btn-sm btn-danger">${ICONS.trash} Удалить</button>`);
  del.onclick=async ()=>{
    const links=findLinksTo(project,'typo',t.id,t.name);
    const ok=await confirmDeleteWithLinks(t.name,links);
    if(!ok)return;
    breakLinksTo(project,'typo',t.id);
    project.sections.typography.items.splice(project.sections.typography.items.indexOf(t),1);
    Store.save(); toast('Стиль удалён'); App.render();
  };
  actions.appendChild(del);
  body.appendChild(actions);

  wrap.appendChild(body);
  return wrap;
}

function makeWeightChip(label, on, onclick){
  const b=h(`<button class="chip ${on?'on':''}" style="padding:5px 10px;font-size:12px">${esc(label)}</button>`);
  b.onclick=onclick; return b;
}

/* Фильтры раздела */
function typographyFilterPanel(){
  const fp=h(`<div class="card filters-panel"><h3>Фильтры <button class="iconbtn" data-x="close">${ICONS.close}</button></h3></div>`);
  fp.querySelector('[data-x=close]').onclick=()=>{App.state.filtersOpen=false;App.render();};
  const g=h('<div class="filter-group"><label>Группы</label><div class="chips"></div></div>');
  TYPO_GROUPS.forEach(gr=>{
    const c=h(`<button class="chip ${TypoFilters.groups[gr.key]?'on':''}">${gr.label}</button>`);
    c.onclick=()=>{TypoFilters.groups[gr.key]=!TypoFilters.groups[gr.key];App.render();};
    g.querySelector('.chips').appendChild(c);
  });
  fp.appendChild(g);
  const chips=h('<div class="chips"></div>');
  [['customOnly','Только мои'],['presetOnly','Только предустановленные'],['filledOnly','Заполненные']].forEach(([k,l])=>{
    const c=h(`<button class="chip ${TypoFilters[k]?'on':''}">${l}</button>`);
    c.onclick=()=>{TypoFilters[k]=!TypoFilters[k];App.render();};
    chips.appendChild(c);
  });
  fp.appendChild(chips);
  return fp;
}
