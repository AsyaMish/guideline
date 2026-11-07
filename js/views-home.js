/* Главный экран «Мои проекты» + создание проекта */

const HomeFilters = {
  open:false,
  queryShown:false,
  query:'',
  versions:{desktop:false,tablet:false,mobile:false},
  dateFrom:'', dateTo:'',
  brokenOnly:false,
  reset(){ this.query=''; this.versions={desktop:false,tablet:false,mobile:false}; this.dateFrom=''; this.dateTo=''; this.brokenOnly=false; },
};

function renderHome(){
  const scr = h('<div class="screen"></div>');

  // Панель фильтров (сворачиваемая)
  if(HomeFilters.open){
    const fp = h(`<div class="card filters-panel"><h3>Фильтры <button class="iconbtn" data-x="close">${ICONS.close}</button></h3></div>`);
    fp.querySelector('[data-x=close]').onclick=()=>{HomeFilters.open=false;App.render();};

    const g1 = h(`<div class="filter-group"><label>По дате изменения</label><div class="inline-fields">
      <div class="field"><label>С</label><input type="date" class="input" value="${HomeFilters.dateFrom}" data-x="from"></div>
      <div class="field"><label>По</label><input type="date" class="input" value="${HomeFilters.dateTo}" data-x="to"></div></div></div>`);
    g1.querySelector('[data-x=from]').onchange=e=>{HomeFilters.dateFrom=e.target.value;App.render();};
    g1.querySelector('[data-x=to]').onchange=e=>{HomeFilters.dateTo=e.target.value;App.render();};
    fp.appendChild(g1);

    const g2 = h(`<div class="filter-group"><label>По меткам версий</label><div class="chips"></div></div>`);
    const chips = g2.querySelector('.chips');
    VERSIONS.forEach(v=>{
      const c = h(`<button class="chip ${HomeFilters.versions[v]?'on':''}">${SHORT_VERSION_LABELS[v]}</button>`);
      c.onclick=()=>{HomeFilters.versions[v]=!HomeFilters.versions[v];App.render();};
      chips.appendChild(c);
    });
    fp.appendChild(g2);

    const g3 = h(`<div class="filter-group"><label>Разорванные связи</label></div>`);
    const chkB = h(`<label class="chk"><input type="checkbox" ${HomeFilters.brokenOnly?'checked':''}> Есть разорванные связи</label>`);
    chkB.querySelector('input').onchange=e=>{HomeFilters.brokenOnly=e.target.checked;App.render();};
    g3.appendChild(chkB);
    fp.appendChild(g3);

    const anyActive = HomeFilters.query||HomeFilters.dateFrom||HomeFilters.dateTo||HomeFilters.brokenOnly||Object.values(HomeFilters.versions).some(Boolean);
    if(anyActive){
      const rst = h('<button class="btn btn-sm">Сбросить фильтры</button>');
      rst.onclick=()=>{HomeFilters.reset();App.render();};
      fp.appendChild(rst);
    }
    scr.appendChild(fp);
  }

  // Поиск
  if(HomeFilters.queryShown){
    const sb = h(`<div class="searchbar">${ICONS.search}<input placeholder="Поиск по названию и описанию"><button class="iconbtn" data-x="x">${ICONS.close}</button></div>`);
    const inp = sb.querySelector('input');
    inp.value = HomeFilters.query;
    inp.oninput = ()=>{ HomeFilters.query = inp.value; App.rerenderList(); };
    sb.querySelector('[data-x=x]').onclick=()=>{HomeFilters.queryShown=false;HomeFilters.query='';App.render();};
    setTimeout(()=>inp.focus(),10);
    scr.appendChild(sb);
  }

  const list = filteredProjects();
  const total = Store.state.projects.length;

  if(total===0){
    const es = h(`<div class="empty-state">${ICONS.folderPlus}<div style="font-size:16px;font-weight:600;color:var(--text)">Пока нет проектов</div>
      <div style="margin:8px 0 18px">Создайте первый проект</div></div>`);
    const b = h('<button class="btn btn-primary">Создать проект</button>');
    b.onclick=()=>openCreateProject(App.render);
    es.appendChild(b);
    scr.appendChild(es);
  }else if(!list.length){
    scr.appendChild(h(`<div class="empty-state">${ICONS.search}<div>Проектов по данным параметрам не найдено</div></div>`));
  }else{
    const card = h('<div class="card" id="project-list"></div>');
    list.forEach(p=>card.appendChild(projectRow(p)));
    scr.appendChild(card);
  }
  return scr;
}

