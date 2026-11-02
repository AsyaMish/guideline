/* Экран «Настройки»: тема + импорт CSV/JSON */

function renderSettings(params){
  const scr=h('<div class="screen"></div>');

  // Тема
  const themeCard=h('<div class="card section-gap" style="padding:16px"></div>');
  themeCard.appendChild(h('<h3 style="margin:0 0 10px">Тема оформления</h3>'));
  const chips=h('<div class="chips"></div>');
  [['system','Системная'],['light','Светлая'],['dark','Тёмная']].forEach(([k,l])=>{
    const c=h(`<button class="chip ${Store.state.settings.theme===k?'on':''}">${l}</button>`);
    c.onclick=()=>{ Store.state.settings.theme=k; Store.save(); App.applyTheme(); App.render(); };
    chips.appendChild(c);
  });
  themeCard.appendChild(chips);
  scr.appendChild(themeCard);

  // Импорт
  const impCard=h('<div class="card section-gap" style="padding:16px"></div>');
  impCard.appendChild(h('<h3 style="margin:0 0 6px">Импорт данных</h3>'));
  impCard.appendChild(h('<div class="hint" style="margin-bottom:12px">Можно загрузить CSV или JSON, выгруженные из этого приложения. Совпадающие поля сливаются по правилам: остаётся более свежее по дате изменения; пустые значения в файле не затирают заполненные.</div>'));

  const btnRow=h('<div style="display:flex;gap:10px;flex-wrap:wrap"></div>');
  const csvBtn=h(`<button class="btn">${ICONS.upload} Импорт CSV</button>`);
  const jsonBtn=h(`<button class="btn">${ICONS.upload} Импорт JSON</button>`);
  btnRow.appendChild(csvBtn); btnRow.appendChild(jsonBtn);
  impCard.appendChild(btnRow);

  const fileInp=h('<input type="file" accept=".csv,text/csv" style="display:none">');
  const jsonInp=h('<input type="file" accept=".json,application/json" style="display:none">');
  impCard.appendChild(fileInp); impCard.appendChild(jsonInp);
  csvBtn.onclick=()=>fileInp.click();
  jsonBtn.onclick=()=>jsonInp.click();
  fileInp.onchange=()=>{ if(fileInp.files[0]) importCSVFile(fileInp.files[0]); fileInp.value=''; };
  jsonInp.onchange=()=>{ if(jsonInp.files[0]) importJSONFile(jsonInp.files[0]); jsonInp.value=''; };
  scr.appendChild(impCard);

  // Экспорт всей базы
  const dbCard=h('<div class="card section-gap" style="padding:16px"></div>');
  dbCard.appendChild(h('<h3 style="margin:0 0 10px">Резервная копия</h3>'));
  const bAll=h(`<button class="btn">${ICONS.download} Выгрузить все проекты в JSON</button>`);
  bAll.onclick=()=>{ downloadText('guidelines-backup.json', databaseToJSON(Store.state), 'application/json'); toast('Резервная копия сохранена'); };
  dbCard.appendChild(bAll);
  scr.appendChild(dbCard);

  // О приложении
  const about=h('<div class="card section-gap" style="padding:16px"></div>');
  about.appendChild(h(`<h3 style="margin:0 0 6px">О приложении</h3>
    <div class="muted small">Гайдлайны проектов · версия ${APP_VERSION}. Все данные хранятся локально в браузере (localStorage) и не покидают устройство. Работает оффлайн.</div>`));
  scr.appendChild(about);

  return scr;
}

function importCSVFile(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const rows=parseCSV(String(reader.result));
      if(!rows.length){ toast('В файле нет данных для импорта'); return; }
      openImportTargetDialog((targetProject, strategy)=>{
        let patched = csvToProjectPatch(rows, targetProject);
        if(strategy==='merge') patched = mergeProject(targetProject, patched);
        else { /* replace: патч построен на базе, но «полная замена» для CSV = то же, что merge без дат — оставляем как есть */ }
        Store.state.projects = Store.state.projects.map(p=>p.id===patched.id?patched:p);
        Store.save(); toast('Импорт CSV завершён'); App.render();
      });
    }catch(e){ console.error(e); toast('Не удалось прочитать CSV: '+e.message); }
  };
  reader.readAsText(file,'UTF-8');
}

