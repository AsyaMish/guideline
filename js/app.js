/* Роутер и каркас приложения */

/* ===== Персистентность состояния (переживание перезагрузки страницы) ===== */
const UI_STATE_KEY='guidelines-app-ui-v1';

function loadUIState(){
  try{ return JSON.parse(localStorage.getItem(UI_STATE_KEY)||'null'); }catch(e){ return null; }
}
function persistRoute(){
  try{ localStorage.setItem(UI_STATE_KEY, JSON.stringify({route:App.state.route, params:App.state.params})); }
  catch(e){ /* игнорируем */ }
}
window.addEventListener('beforeunload', ()=>{ Store.flush(); });

const App = {
  state: { route:'home', params:{}, filtersOpen:false, spacingTab:'items', stack:[] },
  project: null, // convenience for views that reference App.project

  navigate(route, params={}){
    this.state.stack.push({route:this.state.route, params:this.state.params});
    this.state.route=route; this.state.params=params;
    this.filtersOpenCleanup(route);
    persistRoute();
    this.render();
    window.scrollTo(0,0);
  },
  replace(route, params={}){
    // переход без добавления в историю «назад» (используется после создания проекта)
    this.state.route=route; this.state.params=params;
    this.filtersOpenCleanup(route);
    persistRoute();
    this.render();
    window.scrollTo(0,0);
  },
  back(){
    const prev=this.state.stack.pop();
    if(prev){ this.state.route=prev.route; this.state.params=prev.params; }
    else this.state.route='home';
    persistRoute();
    this.render();
  },
  goBackOr(fallbackRoute){
    if(this.state.stack.length) this.back();
    else this.navigate(fallbackRoute||'home');
  },
  filtersOpenCleanup(route){ /* no-op */ },

  toggleFilters(){
    this.state.filtersOpen=!this.state.filtersOpen;
    this.render();
  },

  applyTheme(){
    const t=Store.state.settings.theme||'system';
    let dark=false;
    if(t==='dark') dark=true;
    else if(t==='system') dark=window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', dark?'dark':'light');
  },

  gotoCreateLinked(kind){
    // Переход в раздел для добавления нового значения (кнопка «+» у ссылок)
    const secMap={color:'colors',typo:'typography',radius:'radius',shadow:'shadows'};
    const sectionId=secMap[kind];
    if(!this.project) return;
    this.navigate('section',{projectId:this.project.id, sectionId, quickAdd:kind});
  },

  render(){
    closeModal();
    const app=document.getElementById('app');
    app.innerHTML='';
    const {route,params}=this.state;

    if(route==='home'){
      this.project=null;
      app.appendChild(topBar('Гайдлайны проектов',{settings:true}));
      app.appendChild(renderHome());
      const bar=h('<div class="bottombar"></div>');
      const searchBtn=h(`<button class="iconbtn" title="Поиск">${ICONS.search}</button>`);
      searchBtn.onclick=()=>{HomeFilters.queryShown=true;App.render();setTimeout(()=>{const i=document.querySelector('.searchbar input');i&&i.focus();},20);};
      const fab=h(`<button class="fab" title="Создать проект">${ICONS.plus}</button>`);
      fab.onclick=()=>openCreateProject(p=>App.navigate('toc',{projectId:p.id}));
      const filterBtn=h(`<button class="iconbtn ${HomeFilters.open?'active':''}" title="Фильтры">${ICONS.filter}</button>`);
      filterBtn.onclick=()=>{HomeFilters.open=!HomeFilters.open;App.render();};
      bar.appendChild(searchBtn); bar.appendChild(filterBtn); bar.appendChild(fab);
      app.appendChild(bar);
      return;
    }

    const project=Store.getProject(params.projectId);
    if(!project){ this.navigate('home'); return; }
    this.project=project;

    if(route==='toc'){
      app.appendChild(topBar(project.name,{back:()=>this.goBackOr('home'),settings:true}));
      app.appendChild(renderTOC(params));
      const center=versionSwitcherDisabled();
      const bar=h('<div class="bottombar"></div>');
      const searchBtn=h(`<button class="iconbtn" title="Поиск по пунктам">${ICONS.search}</button>`);
      searchBtn.onclick=()=>{TOCFilters.queryShown=true;App.render();setTimeout(()=>{const i=document.querySelector('.searchbar input');i&&i.focus();},20);};
      const expBtn=h(`<button class="iconbtn" title="Экспорт">${ICONS.download}</button>`);
      expBtn.onclick=()=>this.navigate('export',{projectId:project.id});
      const filterBtn=h(`<button class="iconbtn ${TOCFilters.open?'active':''}" title="Фильтры">${ICONS.filter}</button>`);
      filterBtn.onclick=()=>{TOCFilters.open=!TOCFilters.open;App.render();};
      const grp=h('<div style="display:flex;gap:6px;align-items:center"></div>');
      grp.appendChild(searchBtn);grp.appendChild(filterBtn);grp.appendChild(expBtn);
      bar.appendChild(h('<span></span>')); bar.appendChild(grp); bar.appendChild(h('<span></span>'));
      app.appendChild(bar);
      return;
    }

    if(route==='export'){
      app.appendChild(topBar('Экспорт проекта',{back:()=>this.goBackOr('toc'),settings:true}));
      app.appendChild(renderExport(project,params));
      app.appendChild(emptyBottom());
      return;
    }

    if(route==='section'){
      const sec=SECTIONS.find(s=>s.id===params.sectionId)||SECTIONS[0];
      app.appendChild(topBar(sec.title,{back:()=>this.goBackOr('toc'),settings:true}));

      // Панель фильтров раздела
      if(this.state.filtersOpen){
        const panel=sectionFilterPanel(sec.id);
        if(panel) app.appendChild(panel);
      }

      const screenWrap=h('<div style="flex:1;display:flex;flex-direction:column"></div>');
      // Переключатель версий (кроме сквозных разделов)
      if(!sec.crossVersion){
        const vw=h('<div class="screen" style="padding-bottom:0;flex:none"></div>');
        const seg=versionSwitcher(project, ()=>App.render());
        const wrap=h('<div class="seg-wrap"></div>');
        wrap.appendChild(seg);
        vw.appendChild(wrap);
        screenWrap.appendChild(vw);
      }
      screenWrap.appendChild(renderSection(project,sec,params));
      app.appendChild(screenWrap);

      // Нижняя панель: поиск / добавить / фильтры
      const bar=h('<div class="bottombar"></div>');
      const searchBtn=h(`<button class="iconbtn" title="Поиск">${ICONS.search}</button>`);
      searchBtn.onclick=()=>{toggleSectionSearch(sec.id);App.render();};
      const addFab=h(`<button class="fab" title="Добавить">${ICONS.plus}</button>`);
      addFab.onclick=()=>sectionQuickAdd(project,sec.id);
      const filterBtn=h(`<button class="iconbtn ${this.state.filtersOpen?'active':''}" title="Фильтры">${ICONS.filter}</button>`);
      filterBtn.onclick=()=>this.toggleFilters();
      bar.appendChild(searchBtn);
      const mid=h('<div style="display:flex;gap:6px;align-items:center"></div>');
      mid.appendChild(filterBtn);
      bar.appendChild(mid);
      bar.appendChild(addFab);
      app.appendChild(bar);

      // Быстрый переход к фокусному элементу
      setTimeout(()=>{
        if(params.focusItem){
          const el=document.querySelector('[data-cid="'+params.focusItem+'"],[data-tid="'+params.focusItem+'"],[data-bid="'+params.focusItem+'"],[data-iid="'+params.focusItem+'"],[data-rid="'+params.focusItem+'"],[data-shid="'+params.focusItem+'"],[data-spid="'+params.focusItem+'"]');
          if(el){ el.classList.add('open'); const b=el.querySelector('.item-body'); if(b)b.style.display='block'; el.scrollIntoView({behavior:'smooth',block:'center'}); }
        }
        if(params.quickAdd){
          sectionQuickAdd(project, sec.id);
        }
      },80);
      return;
    }

    if(route==='settings'){
      app.appendChild(topBar('Настройки',{back:()=>this.goBackOr('home'),settings:false}));
      app.appendChild(renderSettings(params));
      app.appendChild(emptyBottom());
      return;
    }

    // fallback
    this.navigate('home');
  },

  rerenderList(){
    // точечная перерисовка списка без потери фокуса поиска: просто перерендериваем весь экран
    // (поле поиска пересоздаётся с сохранением значения и фокуса)
    const active=document.activeElement;
    const wasSearch = active && active.closest && active.closest('.searchbar');
    const val = wasSearch? active.value : '';
    const selStart = wasSearch? active.selectionStart : 0;
    this.render();
    if(wasSearch){
      const inp=document.querySelector('.searchbar input');
      if(inp){ inp.focus(); try{inp.setSelectionRange(selStart,selStart);}catch(e){} void val; }
    }
  },
};