function filteredProjects(){
  let arr = Store.state.projects.slice();
  const q = HomeFilters.query.trim().toLowerCase();
  if(q) arr = arr.filter(p=>(p.name+' '+p.description).toLowerCase().includes(q));
  if(HomeFilters.dateFrom) arr = arr.filter(p=>p.updatedAt >= new Date(HomeFilters.dateFrom+'T00:00:00').toISOString());
  if(HomeFilters.dateTo) arr = arr.filter(p=>p.updatedAt <= new Date(HomeFilters.dateTo+'T23:59:59').toISOString());
  const selVers = VERSIONS.filter(v=>HomeFilters.versions[v]);
  if(selVers.length) arr = arr.filter(p=>selVers.every(v=>versionHasData(p,v)));
  if(HomeFilters.brokenOnly) arr = arr.filter(p=>findBrokenLinks(p).length>0);
  arr.sort((a,b)=> (b.updatedAt||'').localeCompare(a.updatedAt||''));
  return arr;
}

function projectRow(p){
  const row = h('<div class="row-item"></div>');
  const main = h('<div class="row-main"></div>');
  const titleWrap = h(`<div class="row-title">${esc(p.name)}</div>`);
  // Метки версий — только заполненные
  VERSIONS.forEach(v=>{
    if(versionHasData(p,v)) titleWrap.appendChild(h(`<span class="pill">${SHORT_VERSION_LABELS[v]}</span>`));
  });
  const brokenN = findBrokenLinks(p).length;
  if(brokenN) titleWrap.appendChild(h(`<span class="badge-broken" title="Разорванные связи: ${brokenN}">${ICONS.linkBroken}</span>`));
  main.appendChild(titleWrap);
  main.appendChild(h(`<div class="row-sub">${esc(p.description)||'<span class="muted">без описания</span>'} · ${fmtDate(p.updatedAt)}</div>`));
  row.appendChild(main);

  const gear = h(`<button class="iconbtn" title="Действия">${ICONS.gear}</button>`);
  gear.onclick = e=>{ e.stopPropagation(); openProjectMenu(e.currentTarget, p); };
  row.appendChild(gear);

  row.onclick = ()=> App.navigate('toc',{projectId:p.id});
  return row;
}

function openProjectMenu(anchor, project){
  document.querySelectorAll('.menu').forEach(m=>m.remove());
  const menu = h(`<div class="menu">
    <button data-x="dup">${ICONS.copy} Дублировать</button>
    <button data-x="exp">${ICONS.download} Экспорт</button>
    <button data-x="del" class="danger">${ICONS.trash} Удалить</button>
  </div>`);
  const wrap = anchor.closest('.topbar,.bottombar,.screen') || document.body;
  wrap.style.position = wrap.style.position||'relative';
  wrap.appendChild(menu);
  const close=()=>menu.remove();
  setTimeout(()=>document.addEventListener('click', close, {once:true}),0);
  menu.querySelector('[data-x=dup]').onclick=()=>{
    close();
    const copy = Store.duplicateProject(project);
    toast('Создана копия: '+copy.name); App.render();
  };
  menu.querySelector('[data-x=exp]').onclick=()=>{ close(); App.navigate('export',{projectId:project.id}); };
  menu.querySelector('[data-x=del]').onclick=async ()=>{
    close();
    const ok = await confirmDialog({title:'Удалить проект?', text:`«${project.name}» будет удалён безвозвратно.`, danger:true, okLabel:'Удалить'});
    if(ok){ Store.deleteProject(project.id); toast('Проект удалён'); App.render(); }
  };
}

/* Форма создания проекта */
function openCreateProject(onCreated){
  const m = h(`<div class="modal"><h3>Новый проект</h3>
    <div class="field"><label>Название *</label><input class="input" id="np-name" placeholder="Например: Лендинг кофейни"></div>
    <div class="field"><label>Краткое описание</label><input class="input" id="np-desc" placeholder="Пара слов о проекте"></div>
    <div class="modal-actions">
      <button class="btn" data-x="cancel">Отмена</button>
      <button class="btn btn-primary" data-x="create">Создать</button>
    </div></div>`);
  const nameInp = m.querySelector('#np-name');
  const descInp = m.querySelector('#np-desc');
  m.querySelector('[data-x=cancel]').onclick=closeModal;
  const create=()=>{
    const nm = nameInp.value.trim();
    if(!nm){ toast('Введите название проекта'); nameInp.focus(); return; }
    const p = Store.addProject(nm, descInp.value.trim());
    closeModal();
    if(onCreated) onCreated(p);
    else App.replace('toc',{projectId:p.id}); // по умолчанию — сразу открываем содержание нового проекта
  };
  m.querySelector('[data-x=create]').onclick=create;
  nameInp.addEventListener('keydown',e=>{if(e.key==='Enter')create();});
  openModal(m);
  setTimeout(()=>nameInp.focus(),50);
}
