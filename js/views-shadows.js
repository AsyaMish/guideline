/* Раздел «Тени» (сквозной) */

const ShadowFilters = { open:false, queryShown:false, query:'', filledOnly:false, customOnly:false };

function renderShadows(project, params){
  const scr=h('<div class="screen"></div>');
  const s=project.sections;
  scr.appendChild(h('<div class="muted small section-gap">Раздел сквозной: значения одинаковы для всех версий.</div>'));

  if(ShadowFilters.queryShown){
    const sb=h(`<div class="searchbar">${ICONS.search}<input placeholder="Поиск"><button class="iconbtn" data-x="x">${ICONS.close}</button></div>`);
    const inp=sb.querySelector('input'); inp.value=ShadowFilters.query;
    inp.oninput=()=>{ShadowFilters.query=inp.value;App.rerenderList();};
    sb.querySelector('[data-x=x]').onclick=()=>{ShadowFilters.queryShown=false;ShadowFilters.query='';App.render();};
    setTimeout(()=>inp.focus(),10);
    scr.appendChild(sb);
  }

  let items=s.shadows.filter(sh=>{
    const q=ShadowFilters.query.trim().toLowerCase();
    if(q && !(sh.name+' '+sh.comment).toLowerCase().includes(q)) return false;
    if(ShadowFilters.customOnly && sh.locked) return false;
    if(ShadowFilters.filledOnly && !sh.layers.some(l=>l.x||l.y||l.blur||l.spread||l.colorRef)) return false;
    return true;
  });

  const card=h('<div class="card" id="shadow-list"></div>');
  if(!items.length) card.appendChild(h(`<div class="empty-state">${ICONS.shadowUI}<div>Нет теней.</div></div>`));
  items.forEach(sh=>card.appendChild(shadowItem(project,sh)));

  const addRow=h('<div style="padding:10px 16px;display:flex;gap:8px;align-items:center"></div>');
  const nameInp=h('<input class="input" style="width:auto" placeholder="Название новой тени">');
  const addBtn=h(`<button class="link-add">${ICONS.plus} Добавить тень</button>`);
  addBtn.onclick=()=>{
    const nm=nameInp.value.trim();
    if(!nm){toast('Введите название');return;}
    if(s.shadows.some(x=>x.name.toLowerCase()===nm.toLowerCase())){toast('Дубликат названия');return;}
    const sh=makeShadowItem(nm); sh.locked=false;
    s.shadows.push(sh); Store.save(); toast('Тень добавлена'); App.render();
  };
  addRow.appendChild(nameInp); addRow.appendChild(addBtn);
  card.appendChild(addRow);
  scr.appendChild(card);

  setTimeout(()=>{
    const el=document.getElementById('shadow-list');
    if(el) enableDragSort(el,(from,to)=>{
      const arr=s.shadows; const moved=arr.splice(from,1)[0]; arr.splice(to,0,moved);
      Store.save(); App.render();
    });
  },0);
  return scr;
}

function shadowItem(project, sh){
  const wrap=h('<div class="item" data-shid="'+sh.id+'"></div>');
  const usedBy=findLinksTo(project,'shadow',sh.id,sh.name);
  const cssPreview = buildShadowCSS(project, sh);
  const head=h(`<div class="item-head">
    <span class="drag-handle" draggable="true">${ICONS.drag}</span>
    <div class="row-main"><div class="row-title">${esc(sh.name)} ${sh.locked?'<span class="pill">предустан.</span>':''}</div>
    <div class="row-sub">${esc(shadowSummaryText(project,sh))||'<span class="muted">пусто</span>'}${usedBy.length?' · используется: '+usedBy.length:''}</div></div>
    ${cssPreview?`<span class="check-ok">${ICONS.checkCircle}</span>`:''}
    <span class="chevron">${ICONS.chevron}</span></div>`);
  wrap.appendChild(head);
  const body=h('<div class="item-body" style="display:none"></div>');
  head.onclick=e=>{if(e.target.closest('.drag-handle'))return;wrap.classList.toggle('open');body.style.display=wrap.classList.contains('open')?'block':'none';};

  body.appendChild(textField('Название', sh.name, v=>{
    const nv=v.trim(); if(!nv){App.render();return;}
    if(project.sections.shadows.some(x=>x!==sh&&x.name.toLowerCase()===nv.toLowerCase())){toast('Дубликат');App.render();return;}
    sh.name=nv;Store.save();App.render();
  }));

  // Предпросмотр
  const prevWrap=h('<div class="field"><label>Предпросмотр</label></div>');
  const box=h('<div style="height:70px;border-radius:14px;background:var(--surface2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;">Превью</div>');
  if(cssPreview) box.style.boxShadow=cssPreview;
  prevWrap.appendChild(box);
  body.appendChild(prevWrap);

  // Слои
  body.appendChild(h('<h2 class="sec" style="margin-top:4px">Слои теней</h2>'));
  sh.layers.forEach((l,i)=>body.appendChild(shadowLayerBlock(project,sh,l,i)));

  const addL=h(`<button class="link-add">${ICONS.plus} Добавить слой</button>`);
  addL.onclick=()=>{ sh.layers.push(makeShadowLayer()); Store.save(); App.render(); };
  body.appendChild(addL);

  body.appendChild(commentField(sh));

  const actions=h('<div class="modal-actions" style="justify-content:flex-start;margin-top:8px"></div>');
  const dup=h(`<button class="btn btn-sm">${ICONS.copy} Дублировать тень</button>`);
  dup.onclick=()=>{
    const ns=deepClone(sh); ns.id=uid('sh'); ns.name=sh.name+' копия'; ns.locked=false; ns.updatedAt=nowISO();
    project.sections.shadows.splice(project.sections.shadows.indexOf(sh)+1,0,ns);
    Store.save(); toast('Дублировано'); App.render();
  };
  actions.appendChild(dup);
  const del=h(`<button class="btn btn-sm btn-danger">${ICONS.trash} Удалить</button>`);
  del.onclick=async ()=>{
    if(sh.locked){
      const ok=await confirmDialog({title:'Очистить слои?',text:'Предустановленную тень нельзя удалить — можно только очистить слои.',okLabel:'Очистить',danger:true});
      if(ok){ sh.layers=[makeShadowLayer()]; sh.updatedAt=nowISO(); Store.save(); toast('Очищено'); App.render(); }
      return;
    }
    const links=findLinksTo(project,'shadow',sh.id,sh.name);
    const ok=await confirmDeleteWithLinks(sh.name,links);
    if(!ok)return;
    breakLinksTo(project,'shadow',sh.id);
    project.sections.shadows.splice(project.sections.shadows.indexOf(sh),1);
    Store.save(); toast('Удалено'); App.render();
  };
  actions.appendChild(del);
  body.appendChild(actions);

  wrap.appendChild(body);
  return wrap;
}

