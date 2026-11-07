/* Экран «Содержание» проекта */

const TOCFilters = { open:false, queryShown:false, query:'', versions:{desktop:false,tablet:false,mobile:false}, filledOnly:false, brokenOnly:false,
  reset(){ this.query=''; this.versions={desktop:false,tablet:false,mobile:false}; this.filledOnly=false; this.brokenOnly=false; } };

function renderTOC(params){
  const project = Store.getProject(params.projectId);
  if(!project){ App.navigate('home'); return h('<div class="screen"></div>'); }

  const scr = h('<div class="screen"></div>');

  // Мета-карточка проекта (редактируемые поля)
  const meta = h('<div class="card project-meta"></div>');
  const mName = h(`<input class="input" value="${esc(project.name)}" style="font-size:17px;font-weight:650;border:none;background:transparent;padding:4px 0;">`);
  mName.addEventListener('change',()=>{ project.name=mName.value.trim()||'Без названия'; Store.touchProject(project); });
  const mDesc = h(`<textarea class="input" placeholder="Краткое описание" style="min-height:38px;margin-top:6px;">${esc(project.description)}</textarea>`);
  mDesc.addEventListener('change',()=>{ project.description=mDesc.value; Store.touchProject(project); });
  meta.appendChild(mName); meta.appendChild(mDesc);
  meta.appendChild(h(`<div class="hint">Изменён: ${fmtDate(project.updatedAt)}</div>`));
  scr.appendChild(meta);

  // Поиск по пунктам
  if(TOCFilters.queryShown){
    const sb = h(`<div class="searchbar">${ICONS.search}<input placeholder="Поиск по разделам и пунктам"><button class="iconbtn" data-x="x">${ICONS.close}</button></div>`);
    const inp=sb.querySelector('input'); inp.value=TOCFilters.query;
    inp.oninput=()=>{TOCFilters.query=inp.value; App.rerenderList();};
    sb.querySelector('[data-x=x]').onclick=()=>{TOCFilters.queryShown=false;TOCFilters.query='';App.render();};
    setTimeout(()=>inp.focus(),10);
    scr.appendChild(sb);
  }

  const card = h('<div class="card toc-card" id="toc-list"></div>');

  // Управление сворачиванием разделов (по умолчанию все свёрнуты)
  if(SECTIONS.length){
    const anyExpanded = SECTIONS.some(sec=>!TocUI.isCollapsed(sec.id));
    const toolbar = h('<div class="toc-toolbar"></div>');
    const toggleAll = h(`<button class="btn btn-sm">${anyExpanded ? ICONS.chevron+' Свернуть все' : ICONS.chevron+' Развернуть все'}</button>`);
    toggleAll.onclick=()=>{ TocUI.setAll(anyExpanded); App.render(); };
    toolbar.appendChild(toggleAll);
    card.appendChild(toolbar);
  }

  buildTOCRows(project).forEach(r=>card.appendChild(r));
  scr.appendChild(card);
  return scr;
}

function tocItemMatches(project, item, q){
  if(!q) return true;
  const hay = (item.name+' '+item.label+' '+(item.summary||'')+' '+JSON.stringify(item.extra||'')).toLowerCase();
  return hay.includes(q.toLowerCase());
}