function versionSwitcherDisabled(){ return null; }
function emptyBottom(){ const b=h('<div class="bottombar"></div>'); b.appendChild(h('<span></span>'));b.appendChild(h('<span></span>'));b.appendChild(h('<span></span>')); return b; }

function renderSection(project,sec,params){
  switch(sec.id){
    case 'colors': return renderColors(project,params);
    case 'typography': return renderTypography(project,params);
    case 'buttons': return renderButtons(project,params);
    case 'inputs': return renderInputs(project,params);
    case 'radius': return renderRadius(project,params);
    case 'shadows': return renderShadows(project,params);
    case 'spacing': return renderSpacing(project,params);
  }
  return h('<div class="screen"></div>');
}

function sectionFilterPanel(sectionId){
  switch(sectionId){
    case 'colors': return colorsFilterPanel();
    case 'typography': return typographyFilterPanel();
    case 'buttons': return buttonsFilterPanel();
    case 'inputs': return inputsFilterPanel();
    case 'radius': return radiusFilterPanel();
    case 'shadows': return shadowsFilterPanel();
    case 'spacing': return spacingFilterPanel();
  }
  return null;
}

function toggleSectionSearch(sectionId){
  const map={colors:ColorFilters,typography:TypoFilters,buttons:BtnFilters,inputs:InputFilters,radius:RadiusFilters,shadows:ShadowFilters,spacing:SpacingFilters};
  const f=map[sectionId]; if(f) f.queryShown=true;
}