function importJSONFile(file){
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=parseJSONFile(String(reader.result));
      const projects=(data.projects||[]).map(p=>{ migrateProject(p); return p; });
      if(!projects.length){ toast('В JSON нет проектов'); return; }
      openImportStrategyDialog(projects.length, (strategy)=>{
        if(strategy==='merge'){
          const merged=mergeDatabase(Store.state, {projects});
          Store.replaceAllProjects(merged.projects);
        }else if(strategy==='replace'){
          const replaced=replaceDatabase(Store.state,{projects});
          Store.replaceAllProjects(replaced.projects);
        }else{ // new
          projects.forEach(p=>{ p.id=uid('p'); Store.state.projects.unshift(p); });
          Store.save();
        }
        toast('Импорт JSON завершён'); App.render();
      });
    }catch(e){ console.error(e); toast('Не удалось прочитать JSON: '+e.message); }
  };
  reader.readAsText(file,'UTF-8');
}

/* Куда импортировать CSV — выбор проекта */
function openImportTargetDialog(cb){
  const m=h(`<div class="modal"><h3>Куда импортировать?</h3>
    <div class="field"><label>Проект</label><select class="input" id="it-proj"></select></div>
    <div class="modal-actions"><button class="btn" data-x="c">Отмена</button><button class="btn btn-primary" data-x="ok">Импортировать</button></div></div>`);
  const sel=m.querySelector('#it-proj');
  Store.state.projects.forEach(p=>sel.appendChild(h(`<option value="${p.id}">${esc(p.name)}</option>`)));
  if(!Store.state.projects.length){
    m.querySelector('.modal').innerHTML='<h3>Нет проектов</h3><div class="muted">Сначала создайте проект на главном экране.</div>';
    openModal(m); return;
  }
  m.querySelector('[data-x=c]').onclick=closeModal;
  m.querySelector('[data-x=ok]').onclick=()=>{
    const p=Store.getProject(sel.value);
    closeModal();
    cb(p,'merge');
  };
  openModal(m);
}

/* Стратегия импорта JSON (п. 2.6) */
function openImportStrategyDialog(count, cb){
  const m=h(`<div class="modal"><h3>Стратегия импорта</h3>
    <div class="muted small" style="margin-bottom:12px">Файл содержит проектов: ${count}. Как поступить с совпадающими по идентификатору проектами?</div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <button class="btn btn-block btn-primary" data-x="merge">Слить</button>
      <div class="hint">Поля с совпадающими названиями объединяются: остаётся более свежее по дате изменения. Пустые значения в импорте не затирают заполненные. Новые элементы добавляются.</div>
      <button class="btn btn-block" data-x="replace">Заменить</button>
      <div class="hint">Данные текущей базы полностью замещаются данными из файла.</div>
      <button class="btn btn-block" data-x="new">Добавить как новые</button>
      <div class="hint">Проекты из файла добавляются отдельными сущностями.</div>
    </div>
    <div class="modal-actions"><button class="btn" data-x="c">Отмена</button></div></div>`);
  m.querySelector('[data-x=c]').onclick=closeModal;
  m.querySelector('[data-x=merge]').onclick=()=>{closeModal();cb('merge');};
  m.querySelector('[data-x=replace]').onclick=async ()=>{
    const ok=await confirmDialog({title:'Заменить базу?',text:'Текущие проекты будут перезаписаны данными из файла.',danger:true,okLabel:'Заменить'});
    if(ok){cb('replace');}
  };
  m.querySelector('[data-x=new]').onclick=()=>{closeModal();cb('new');};
  openModal(m);
}