function buildTOCRows(project){
  const rows=[];
  const selVers = VERSIONS.filter(v=>TOCFilters.versions[v]);
  const q = TOCFilters.query.trim();

  SECTIONS.forEach(sec=>{
    // фильтр по версии раздела
    if(selVers.length && !sec.crossVersion){
      const hasAny = selVers.some(v=>sectionHasData(project, sec.id, v));
      if(TOCFilters.versions[selVers[0]] && !hasAny && selVers.length===VERSIONS.length) { /* noop */ }
    }
    const items = sectionTOCItems(project, sec.id);
    const filteredItems = items.filter(it=>{
      if(q && !tocItemMatches(project,it,q)) return false;
      if(TOCFilters.filledOnly && !it.filled) return false;
      if(TOCFilters.brokenOnly && !(it.broken&&it.broken.length)) return false;
      if(selVers.length){
        const ok = selVers.every(v=> it.perVersion ? !!it.perVersion[v] : sectionHasData(project,sec.id,v));
        if(!ok) return false;
      }
      return true;
    });
    const brokenInSection = sectionBrokenLinks(project).filter(b=>b.sectionId===sec.id);
    if(TOCFilters.brokenOnly && !brokenInSection.length && !filteredItems.some(i=>i.broken&&i.broken.length)) return;

    // при активном поиске или фильтрах разделы принудительно разворачиваем, чтобы результаты были видны
    const filtersActive = q || TOCFilters.filledOnly || TOCFilters.brokenOnly || selVers.length;
    const collapsed = TocUI.isCollapsed(sec.id) && !filtersActive;

    // Заголовок раздела (кликабельный — сворачивает/разворачивает список пунктов)
    const head = h('<div class="row-item toc-head"></div>');
    head.style.background='var(--surface2)';
    const icon = h(`<span style="color:var(--accent);display:inline-flex;width:22px;height:22px">${ICONS[sec.icon]}</span>`);
    head.appendChild(icon);
    const titleWrap = h(`<div class="row-main"><div class="row-title">${esc(sec.title)}${collapsed&&filteredItems.length?` <span class="muted small" style="font-weight:500">· ${filteredItems.length}</span>`:''}</div></div>`);
    if(sectionHasData(project, sec.id, null)) titleWrap.querySelector('.row-title').appendChild(h(`<span class="check-ok" title="Есть данные">${ICONS.checkCircle}</span>`));
    if(brokenInSection.length) titleWrap.querySelector('.row-title').appendChild(h(`<span class="badge-broken" title="Разорванные связи">${ICONS.linkBroken}</span>`));
    head.appendChild(titleWrap);
    const chev = h(`<span class="chev ${collapsed?'':'open'}" style="display:inline-flex;color:var(--muted)">${ICONS.chevron}</span>`);
    head.appendChild(chev);
    const goSec = h(`<button class="iconbtn" title="Открыть раздел">${ICONS.right}</button>`);
    goSec.onclick=(e)=>{ e.stopPropagation(); App.navigate('section',{projectId:project.id, sectionId:sec.id}); };
    head.appendChild(goSec);
    head.onclick=()=>{ TocUI.toggle(sec.id); App.render(); };
    rows.push(head);

    if(!collapsed){
      filteredItems.forEach(it=>{
        const r = h('<div class="row-item" style="padding-left:28px"></div>');
        r.appendChild(h(`<div class="row-main">
          <div class="row-title">${esc(it.name)}
            ${(it.perVersion?Object.values(it.perVersion).some(Boolean):true)?'<span class="check-ok">'+ICONS.checkCircle+'</span>':''}
            ${(it.broken&&it.broken.length)?'<span class="badge-broken">'+ICONS.linkBroken+'</span>':''}
          </div>
          <div class="row-sub">${esc(it.summary||'')}</div></div>`));
        const b = h(`<button class="iconbtn">${ICONS.right}</button>`);
        r.onclick=()=>App.navigate('section',{projectId:project.id, sectionId:sec.id, focusItem:it.id});
        rows.push(r);
      });
    }
  });
  if(!rows.length) rows.push(h(`<div class="empty-state">${ICONS.search}<div>Ничего не найдено</div></div>`));
  return rows;
}

/* Пункты раздела для оглавления */
function sectionTOCItems(project, sectionId){
  const s = project.sections;
  switch(sectionId){
    case 'colors': return s.colors.map(c=>({
      id:c.id, name:c.name, summary:(c.hex||'без HEX')+(c.comment?' · '+c.comment:''),
      filled:!!(c.hex||c.comment), broken:[], perVersion:{desktop:true,tablet:true,mobile:true},
    }));
    case 'typography': {
      const prim = TYPO_PRIMARY_DEFAULTS.map(pd=>({
        id:'primary-'+pd.key, name:pd.label,
        summary:(s.typography.primary[pd.key]?.family||'не выбран')+' · '+(s.typography.primary[pd.key]?.weight||'—'),
        filled:!!(s.typography.primary[pd.key]?.family||s.typography.primary[pd.key]?.weight),
        broken:[], perVersion:{desktop:true,tablet:true,mobile:true},
      }));
      const items = s.typography.items.map(t=>{
        const e = effectiveTypo(project,t,'desktop');
        return {
          id:t.id, name:`${t.name} (${TYPO_GROUPS.find(g=>g.key===t.group)?.label})`,
          summary:[e.family||'шрифт не выбран', e.size&&(`${e.size}px`)].filter(Boolean).join(' · '),
          filled: !!(e.family||e.size||t.shared.weight),
          broken: findBrokenLinks(project).filter(b=>b.itemId===t.id),
          perVersion:Object.fromEntries(VERSIONS.map(v=>[v, versionHasTypo(project,t,v)])),
        };
      });
      return prim.concat(items);
    }
    case 'buttons': return s.buttons.map(b=>({
      id:b.id, name:`${buttonStyleLabel(b.style)} ${b.size}`,
      summary: buttonSummary(project,b),
      filled: sectionHasData(project,'buttons') ,
      broken: findBrokenLinks(project).filter(x=>x.itemId===b.id),
      perVersion:Object.fromEntries(VERSIONS.map(v=>[v, versionHasButton(project,b,v)])),
    }));
    case 'inputs': return s.inputs.map(f=>({
      id:f.id, name:`Поле ${f.size}`,
      summary: inputSummary(project,f),
      filled:true,
      broken: findBrokenLinks(project).filter(x=>x.itemId===f.id),
      perVersion:Object.fromEntries(VERSIONS.map(v=>[v, versionHasInput(project,f,v)])),
    }));
    case 'radius': return s.radius.map(r=>({
      id:r.id, name:r.name, summary: radiusSummary(r)||'не задано',
      filled: !!radiusSummary(r),
      broken: findBrokenLinks(project).filter(x=>x.itemId===r.id),
      perVersion:Object.fromEntries(VERSIONS.map(v=>[v, versionHasRadius(r,v)])),
    }));
    case 'shadows': return s.shadows.map(sh=>({
      id:sh.id, name:sh.name, summary: shadowSummaryText(project, sh),
      filled: sh.layers.some(l=>l.x||l.y||l.blur||l.spread||l.colorRef),
      broken: findBrokenLinks(project).filter(x=>x.itemId===sh.id),
      perVersion:{desktop:true,tablet:true,mobile:true},
    }));
    case 'spacing': {
      const items = s.spacing.items.map(sp=>({
        id:sp.id, name:sp.name, summary: spacingSummary(sp),
        filled: !!spacingSummary(sp),
        broken:[],
        perVersion:Object.fromEntries(VERSIONS.map(v=>[v, versionHasSpacing(sp,v)])),
      }));
      items.push({ id:'grid', name:'Сетка', summary: gridSummary(s.grid), filled: !!gridSummary(s.grid), broken:[],
        perVersion:Object.fromEntries(VERSIONS.map(v=>[v, versionHasGrid(s.grid,v)])) });
      return items;
    }
  }
  return [];
}