function sectionQuickAdd(project,sectionId){
  switch(sectionId){
    case 'colors': quickAddColor(project); break;
    case 'typography': {
      // добавить стиль в первую видимую группу — спрашиваем
      const m=h(`<div class="modal"><h3>Новый стиль типографики</h3><div class="field"><label>Группа</label><select class="input" id="qa-g">${TYPO_GROUPS.map(g=>`<option value="${g.key}">${g.label}</option>`).join('')}</select></div>
        <div class="modal-actions"><button class="btn" data-x="c">Отмена</button><button class="btn btn-primary" data-x="a">Добавить</button></div></div>`);
      m.querySelector('[data-x=c]').onclick=closeModal;
      m.querySelector('[data-x=a]').onclick=()=>{
        const gk=m.querySelector('#qa-g').value;
        const g=TYPO_GROUPS.find(x=>x.key===gk);
        let i=1; while(project.sections.typography.items.some(x=>x.group===gk&&x.name===g.prefix+i)) i++;
        const t=makeTypoItem(gk,g.prefix+i); t.preset=false; t.locked=false;
        project.sections.typography.items.push(t); Store.save(); closeModal(); toast('Стиль добавлен'); App.render();
      };
      openModal(m);
      break;
    }
    case 'buttons': {
      const m=h(`<div class="modal"><h3>Новая ячейка кнопки</h3>
        <div class="field"><label>Стиль</label><select class="input" id="qa-bs">${BUTTON_STYLES.map(s=>`<option value="${s.key}">${s.label}</option>`).join('')}</select></div>
        <div class="field"><label>Размер</label><select class="input" id="qa-bz">${BUTTON_SIZE_ORDER.map(s=>`<option>${s}</option>`).join('')}</select></div>
        <div class="modal-actions"><button class="btn" data-x="c">Отмена</button><button class="btn btn-primary" data-x="a">Добавить</button></div></div>`);
      m.querySelector('[data-x=c]').onclick=closeModal;
      m.querySelector('[data-x=a]').onclick=()=>{
        const st=m.querySelector('#qa-bs').value, sz=m.querySelector('#qa-bz').value;
        if(project.sections.buttons.some(b=>b.style===st&&b.size===sz)){toast('Уже есть');return;}
        project.sections.buttons.push(makeButtonCell(st,sz)); Store.save(); closeModal(); toast('Ячейка добавлена'); App.render();
      };
      openModal(m);
      break;
    }
    case 'inputs': {
      const m=h(`<div class="modal"><h3>Новое поле ввода</h3>
        <div class="field"><label>Размер</label><select class="input" id="qa-is">${INPUT_SIZE_ORDER.map(s=>`<option>${s}</option>`).join('')}</select></div>
        <div class="modal-actions"><button class="btn" data-x="c">Отмена</button><button class="btn btn-primary" data-x="a">Добавить</button></div></div>`);
      m.querySelector('[data-x=c]').onclick=closeModal;
      m.querySelector('[data-x=a]').onclick=()=>{
        const sz=m.querySelector('#qa-is').value;
        if(project.sections.inputs.some(f=>f.size===sz)){toast('Уже есть');return;}
        project.sections.inputs.push(makeInputField(sz)); Store.save(); closeModal(); toast('Поле добавлено'); App.render();
      };
      openModal(m);
      break;
    }
    case 'radius': {
      const m=h(`<div class="modal"><h3>Новое скругление</h3><div class="field"><label>Название</label><input class="input" id="qa-rn"></div>
        <div class="modal-actions"><button class="btn" data-x="c">Отмена</button><button class="btn btn-primary" data-x="a">Добавить</button></div></div>`);
      m.querySelector('[data-x=c]').onclick=closeModal;
      m.querySelector('[data-x=a]').onclick=()=>{
        const nm=m.querySelector('#qa-rn').value.trim();
        if(!nm){toast('Введите название');return;}
        if(project.sections.radius.some(r=>r.name.toLowerCase()===nm.toLowerCase())){toast('Дубликат');return;}
        const r=makeRadiusItem(nm); r.locked=false;
        project.sections.radius.push(r); Store.save(); closeModal(); toast('Добавлено'); App.render();
      };
      openModal(m); setTimeout(()=>m.querySelector('#qa-rn').focus(),50);
      break;
    }
    case 'shadows': {
      const m=h(`<div class="modal"><h3>Новая тень</h3><div class="field"><label>Название</label><input class="input" id="qa-sn"></div>
        <div class="modal-actions"><button class="btn" data-x="c">Отмена</button><button class="btn btn-primary" data-x="a">Добавить</button></div></div>`);
      m.querySelector('[data-x=c]').onclick=closeModal;
      m.querySelector('[data-x=a]').onclick=()=>{
        const nm=m.querySelector('#qa-sn').value.trim();
        if(!nm){toast('Введите название');return;}
        if(project.sections.shadows.some(s=>s.name.toLowerCase()===nm.toLowerCase())){toast('Дубликат');return;}
        const sh=makeShadowItem(nm); sh.locked=false;
        project.sections.shadows.push(sh); Store.save(); closeModal(); toast('Добавлено'); App.render();
      };
      openModal(m); setTimeout(()=>m.querySelector('#qa-sn').focus(),50);
      break;
    }
    case 'spacing': {
      const m=h(`<div class="modal"><h3>Новый тип отступа</h3><div class="field"><label>Название</label><input class="input" id="qa-sp"></div>
        <div class="modal-actions"><button class="btn" data-x="c">Отмена</button><button class="btn btn-primary" data-x="a">Добавить</button></div></div>`);
      m.querySelector('[data-x=c]').onclick=closeModal;
      m.querySelector('[data-x=a]').onclick=()=>{
        const nm=m.querySelector('#qa-sp').value.trim();
        if(!nm){toast('Введите название');return;}
        if(project.sections.spacing.items.some(s=>s.name.toLowerCase()===nm.toLowerCase())){toast('Дубликат');return;}
        const sp=makeSpacingItem(nm); sp.locked=false;
        project.sections.spacing.items.push(sp); Store.save(); closeModal(); toast('Добавлено'); App.render();
      };
      openModal(m); setTimeout(()=>m.querySelector('#qa-sp').focus(),50);
      break;
    }
  }
}

