/* Раздел «Поля ввода» */

const InputFilters = { open:false, queryShown:false, query:'', filledOnly:false };

function renderInputs(project, params){
  const scr=h('<div class="screen"></div>');
  const s=project.sections;
  const version=project.activeVersion;

  if(InputFilters.queryShown){
    const sb=h(`<div class="searchbar">${ICONS.search}<input placeholder="Поиск"><button class="iconbtn" data-x="x">${ICONS.close}</button></div>`);
    const inp=sb.querySelector('input'); inp.value=InputFilters.query;
    inp.oninput=()=>{InputFilters.query=inp.value;App.rerenderList();};
    sb.querySelector('[data-x=x]').onclick=()=>{InputFilters.queryShown=false;InputFilters.query='';App.render();};
    setTimeout(()=>inp.focus(),10);
    scr.appendChild(sb);
  }

  const fields=s.inputs.filter(f=>{
    const q=InputFilters.query.trim().toLowerCase();
    if(q && !(f.size+' '+f.comment).toLowerCase().includes(q)) return false;
    if(InputFilters.filledOnly && !versionHasInput(project,f,'desktop')&&!versionHasInput(project,f,'tablet')&&!versionHasInput(project,f,'mobile')) return false;
    return true;
  }).sort((a,b)=>INPUT_SIZE_ORDER.indexOf(a.size)-INPUT_SIZE_ORDER.indexOf(b.size));

  const card=h('<div class="card" id="input-list"></div>');
  if(!fields.length) card.appendChild(h(`<div class="empty-state">${ICONS.inputUI}<div>Нет полей. Добавьте размер ниже.</div></div>`));
  fields.forEach(f=>card.appendChild(inputFieldCard(project,f,version)));
  const addRow=h('<div style="padding:10px 16px;display:flex;gap:8px;align-items:center"></div>');
  const selSize=h(`<select class="input" style="width:auto"><option value="">Размер…</option>${INPUT_SIZE_ORDER.map(x=>`<option>${x}</option>`).join('')}</select>`);
  const addBtn=h(`<button class="link-add">${ICONS.plus} Добавить размер поля</button>`);
  addBtn.onclick=()=>{
    const sz=selSize.value; if(!sz){toast('Выберите размер');return;}
    if(s.inputs.some(f=>f.size===sz)){toast('Такой размер уже есть');return;}
    s.inputs.push(makeInputField(sz)); Store.save(); toast('Поле добавлено'); App.render();
  };
  addRow.appendChild(selSize); addRow.appendChild(addBtn);
  card.appendChild(addRow);
  scr.appendChild(card);

  setTimeout(()=>{
    const el=document.getElementById('input-list');
    if(el) enableDragSort(el,(from,to)=>{
      const arr=s.inputs; const moved=arr.splice(from,1)[0]; arr.splice(to,0,moved);
      Store.save(); App.render();
    });
  },0);
  return scr;
}

