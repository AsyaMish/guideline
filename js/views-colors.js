/* Раздел «Цвета» (сквозной) */

const ColorFilters = { open:false, queryShown:false, query:'', filledOnly:false, unfilledOnly:false, withComments:false, customOnly:false, presetOnly:false };

function renderColors(project, params){
  const scr = h('<div class="screen"></div>');
  scr.appendChild(h(`<div class="muted small section-gap">Раздел сквозной: значения одинаковы для всех версий.</div>`));

  if(ColorFilters.queryShown){
    const sb=h(`<div class="searchbar">${ICONS.search}<input placeholder="Поиск по названию"><button class="iconbtn" data-x="x">${ICONS.close}</button></div>`);
    const inp=sb.querySelector('input'); inp.value=ColorFilters.query;
    inp.oninput=()=>{ColorFilters.query=inp.value;App.rerenderList();};
    sb.querySelector('[data-x=x]').onclick=()=>{ColorFilters.queryShown=false;ColorFilters.query='';App.render();};
    setTimeout(()=>inp.focus(),10);
    scr.appendChild(sb);
  }

  const listEl = h('<div class="card" id="color-list"></div>');
  buildColorRows(project).forEach(r=>listEl.appendChild(r));
  scr.appendChild(listEl);
  return scr;
}

function filteredColors(project){
  let arr = project.sections.colors.slice();
  const q=ColorFilters.query.trim().toLowerCase();
  if(q) arr=arr.filter(c=>c.name.toLowerCase().includes(q)||String(c.hex).toLowerCase().includes(q));
  if(ColorFilters.filledOnly) arr=arr.filter(c=>!!c.hex);
  if(ColorFilters.unfilledOnly) arr=arr.filter(c=>!c.hex);
  if(ColorFilters.withComments) arr=arr.filter(c=>!!(c.comment&&c.comment.trim()));
  if(ColorFilters.customOnly) arr=arr.filter(c=>!c.locked);
  if(ColorFilters.presetOnly) arr=arr.filter(c=>c.locked);
  return arr;
}

function colorDragIdxList(){ return null; }

function buildColorRows(project){
  const rows=[];
  const items = filteredColors(project);
  if(!items.length) rows.push(h(`<div class="empty-state">${ICONS.palette}<div>Нет цветов по данным параметрам</div></div>`));
  items.forEach((c)=>{
    const globalIdx = project.sections.colors.indexOf(c);
    const wrap = h('<div class="item" data-cid="'+c.id+'"></div>');
    const head = h(`<div class="item-head">
      <span class="drag-handle" draggable="true" data-dragidx="${globalIdx}" title="Перетащить">${ICONS.drag}</span>
      </div>`);
    head.appendChild(swatchEl(c.hex));
    const title = h(`<div class="row-main"><div class="row-title">${esc(c.name)} ${c.locked?'<span class="pill">предустан.</span>':''}</div>
      <div class="row-sub">${c.hex?esc(c.hex):'<span class="muted">HEX не задан</span>'}${c.comment?' · '+esc(c.comment):''}</div></div>`);
    head.appendChild(title);
    if(c.hex && isFilledHex(c.hex)) head.appendChild(h(`<span class="check-ok">${ICONS.checkCircle}</span>`));
    head.onclick=e=>{ if(e.target.closest('.drag-handle'))return; itemToggleHandler('c'+c.id, wrap, body)(e); };
    wrap.appendChild(head);

    const body = h('<div class="item-body" style="display:none"></div>');
    restoreItemOpen('c'+c.id, wrap, body);

    // Название (редактируемое)
    body.appendChild(textField('Название', c.name, v=>{
      const nv=v.trim();
      if(!nv){ toast('Название не может быть пустым'); App.render(); return; }
      if(project.sections.colors.some(x=>x!==c&&x.name.toLowerCase()===nv.toLowerCase())){ toast('Дубликат названия'); App.render(); return; }
      c.name=nv; c.updatedAt=nowISO(); Store.save(); App.render();
    }));

    // HEX с превью
    const hexF = h(`<div class="field"><label>HEX-код</label><div class="hexrow">
      <input class="input" placeholder="#RRGGBB или RRGG BB" value="${esc(c.hex)}">
      <span data-sw></span></div><div class="hint">Формат #RRGGBB. Невалидное значение не сохраняется.</div></div>`);
    const hexInp = hexF.querySelector('input');
    const swSlot = hexF.querySelector('[data-sw]');
    const updSw = ()=>{ swSlot.innerHTML=''; swSlot.appendChild(swatchEl(normHex(hexInp.value)||'', true)); };
    updSw();
    hexInp.addEventListener('change',()=>{
      const val = hexInp.value.trim();
      if(val===''){ c.hex=''; c.updatedAt=nowISO(); Store.save(); updSw(); toast('HEX очищен'); App.render(); return; }
      const hx = normHex(val);
      if(!hx){ toast('Неверный формат HEX'); hexInp.value=c.hex; return; }
      c.hex=hx; c.updatedAt=nowISO(); Store.save(); updSw(); App.render();
    });
    body.appendChild(hexF);

    body.appendChild(commentField(c));

    const actions = h('<div class="modal-actions" style="justify-content:flex-start;margin-top:8px"></div>');
    const dupBtn = h(`<button class="btn btn-sm">${ICONS.copy} Дублировать</button>`);
    dupBtn.onclick=()=>{
      const nc = Object.assign(deepClone(c), {id:uid('c'), name:uniqueName(project,c.name), locked:false});
      nc.updatedAt=nowISO();
      project.sections.colors.splice(globalIdx+1,0,nc);
      Store.save(); toast('Цвет дублирован'); App.render();
    };
    actions.appendChild(dupBtn);
    const delBtn = h(`<button class="btn btn-sm btn-danger">${ICONS.trash} Удалить</button>`);
    delBtn.onclick=async ()=>{
      const links = findLinksTo(project,'color',c.id,c.name);
      const ok = await confirmDeleteWithLinks(c.name, links);
      if(!ok) return;
      breakLinksTo(project,'color',c.id);
      project.sections.colors.splice(globalIdx,1);
      Store.save(); toast('Цвет удалён'); App.render();
    };
    actions.appendChild(delBtn);
    body.appendChild(actions);

    wrap.appendChild(body);
    rows.push(wrap);
  });

  // Drag&drop сортировка
  setTimeout(()=>{
    const listEl=document.getElementById('color-list');
    if(listEl) enableDragSort(listEl,(from,to)=>{
      const arr=project.sections.colors;
      const moved=arr.splice(from,1)[0];
      arr.splice(to,0,moved);
      Store.save(); App.render();
    });
  },0);

  return rows;
}