function shadowLayerBlock(project, sh, l, idx){
  const block=h('<div class="layer-block"></div>');
  const head=h('<div class="state-head"></div>');
  head.appendChild(h(`<span>${ICONS.layers} Слой ${idx+1}</span>`));
  block.appendChild(head);
  if(sh.layers.length>1){
    const rm=h(`<button class="iconbtn" style="min-width:32px;height:32px" title="Удалить слой">${ICONS.trash}</button>`);
    rm.onclick=()=>{ sh.layers.splice(idx,1); Store.save(); App.render(); };
    head.appendChild(rm);
  }

  const typeRow=h('<div class="field"><label>Тип</label><div class="chips"></div></div>');
  [['внешняя',false],['внутренняя',true]].forEach(([lab,val])=>{
    const c=h(`<button class="chip ${(!!l.inner)===val?'on':''}">${lab}</button>`);
    c.onclick=()=>{ l.inner=val; Store.save(); App.render(); };
    typeRow.querySelector('.chips').appendChild(c);
  });
  block.appendChild(typeRow);

  const g=h('<div class="grid-4"></div>');
  g.appendChild(numField('X', l.x, v=>{l.x=v;Store.save();}));
  g.appendChild(numField('Y', l.y, v=>{l.y=v;Store.save();}));
  g.appendChild(numField('Размытие', l.blur, v=>{l.blur=v;Store.save();}));
  g.appendChild(numField('Растяжение', l.spread, v=>{l.spread=v;Store.save();}));
  block.appendChild(g);

  const colF=h('<div class="field"><label>Цвет</label></div>');
  colF.appendChild(linkSelect(project,'color',l.colorRef,ref=>{l.colorRef=ref;Store.save();App.render();},{brokenText:'цвет удалён'}));
  block.appendChild(colF);

  block.appendChild(numField('Прозрачность (%)', l.opacity, v=>{
    if(v!=='' && (+v<0||+v>100)){ toast('0–100%'); return; }
    l.opacity=v; Store.save();
  }));
  return block;
}

function buildShadowCSS(project, sh){
  const parts=sh.layers.map(l=>{
    const c=l.colorRef?resolveColorRef(project,l.colorRef):null;
    let color=c&&c.hex?c.hex:'rgba(0,0,0,0.35)';
    if(l.opacity!==''&&c&&c.hex){
      const n=hexToRgba(color,+l.opacity); if(n) color=n;
    }else if(l.opacity!==''){
      const n=hexToRgba(color,+l.opacity); if(n) color=n;
    }
    return `${l.inner?'inset ':''}${numVal(l.x)||0}px ${numVal(l.y)||0}px ${numVal(l.blur)||0}px ${numVal(l.spread)||0}px ${color}`;
  });
  return parts.join(', ');
}
function hexToRgba(hex, alpha){
  const hx=normHex(hex); if(!hx) return null;
  const r=parseInt(hx.slice(1,3),16),g=parseInt(hx.slice(3,5),16),b=parseInt(hx.slice(5,7),16);
  const a=Math.max(0,Math.min(100,alpha))/100;
  return `rgba(${r},${g},${b},${a})`;
}

function shadowsFilterPanel(){
  const fp=h(`<div class="card filters-panel"><h3>Фильтры <button class="iconbtn" data-x="close">${ICONS.close}</button></h3></div>`);
  fp.querySelector('[data-x=close]').onclick=()=>{App.state.filtersOpen=false;App.render();};
  const chips=h('<div class="chips"></div>');
  [['filledOnly','Заполненные'],['customOnly','Только мои']].forEach(([k,l])=>{
    const c=h(`<button class="chip ${ShadowFilters[k]?'on':''}">${l}</button>`);
    c.onclick=()=>{ShadowFilters[k]=!ShadowFilters[k];App.render();};
    chips.appendChild(c);
  });
  fp.appendChild(chips);
  return fp;
}
