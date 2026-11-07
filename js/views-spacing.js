/* Раздел «Отступы и сетка» */

const SpacingFilters = { open:false, queryShown:false, query:'', filledOnly:false, customOnly:false };

function renderSpacing(project, params){
  const scr=h('<div class="screen"></div>');
  const s=project.sections;
  const version=project.activeVersion;

  if(params.focusItem==='grid'){ /* скролл к сетке после рендера */ }

  if(SpacingFilters.queryShown){
    const sb=h(`<div class="searchbar">${ICONS.search}<input placeholder="Поиск"><button class="iconbtn" data-x="x">${ICONS.close}</button></div>`);
    const inp=sb.querySelector('input'); inp.value=SpacingFilters.query;
    inp.oninput=()=>{SpacingFilters.query=inp.value;App.rerenderList();};
    sb.querySelector('[data-x=x]').onclick=()=>{SpacingFilters.queryShown=false;SpacingFilters.query='';App.render();};
    setTimeout(()=>inp.focus(),10);
    scr.appendChild(sb);
  }

  // Табы: Отступы / Сетка
  if(App.state.spacingTab!=='grid' && App.state.spacingTab!=='items') App.state.spacingTab='items';
  const tabs=h('<div class="tabbar no-print"></div>');
  const t1=h(`<button class="${App.state.spacingTab==='items'?'on':''}">Отступы</button>`);
  const t2=h(`<button class="${App.state.spacingTab==='grid'?'on':''}">Сетка</button>`);
  t1.onclick=()=>{App.state.spacingTab='items';App.render();};
  t2.onclick=()=>{App.state.spacingTab='grid';App.render();};
  tabs.appendChild(t1);tabs.appendChild(t2);
  scr.appendChild(tabs);

  if(App.state.spacingTab==='items'){
    let items=s.spacing.items.filter(sp=>{
      const q=SpacingFilters.query.trim().toLowerCase();
      if(q && !(sp.name+' '+sp.comment).toLowerCase().includes(q)) return false;
      if(SpacingFilters.customOnly && sp.locked) return false;
      if(SpacingFilters.filledOnly && !spacingSummary(sp)) return false;
      return true;
    });
    const card=h('<div class="card" id="spacing-list"></div>');
    if(!items.length) card.appendChild(h(`<div class="empty-state">${ICONS.spacingUI}<div>Нет отступов.</div></div>`));
    items.forEach(sp=>card.appendChild(spacingItem(project,sp,version)));
    const addRow=h('<div style="padding:10px 16px;display:flex;gap:8px;align-items:center"></div>');
    const nameInp=h('<input class="input" style="width:auto" placeholder="Новый тип отступа">');
    const addBtn=h(`<button class="link-add">${ICONS.plus} Добавить</button>`);
    addBtn.onclick=()=>{
      const nm=nameInp.value.trim(); if(!nm){toast('Введите название');return;}
      if(s.spacing.items.some(x=>x.name.toLowerCase()===nm.toLowerCase())){toast('Дубликат');return;}
      const sp=makeSpacingItem(nm); sp.locked=false;
      s.spacing.items.push(sp); Store.save(); toast('Добавлено'); App.render();
    };
    addRow.appendChild(nameInp);addRow.appendChild(addBtn);
    card.appendChild(addRow);
    scr.appendChild(card);
    setTimeout(()=>{
      const el=document.getElementById('spacing-list');
      if(el) enableDragSort(el,(from,to)=>{
        const arr=s.spacing.items; const moved=arr.splice(from,1)[0]; arr.splice(to,0,moved);
        Store.save(); App.render();
      });
    },0);
  }else{
    scr.appendChild(gridEditor(project,version));
  }
  return scr;
}