function inputFieldCard(project, f, version){
  const wrap=h('<div class="item" data-iid="'+f.id+'"></div>');
  const head=h(`<div class="item-head">
    <span class="drag-handle" draggable="true">${ICONS.drag}</span>
    <div class="row-main"><div class="row-title">Поле ${esc(f.size)}</div>
    <div class="row-sub">${esc(inputSummary(project,f))||'<span class="muted">не заполнено</span>'}</div></div>
    ${VERSIONS.some(v=>versionHasInput(project,f,v))?`<span class="check-ok">${ICONS.checkCircle}</span>`:''}
    ${findBrokenLinks(project).some(x=>x.itemId===f.id)?`<span class="badge-broken">${ICONS.linkBroken}</span>`:''}
    <span class="chevron">${ICONS.chevron}</span></div>`);
  wrap.appendChild(head);
  const body=h('<div class="item-body" style="display:none"></div>');
  head.onclick=e=>{if(e.target.closest('.drag-handle'))return;wrap.classList.toggle('open');body.style.display=wrap.classList.contains('open')?'block':'none';};

  body.appendChild(textField('Размер', f.size, v=>{
    const nv=v.trim().toUpperCase(); if(!nv){App.render();return;}
    if(project.sections.inputs.some(x=>x!==f&&x.size===nv)){toast('Дубликат размера');App.render();return;}
    f.size=nv;Store.save();App.render();
  }));

  // Label (сквозные ссылки)
  const lblF=h('<div class="field"><label>Label — типографика</label></div>');
  lblF.appendChild(linkSelect(project,'typo',f.shared.labelTypoRef,ref=>{f.shared.labelTypoRef=ref;Store.save();App.render();},{brokenText:'стиль удалён'}));
  body.appendChild(lblF);
  const lcF=h('<div class="field"><label>Label — цвет</label></div>');
  lcF.appendChild(linkSelect(project,'color',f.shared.labelColorRef,ref=>{f.shared.labelColorRef=ref;Store.save();App.render();},{brokenText:'цвет удалён'}));
  body.appendChild(lcF);

  // Состояния
  body.appendChild(h('<h2 class="sec" style="margin-top:8px">Состояния</h2>'));
  allInputStates(f).forEach(st=>body.appendChild(inputStateBlock(project,f,st)));

  const addState=h('<div style="padding:6px 0"></div>');
  const asBtn=h(`<button class="link-add">${ICONS.plus} Добавить своё состояние</button>`);
  asBtn.onclick=()=>{
    const name=prompt('Название состояния','Filled');
    if(!name||!name.trim())return;
    f.customStates.push({id:uid('st'),label:name.trim(),locked:false,bgRef:null,textTypoRef:null,textColorRef:null,phTypoRef:null,phColorRef:null,borderColorRef:null,borderWidth:''});
    Store.save();App.render();
  };
  addState.appendChild(asBtn); body.appendChild(addState);

  // Геометрия версии
  body.appendChild(h('<h2 class="sec">Геометрия ('+VERSION_LABELS[version]+')</h2>'));
  const pv=f.perVersion[version];
  const geoWrap=h('<div></div>');
  if(version!=='desktop'){
    const inherit=!!pv.inherit;
    const block=h('<div class="state-block"></div>');
    block.appendChild(h(`<div class="state-head"><label class="chk"><input type="checkbox" ${inherit?'checked':''}> Наследовать от ${version==='tablet'?'десктопа':'планшета'}</label></div>`));
    block.querySelector('input').onchange=ev=>{
      if(ev.target.checked){ f.perVersion[version]={inherit:true}; }
      else{ const parent=VERSIONS[VERSIONS.indexOf(version)-1]; f.perVersion[version]=Object.assign(deepClone(f.perVersion[parent]||{}),{inherit:false}); }
      Store.save();App.render();
    };
    if(!inherit) fillGeoFields(project,f,version,pv,block);
    const ff=fillFromParentButton(project,f,version,App.render);
    if(ff) block.appendChild(ff);
    geoWrap.appendChild(block);
  }else{
    fillGeoFields(project,f,version,pv,geoWrap);
  }
  body.appendChild(geoWrap);

  body.appendChild(commentField(f));

  const actions=h('<div class="modal-actions" style="justify-content:flex-start;margin-top:8px"></div>');
  const dup=h(`<button class="btn btn-sm">${ICONS.copy} Дублировать поле</button>`);
  dup.onclick=()=>{
    const nf=deepClone(f); nf.id=uid('inp'); nf.size=f.size+' копия'; nf.updatedAt=nowISO();
    project.sections.inputs.splice(project.sections.inputs.indexOf(f)+1,0,nf);
    Store.save(); toast('Поле дублировано'); App.render();
  };
  actions.appendChild(dup);
  const del=h(`<button class="btn btn-sm btn-danger">${ICONS.trash} Удалить поле</button>`);
  del.onclick=async ()=>{
    const ok=await confirmDialog({title:'Удалить поле?',text:`Размер ${f.size}`,danger:true,okLabel:'Удалить'});
    if(!ok)return;
    project.sections.inputs.splice(project.sections.inputs.indexOf(f),1);
    Store.save(); toast('Поле удалено'); App.render();
  };
  actions.appendChild(del);
  body.appendChild(actions);

  wrap.appendChild(body);
  return wrap;
}