/* Помощники заполнения по версиям */
function versionHasTypo(project,t,v){
  const e=effectiveTypo(project,t,v);
  return !!(e.family||e.size||e.lineHeight||e.letterSpacing||t.shared.weight);
}
function versionHasButton(project,b,v){
  const pv=b.perVersion[v];
  const own = pv && (!pv.inherit || v==='desktop');
  const anyState = allButtonStates(b).some(st=>st.bgRef||st.borderColorRef||st.borderWidth||st.textColorRef);
  return !!(anyState || b.shared.typoRef || (own && (pv.height||pv.padV||pv.padH)));
}
function versionHasInput(project,f,v){
  const pv=f.perVersion[v];
  const own = pv && (!pv.inherit || v==='desktop');
  const anyState = allInputStates(f).some(st=>st.bgRef||st.textTypoRef||st.phTypoRef||st.borderColorRef||st.borderWidth);
  return !!(anyState || f.shared.labelTypoRef || (own && (pv.height||pv.padV||pv.padH)));
}
function versionHasRadius(r,v){
  const pv=versionValue(r,v,o=>o);
  return !!(pv.common||pv.tl||pv.tr||pv.br||pv.bl);
}
function versionHasSpacing(sp,v){ return !!versionValue(sp,v,o=>o).value; }
function versionHasGrid(g,v){
  const gv=g.perVersion[v];
  if(!gv) return false;
  if(v!=='desktop'&&gv.inherit) return false;
  return !!(gv.containerWidth||gv.columns||gv.gutter||gv.sideMargins||gv.maxContentWidth);
}
function spacingSummary(sp){
  const parts=VERSIONS.map(v=>{const val=versionValue(sp,v,o=>o).value; return val?`${SHORT_VERSION_LABELS[v]}: ${val}px`:null;}).filter(Boolean);
  return parts.join(' · ') + (sp.comment?(' · '+sp.comment):'');
}
function gridSummary(grid){
  const parts=VERSIONS.map(v=>{
    const g=grid.perVersion[v]; if(!g||(v!=='desktop'&&g.inherit)) return null;
    const s=[g.containerWidth&&(`контейнер ${g.containerWidth}`),g.columns&&(`${g.columns} кол.`),g.gutter&&(`gutter ${g.gutter}`)].filter(Boolean).join(', ');
    return s?`${SHORT_VERSION_LABELS[v]}: ${s}`:null;
  }).filter(Boolean);
  return parts.join(' · ');
}
function buttonSummary(project,b){
  const st=b.states.normal;
  const bits=[];
  const bg=st&&st.bgRef?resolveColorRef(project,st.bgRef):null;
  if(bg) bits.push('фон: '+(bg.hex||bg.name));
  const typo=b.shared.typoRef?resolveTypoRef(project,b.shared.typoRef):null;
  if(typo){ const e=effectiveTypo(project,typo,'desktop'); bits.push(e.size?typo.name+` ${e.size}px`:typo.name); }
  const pv=b.perVersion.desktop;
  if(pv&&pv.height) bits.push('h='+pv.height+'px');
  return bits.join(' · ');
}
function inputSummary(project,f){
  const bits=[];
  const pv=f.perVersion.desktop;
  if(pv&&pv.height) bits.push('h='+pv.height+'px');
  const n=f.states.normal;
  if(n&&n.bgRef){const c=resolveColorRef(project,n.bgRef); if(c)bits.push('фон: '+(c.hex||c.name));}
  return bits.join(' · ');
}