/* Старт */
window.addEventListener('DOMContentLoaded', ()=>{
  Store.load();
  TocUI.load();
  App.applyTheme();
  if(window.matchMedia){
    const mq=window.matchMedia('(prefers-color-scheme: dark)');
    const listener=()=>{ if((Store.state.settings.theme||'system')==='system') App.applyTheme(); };
    if(mq.addEventListener) mq.addEventListener('change',listener); else if(mq.addListener) mq.addListener(listener);
  }
  // Восстановление экрана после перезагрузки (данные уже в localStorage — ничего не теряется)
  const saved=loadUIState();
  if(saved && saved.route){
    const validProject = saved.params && saved.params.projectId ? !!Store.getProject(saved.params.projectId) : !saved.params?.projectId;
    if(validProject && ['home','toc','section','export','settings'].includes(saved.route)){
      // одноразовые флаги не восстанавливаем, чтобы после перезагрузки не всплывали модалки
      const params=Object.assign({}, saved.params); delete params.quickAdd;
      App.state.route=saved.route; App.state.params=params;
    }
  }
  App.render();

  // Синхронизация между вкладками: если данные изменились в другой вкладке — подтягиваем и перерисовываем
  window.addEventListener('storage', e=>{
    if(e.key===STORAGE_KEY && Store._saveTimer==null){
      Store.load();
      App.applyTheme();
      App.render();
    }
  });
});