function fillGeoFields(project,f,version,pv,container){
  container.appendChild(numField('Высота поля', pv.height, v=>{setVersionField(f,version,o=>o.height=v);Store.save();}));
  const g=h('<div class="grid-2"></div>');
  g.appendChild(numField('Внутр. отступы сверху/снизу', pv.padV, v=>{setVersionField(f,version,o=>o.padV=v);Store.save();}));
  g.appendChild(numField('Внутр. отступы слева/справа', pv.padH, v=>{setVersionField(f,version,o=>o.padH=v);Store.save();}));
  container.appendChild(g);
  const radF=h('<div class="field"><label>Скругление</label></div>');
  radF.appendChild(linkSelect(project,'radius',pv.radiusRef||null,ref=>{setVersionField(f,version,o=>o.radiusRef=ref);Store.save();App.render();},{brokenText:'скругление удалено'}));
  container.appendChild(radF);
  const shF=h('<div class="field"><label>Тень</label></div>');
  shF.appendChild(linkSelect(project,'shadow',pv.shadowRef||null,ref=>{setVersionField(f,version,o=>o.shadowRef=ref);Store.save();App.render();},{brokenText:'тень удалена'}));
  container.appendChild(shF);
}

function inputStateBlock(project,f,st){
  const block=h('<div class="state-block"></div>');
  const head=h('<div class="state-head"></div>');
  head.appendChild(h(`<span>${esc(st.label)}</span>`));
  if(st.locked) head.appendChild(h('<span class="pill">предустан.</span>'));
  block.appendChild(head);
  if(!st.locked){
    const rm=h(`<button class="iconbtn" title="Удалить" style="min-width:32px;height:32px">${ICONS.trash}</button>`);
    rm.onclick=()=>{ f.customStates=f.customStates.filter(x=>x.id!==st.id); Store.save(); App.render(); };
    head.appendChild(rm);
  }
  const mk=(label,kind,key,hint)=>{
    const fld=h(`<div class="field"><label>${esc(label)}</label></div>`);
    fld.appendChild(linkSelect(project,kind,st[key]||null,ref=>{st[key]=ref;f.updatedAt=nowISO();Store.save();App.render();},
      {brokenText: kind==='color'?'цвет удалён':'стиль удалён'}));
    if(hint) fld.appendChild(h(`<div class="hint">${hint}</div>`));
    return fld;
  };
  block.appendChild(mk('Фон поля','color','bgRef'));
  block.appendChild(mk('Текст — типографика','typo','textTypoRef','Если не выбрано — используется основная типографика соответствующего размера.'));
  block.appendChild(mk('Текст — цвет','color','textColorRef','Если не выбрано — цвет из типографики.'));
  block.appendChild(mk('Плейсхолдер — типографика','typo','phTypoRef','Если не выбрано — основная типографика размера.'));
  block.appendChild(mk('Плейсхолдер — цвет','color','phColorRef'));
  block.appendChild(mk('Обводка — цвет','color','borderColorRef'));
  block.appendChild(numField('Обводка — толщина (px)', st.borderWidth, v=>{st.borderWidth=v;Store.save();}));
  return block;
}

function inputsFilterPanel(){
  const fp=h(`<div class="card filters-panel"><h3>Фильтры <button class="iconbtn" data-x="close">${ICONS.close}</button></h3></div>`);
  fp.querySelector('[data-x=close]').onclick=()=>{App.state.filtersOpen=false;App.render();};
  const chips=h('<div class="chips"></div>');
  [['filledOnly','Заполненные']].forEach(([k,l])=>{
    const c=h(`<button class="chip ${InputFilters[k]?'on':''}">${l}</button>`);
    c.onclick=()=>{InputFilters[k]=!InputFilters[k];App.render();};
    chips.appendChild(c);
  });
  fp.appendChild(chips);
  return fp;
}