function spacingItem(project, sp, version){
  const wrap=h('<div class="item" data-spid="'+sp.id+'"></div>');
  const head=h(`<div class="item-head">
    <span class="drag-handle" draggable="true">${ICONS.drag}</span>
    <div class="row-main"><div class="row-title">${esc(sp.name)} ${sp.locked?'<span class="pill">предустан.</span>':''}</div>
    <div class="row-sub">${esc(spacingSummary(sp))||'<span class="muted">не задано</span>'}</div></div>
    ${VERSIONS.some(v=>versionHasSpacing(sp,v))?`<span class="check-ok">${ICONS.checkCircle}</span>`:''}
    <span class="chevron">${ICONS.chevron}</span></div>`);
  wrap.appendChild(head);
  const body=h('<div class="item-body" style="display:none"></div>');
  restoreItemOpen('sp'+sp.id, wrap, body);
  head.onclick=e=>{if(e.target.closest('.drag-handle'))return;itemToggleHandler('sp'+sp.id, wrap, body)(e);};

  body.appendChild(textField('Название', sp.name, v=>{
    const nv=v.trim(); if(!nv){App.render();return;}
    if(project.sections.spacing.items.some(x=>x!==sp&&x.name.toLowerCase()===nv.toLowerCase())){toast('Дубликат');App.render();return;}
    sp.name=nv;Store.save();App.render();
  }));

  const pv=sp.perVersion[version];
  if(version!=='desktop'){
    const block=h('<div class="state-block"></div>');
    const inherit=!!pv.inherit;
    block.appendChild(h(`<div class="state-head"><label class="chk"><input type="checkbox" ${inherit?'checked':''}> Наследовать от ${version==='tablet'?'десктопа':'планшета'}</label></div>`));
    block.querySelector('input').onchange=ev=>{
      if(ev.target.checked){ sp.perVersion[version]={inherit:true}; }
      else{ const parent=VERSIONS[VERSIONS.indexOf(version)-1]; sp.perVersion[version]=Object.assign(deepClone(sp.perVersion[parent]||{}),{inherit:false}); }
      Store.save();App.render();
    };
    if(!inherit) block.appendChild(numField('Значение (px)', pv.value, v=>{setVersionField(sp,version,o=>o.value=v);Store.save();App.render();}));
    const ff=fillFromParentButton(project,sp,version,App.render);
    if(ff) block.appendChild(ff);
    body.appendChild(block);
  }else{
    body.appendChild(numField('Значение (px)', pv.value, v=>{setVersionField(sp,'desktop',o=>o.value=v);Store.save();App.render();}));
  }

  body.appendChild(commentField(sp));

  const actions=h('<div class="modal-actions" style="justify-content:flex-start;margin-top:8px"></div>');
  const dup=h(`<button class="btn btn-sm">${ICONS.copy} Дублировать</button>`);
  dup.onclick=()=>{
    const ns=deepClone(sp); ns.id=uid('sp'); ns.name=sp.name+' копия'; ns.locked=false; ns.updatedAt=nowISO();
    project.sections.spacing.items.splice(project.sections.spacing.items.indexOf(sp)+1,0,ns);
    Store.save(); toast('Дублировано'); App.render();
  };
  actions.appendChild(dup);
  const del=h(`<button class="btn btn-sm btn-danger">${ICONS.trash} Удалить</button>`);
  del.onclick=async ()=>{
    if(sp.locked){
      const ok=await confirmDialog({title:'Очистить значения?',text:'Предустановленный отступ нельзя удалить — можно только очистить.',okLabel:'Очистить',danger:true});
      if(ok){ sp.perVersion={desktop:{value:''},tablet:{inherit:true},mobile:{inherit:true}}; Store.save(); toast('Очищено'); App.render(); }
      return;
    }
    const ok=await confirmDialog({title:'Удалить?',text:sp.name,danger:true,okLabel:'Удалить'});
    if(!ok)return;
    project.sections.spacing.items.splice(project.sections.spacing.items.indexOf(sp),1);
    Store.save(); toast('Удалено'); App.render();
  };
  actions.appendChild(del);
  body.appendChild(actions);

  wrap.appendChild(body);
  return wrap;
}

function gridEditor(project, version){
  const s=project.sections;
  const g=s.grid;
  const card=h('<div class="card" style="padding:16px" id="grid-editor"></div>');
  card.appendChild(h(`<h3 style="margin:0 0 4px">Сетка (${VERSION_LABELS[version]})</h3>
    <div class="hint section-gap">По умолчанию для десктопа используется 12-колоночная сетка Tilda (контейнер 1170px, gutter 30px, поля 15px, макс. контент 1140px).</div>`));

  if(version!=='desktop'){
    const gv=g.perVersion[version];
    const chk=h(`<label class="chk" style="margin-bottom:12px"><input type="checkbox" ${gv.inherit?'checked':''}> Наследовать от ${version==='tablet'?'десктопа':'планшета'}</label>`);
    chk.querySelector('input').onchange=ev=>{
      if(ev.target.checked){ g.perVersion[version]=Object.assign(deepClone(g.perVersion[VERSIONS[VERSIONS.indexOf(version)-1]]||{}),{inherit:true}); }
      else{ const parent=VERSIONS[VERSIONS.indexOf(version)-1]; g.perVersion[version]=Object.assign(deepClone(g.perVersion[parent]||{}),{inherit:false}); }
      g.updatedAt=nowISO(); Store.save(); App.render();
    };
    card.appendChild(chk);
    if(gv.inherit){
      const fillBtn=fillFromParentButton(project,{perVersion:g.perVersion,updatedAt:g.updatedAt},version,App.render);
      if(fillBtn){ const w=h('<div style="margin-top:8px"></div>'); w.appendChild(fillBtn); card.appendChild(w); }
      return card;
    }
  }
  const gv=g.perVersion[version];
  const fields=[['containerWidth','Ширина контейнера (px)'],['columns','Количество колонок'],['gutter','Межколоночный отступ (px)'],['sideMargins','Боковые поля (px)'],['maxContentWidth','Макс. ширина контента (px)']];
  const grid=h('<div class="grid-2"></div>');
  fields.forEach(([k,label])=>{
    grid.appendChild(numField(label, gv[k], v=>{ gv[k]=v; g.updatedAt=nowISO(); Store.save(); }));
  });
  card.appendChild(grid);

  const presetBtn=h('<button class="btn btn-sm" style="margin-top:8px">'+ICONS.download+' Подставить сетку Tilda (12 колонок)</button>');
  presetBtn.onclick=()=>{
    const def=TILDA_GRID[version];
    Object.keys(def).forEach(k=>{ if(k!=='inherit') gv[k]=def[k]; });
    g.updatedAt=nowISO(); Store.save(); toast('Сетка Tilda подставлена'); App.render();
  };
  card.appendChild(presetBtn);
  return card;
}

function spacingFilterPanel(){
  const fp=h(`<div class="card filters-panel"><h3>Фильтры <button class="iconbtn" data-x="close">${ICONS.close}</button></h3></div>`);
  fp.querySelector('[data-x=close]').onclick=()=>{App.state.filtersOpen=false;App.render();};
  const chips=h('<div class="chips"></div>');
  [['filledOnly','Заполненные'],['customOnly','Только мои']].forEach(([k,l])=>{
    const c=h(`<button class="chip ${SpacingFilters[k]?'on':''}">${l}</button>`);
    c.onclick=()=>{SpacingFilters[k]=!SpacingFilters[k];App.render();};
    chips.appendChild(c);
  });
  fp.appendChild(chips);
  return fp;
}