function uniqueName(project, base){
  let n = base+' 2', i=2;
  while(project.sections.colors.some(c=>c.name===n)) { i++; n=base+' '+i; }
  return n;
}
function isFilledHex(hex){ return !!normHex(hex); }

/* Быстрое добавление цвета из модалки (+ в разделе / FAB) */
function quickAddColor(project){
  const m = h(`<div class="modal"><h3>Новый цвет</h3>
    <div class="field"><label>Название *</label><input class="input" id="ac-name" placeholder="Например: Фон секции hero"></div>
    <div class="field"><label>HEX</label><input class="input" id="ac-hex" placeholder="#RRGGBB"></div>
    <div class="modal-actions"><button class="btn" data-x="c">Отмена</button><button class="btn btn-primary" data-x="a">Добавить</button></div></div>`);
  m.querySelector('[data-x=c]').onclick=closeModal;
  m.querySelector('[data-x=a]').onclick=()=>{
    const nm=m.querySelector('#ac-name').value.trim();
    if(!nm){toast('Введите название');return;}
    if(project.sections.colors.some(c=>c.name.toLowerCase()===nm.toLowerCase())){toast('Дубликат названия');return;}
    const hxRaw=m.querySelector('#ac-hex').value.trim();
    let hx='';
    if(hxRaw){ const parsed=normHex(hxRaw); if(!parsed){toast('Неверный HEX');return;} hx=parsed; }
    const c=makeColorItem(nm); c.hex=hx;
    project.sections.colors.push(c);
    Store.save(); closeModal(); toast('Цвет добавлен'); App.render();
  };
  openModal(m);
  setTimeout(()=>m.querySelector('#ac-name').focus(),50);
}

/* Панель фильтров раздела Colors */
function colorsFilterPanel(){
  const fp = h(`<div class="card filters-panel"><h3>Фильтры <button class="iconbtn" data-x="close">${ICONS.close}</button></h3></div>`);
  fp.querySelector('[data-x=close]').onclick=()=>{App.state.filtersOpen=false;App.render();};
  const chips = h('<div class="chips"></div>');
  const defs=[['filledOnly','Только заполненные'],['unfilledOnly','Без HEX'],['withComments','С комментарием'],['customOnly','Мои цвета'],['presetOnly','Предусстановленные']];
  defs.forEach(([k,label])=>{
    const c=h(`<button class="chip ${ColorFilters[k]?'on':''}">${label}</button>`);
    c.onclick=()=>{ColorFilters[k]=!ColorFilters[k];App.render();};
    chips.appendChild(c);
  });
  fp.appendChild(chips);
  return fp;
}
