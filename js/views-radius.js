/* Раздел «Скругления» */

const RadiusFilters = { open:false, queryShown:false, query:'', filledOnly:false, customOnly:false };

function renderRadius(project, params){
  const scr=h('<div class="screen"></div>');
  const s=project.sections;
  const version=project.activeVersion;

  if(RadiusFilters.queryShown){
    const sb=h(`<div class="searchbar">${ICONS.search}<input placeholder="Поиск"><button class="iconbtn" data-x="x">${ICONS.close}</button></div>`);
    const inp=sb.querySelector('input'); inp.value=RadiusFilters.query;
    inp.oninput=()=>{RadiusFilters.query=inp.value;App.rerenderList();};
    sb.querySelector('[data-x=x]').onclick=()=>{RadiusFilters.queryShown=false;RadiusFilters.query='';App.render();};
    setTimeout(()=>inp.focus(),10);
    scr.appendChild(sb);
  }

  let items=s.radius.filter(r=>{
    const q=RadiusFilters.query.trim().toLowerCase();
    if(q && !(r.name+' '+r.comment).toLowerCase().includes(q)) return false;
    if(RadiusFilters.customOnly && r.locked) return false;
    if(RadiusFilters.filledOnly && !radiusSummary(r)) return false;
    return true;
  });

  const card=h('<div class="card" id="radius-list"></div>');
  if(!items.length) card.appendChild(h(`<div class="empty-state">${ICONS.radiusUI}<div>Нет скруглений.</div></div>`));
  items.forEach(r=>card.appendChild(radiusItem(project,r,version)));

  const addRow=h('<div style="padding:10px 16px;display:flex;gap:8px;align-items:center"></div>');
  const nameInp=h('<input class="input" style="width:auto" placeholder="Название нового скругления">');
  const addBtn=h(`<button class="link-add">${ICONS.plus} Добавить</button>`);
  addBtn.onclick=()=>{
    const nm=nameInp.value.trim();
    if(!nm){toast('Введите название');return;}
    if(s.radius.some(r=>r.name.toLowerCase()===nm.toLowerCase())){toast('Дубликат названия');return;}
    const r=makeRadiusItem(nm); r.locked=false;
    s.radius.push(r); Store.save(); toast('Добавлено'); App.render();
  };
  addRow.appendChild(nameInp); addRow.appendChild(addBtn);
  card.appendChild(addRow);
  scr.appendChild(card);

  setTimeout(()=>{
    const el=document.getElementById('radius-list');
    if(el) enableDragSort(el,(from,to)=>{
      const arr=s.radius; const moved=arr.splice(from,1)[0]; arr.splice(to,0,moved);
      Store.save(); App.render();
    });
  },0);
  return scr;
}

function radiusItem(project, r, version){
  const wrap=h('<div class="item" data-rid="'+r.id+'"></div>');
  const usedBy = findLinksTo(project,'radius',r.id,r.name);
  const head=h(`<div class="item-head">
    <span class="drag-handle" draggable="true">${ICONS.drag}</span>
    <div class="row-main"><div class="row-title">${esc(r.name)} ${r.locked?'<span class="pill">предустан.</span>':''}</div>
    <div class="row-sub">${radiusSummary(r)?esc(radiusSummary(r))+' px':'<span class="muted">не задано</span>'}${usedBy.length?' · используется: '+usedBy.length:''}</div></div>
    ${radiusSummary(r)?`<span class="check-ok">${ICONS.checkCircle}</span>`:''}
    <span class="chevron">${ICONS.chevron}</span></div>`);
  wrap.appendChild(head);
  const body=h('<div class="item-body" style="display:none"></div>');
  restoreItemOpen('r'+r.id, wrap, body);
  head.onclick=e=>{if(e.target.closest('.drag-handle'))return; itemToggleHandler('r'+r.id, wrap, body)(e);};

  body.appendChild(textField('Название', r.name, v=>{
    const nv=v.trim(); if(!nv){App.render();return;}
    if(project.sections.radius.some(x=>x!==r&&x.name.toLowerCase()===nv.toLowerCase())){toast('Дубликат');App.render();return;}
    r.name=nv;Store.save();App.render();
  }));

  // Режим
  const modeRow=h('<div class="field"><label>Режим</label><div class="chips"></div></div>');
  [['common','Общее значение'],['corners','По углам']].forEach(([k,l])=>{
    const c=h(`<button class="chip ${r.mode===k?'on':''}">${l}</button>`);
    c.onclick=()=>{r.mode=k;Store.save();App.render();};
    modeRow.querySelector('.chips').appendChild(c);
  });
  body.appendChild(modeRow);

  // Поля текущей версии
  const pv=r.perVersion[version];
  if(version!=='desktop'){
    const block=h('<div class="state-block"></div>');
    const inherit=!!pv.inherit;
    block.appendChild(h(`<div class="state-head"><label class="chk"><input type="checkbox" ${inherit?'checked':''}> Наследовать от ${version==='tablet'?'десктопа':'планшета'}</label></div>`));
    block.querySelector('input').onchange=ev=>{
      if(ev.target.checked){ r.perVersion[version]={inherit:true}; }
      else{ const parent=VERSIONS[VERSIONS.indexOf(version)-1]; r.perVersion[version]=Object.assign(deepClone(r.perVersion[parent]||{}),{inherit:false}); }
      Store.save();App.render();
    };
    if(!inherit) radiusFields(r,pv,block);
    const ff=fillFromParentButton(project,r,version,App.render);
    if(ff) block.appendChild(ff);
    body.appendChild(block);
  }else{
    radiusFields(r,pv,body);
  }

  body.appendChild(commentField(r));

  const actions=h('<div class="modal-actions" style="justify-content:flex-start;margin-top:8px"></div>');
  const dup=h(`<button class="btn btn-sm">${ICONS.copy} Дублировать</button>`);
  dup.onclick=()=>{
    const nr=deepClone(r); nr.id=uid('r'); nr.name=r.name+' копия'; nr.locked=false; nr.updatedAt=nowISO();
    project.sections.radius.splice(project.sections.radius.indexOf(r)+1,0,nr);
    Store.save(); toast('Дублировано'); App.render();
  };
  actions.appendChild(dup);
  const del=h(`<button class="btn btn-sm btn-danger">${ICONS.trash} Удалить</button>`);
  del.onclick=async ()=>{
    if(r.locked){
      // предустановленные удалить нельзя — только очистить
      const ok=await confirmDialog({title:'Очистить значения?',text:'Предустановленное скругление нельзя удалить — можно только очистить значения.',okLabel:'Очистить',danger:true});
      if(ok){ r.perVersion={desktop:{common:'',tl:'',tr:'',br:'',bl:''},tablet:{inherit:true},mobile:{inherit:true}}; r.updatedAt=nowISO(); Store.save(); toast('Очищено'); App.render(); }
      return;
    }
    const links=findLinksTo(project,'radius',r.id,r.name);
    const ok=await confirmDeleteWithLinks(r.name,links);
    if(!ok)return;
    breakLinksTo(project,'radius',r.id);
    project.sections.radius.splice(project.sections.radius.indexOf(r),1);
    Store.save(); toast('Удалено'); App.render();
  };
  actions.appendChild(del);
  body.appendChild(actions);

  wrap.appendChild(body);
  return wrap;
}

function radiusFields(r,pv,container){
  if(r.mode==='common'){
    container.appendChild(numField('Скругление (px)', pv.common, v=>{ setVersionField(r,App.project.activeVersion,o=>o.common=v); Store.save(); App.render(); }));
  }else{
    const g=h('<div class="grid-4"></div>');
    g.appendChild(numField('Верхний левый', pv.tl, v=>setV(r,'tl',v)));
    g.appendChild(numField('Верхний правый', pv.tr, v=>setV(r,'tr',v)));
    g.appendChild(numField('Нижний правый', pv.br, v=>setV(r,'br',v)));
    g.appendChild(numField('Нижний левый', pv.bl, v=>setV(r,'bl',v)));
    container.appendChild(g);
  }
}
function setV(r,key,v){ setVersionField(r,App.project.activeVersion,o=>o[key]=v); Store.save(); App.render(); }

function radiusFilterPanel(){
  const fp=h(`<div class="card filters-panel"><h3>Фильтры <button class="iconbtn" data-x="close">${ICONS.close}</button></h3></div>`);
  fp.querySelector('[data-x=close]').onclick=()=>{App.state.filtersOpen=false;App.render();};
  const chips=h('<div class="chips"></div>');
  [['filledOnly','Заполненные'],['customOnly','Только мои']].forEach(([k,l])=>{
    const c=h(`<button class="chip ${RadiusFilters[k]?'on':''}">${l}</button>`);
    c.onclick=()=>{RadiusFilters[k]=!RadiusFilters[k];App.render();};
    chips.appendChild(c);
  });
  fp.appendChild(chips);
  return fp;
}
