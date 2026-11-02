/* Хранилище: localStorage + мутації з автосохранением */

const STORAGE_KEY = 'guidelines-app-v1';

const Store = {
  state: null,          // { projects:[], settings:{theme} }
  _saveTimer: null,

  load(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(raw){
        this.state = JSON.parse(raw);
      }
    }catch(e){ console.warn('Не удалось загрузить данные', e); }
    if(!this.state || !Array.isArray(this.state.projects)){
      this.state = { projects: [], settings:{ theme:'system' } };
    }
    if(!this.state.settings) this.state.settings = { theme:'system' };
    // миграция: гарантируем структуру секций у старых проектов
    this.state.projects.forEach(p=>{ migrateProject(p); });
  },

  save(){
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(()=>{
      try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); }
      catch(e){ console.warn('Не удалось сохранить', e); toast('Не удалось сохранить локально'); }
    }, 120);
  },

  touchProject(p){ p.updatedAt = nowISO(); this.save(); },

  getProject(id){ return this.state.projects.find(p=>p.id===id) || null; },

  addProject(name, desc){
    const p = makeProject(name, desc);
    this.state.projects.unshift(p);
    this.save();
    return p;
  },

  duplicateProject(src){
    const copy = deepClone(src);
    copy.id = uid('p');
    copy.name = (src.name + ' — копия').slice(0,120);
    copy.createdAt = nowISO(); copy.updatedAt = nowISO();
    // новые id не нужны: сущности внутри проекта уникальны в рамках проекта
    const idx = this.state.projects.findIndex(p=>p.id===src.id);
    this.state.projects.splice(idx+1, 0, copy);
    this.save();
    return copy;
  },

  deleteProject(id){
    this.state.projects = this.state.projects.filter(p=>p.id!==id);
    this.save();
  },

  replaceAllProjects(list){ this.state.projects = list; this.save(); },
};

/* Простейшая миграция недостающих полей */
function migrateProject(p){
  if(!p.sections) p.sections = makeSectionsData();
  const s = p.sections;
  if(!s.colors) s.colors = [];
  if(!s.typography){ s.typography = { primary:{}, items:[] }; }
  if(!s.typography.primary) s.typography.primary = {};
  TYPO_PRIMARY_DEFAULTS.forEach(pd=>{
    if(!s.typography.primary[pd.key]) s.typography.primary[pd.key] = { family:'', weight:pd.weight };
  });
  if(!Array.isArray(s.typography.items)) s.typography.items=[];
  if(!Array.isArray(s.buttons)) s.buttons = [];
  if(!Array.isArray(s.inputs)) s.inputs = [];
  if(!Array.isArray(s.radius)) s.radius = [];
  if(!Array.isArray(s.shadows)) s.shadows = [];
  if(!s.spacing || !Array.isArray(s.spacing.items)) s.spacing = { items: [] };
  if(!s.grid) s.grid = makeGridSection();
  if(!p.activeVersion) p.activeVersion='desktop';

  s.colors.forEach(c=>{ if(c.updatedAt===undefined) c.updatedAt=nowISO(); if(c.comment===undefined)c.comment=''; });
  s.typography.items.forEach(t=>{
    if(!t.perVersion) t.perVersion = { desktop:{size:'',lineHeight:'110',letterSpacing:'0'}, tablet:{inherit:true}, mobile:{inherit:true} };
    ['desktop','tablet','mobile'].forEach(v=>{ if(!t.perVersion[v]) t.perVersion[v]={inherit:true}; });
    if(!t.shared) t.shared={};
    if(t.shared.lineHeightUnit===undefined) t.shared.lineHeightUnit='%';
    if(t.shared.letterSpacingUnit===undefined) t.shared.letterSpacingUnit='%';
  });
  s.buttons.forEach(b=>{
    if(!b.states) b.states={};
    if(!b.customStates) b.customStates=[];
    if(!b.shared) b.shared={typoRef:null,radiusRef:'auto-buttons',shadowRef:'auto-buttons-shadow'};
    if(!b.perVersion) b.perVersion={desktop:{height:'',padV:'',padH:''},tablet:{inherit:true},mobile:{inherit:true}};
    ['desktop','tablet','mobile'].forEach(v=>{ if(!b.perVersion[v]) b.perVersion[v]={inherit:true}; });
  });
  s.inputs.forEach(i=>{
    if(!i.states) i.states={};
    if(!i.customStates) i.customStates=[];
    if(!i.shared) i.shared={labelTypoRef:null,labelColorRef:null};
    if(!i.perVersion) i.perVersion={desktop:{height:'',padV:'',padH:'',radiusRef:null,shadowRef:'auto-inputs-shadow'},tablet:{inherit:true},mobile:{inherit:true}};
    ['desktop','tablet','mobile'].forEach(v=>{ if(!i.perVersion[v]) i.perVersion[v]={inherit:true}; });
  });
  s.radius.forEach(r=>{
    if(!r.perVersion) r.perVersion={desktop:{common:'',tl:'',tr:'',br:'',bl:''},tablet:{inherit:true},mobile:{inherit:true}};
    ['desktop','tablet','mobile'].forEach(v=>{ if(!r.perVersion[v]) r.perVersion[v]={inherit:true}; });
    if(!r.mode) r.mode='common';
  });
  s.shadows.forEach(sh=>{ if(!sh.layers||!sh.layers.length) sh.layers=[makeShadowLayer()]; });
  s.spacing.items.forEach(sp=>{
    if(!sp.perVersion) sp.perVersion={desktop:{value:''},tablet:{inherit:true},mobile:{inherit:true}};
    ['desktop','tablet','mobile'].forEach(v=>{ if(!sp.perVersion[v]) sp.perVersion[v]={inherit:true}; });
  });
}

/* ================= Вспомогательные операции ================= */

/* Значение поля версии с учётом цепочки inherit desktop→tablet→mobile */
function versionValue(obj, version, getter){
  const chain = VERSIONS.slice(0, VERSIONS.indexOf(version)+1);
  // идём по цепочке сверху вниз; находим ближайшую версию, которая НЕ наследует
  for(let i = chain.length-1; i>=0; i--){
    const v = chain[i];
    const pv = obj.perVersion[v];
    if(!pv) continue;
    if(v==='desktop' || !pv.inherit){
      return getter(pv, v);
    }
  }
  return getter(obj.perVersion.desktop||{}, 'desktop');
}

/* Записать значение в активную версию; если поле наследовало — разрываем связь (inherit=false, копируем текущее тянутое значение) */
function setVersionField(obj, version, fieldsSetter){
  if(version==='desktop'){
    if(!obj.perVersion.desktop) obj.perVersion.desktop = {};
    fieldsSetter(obj.perVersion.desktop);
    obj.updatedAt = nowISO();
    return;
  }
  const pv = obj.perVersion[version];
  if(pv && pv.inherit){
    // materialize: копируем значения из родителя
    const parentVer = VERSIONS[VERSIONS.indexOf(version)-1];
    const parentPv = obj.perVersion[parentVer] || {};
    obj.perVersion[version] = Object.assign({}, parentPv);
    delete obj.perVersion[version].inherit;
    fieldsSetter(obj.perVersion[version]);
  }else{
    if(!obj.perVersion[version]) obj.perVersion[version] = {};
    fieldsSetter(obj.perVersion[version]);
  }
  obj.updatedAt = nowISO();
}

/* «Заполнить данными с десктопа/планшета»: копирует всё из родительской версии и восстанавливает inherit */
function fillFromParentVersion(obj, version){
  const idx = VERSIONS.indexOf(version);
  if(idx<=0) return;
  const parent = VERSIONS[idx-1];
  const src = obj.perVersion[parent] || {};
  const clone = deepClone(src);
  delete clone.inherit;
  clone.inherit = true;
  obj.perVersion[version] = clone;
  obj.updatedAt = nowISO();
}

/* Проверка: заполнен ли пункт версии (для зелёной галочки) */
function isFilledAny(project){
  const s = project.sections;
  return SECTIONS.some(sec => sectionHasData(project, sec.id, null));
}

function versionHasData(project, version){
  return SECTIONS.some(sec=>sectionHasData(project, sec.id, version));
}

/* Есть ли данные в разделе (по всей версии или во всех). version=null — любая версия */
function sectionHasData(project, sectionId, version){
  const s = project.sections;
  const vers = version ? [version] : VERSIONS;
  switch(sectionId){
    case 'colors':
      return s.colors.some(c=>!!c.hex || (c.comment&&c.comment.trim()));
    case 'typography': {
      const pr = s.typography.primary;
      if(pr && (pr.headings?.family || pr.body?.family)) return true;
      return s.typography.items.some(t=>{
        if(t.shared.weight || t.shared.fontOverride || (t.comment&&t.comment.trim())) return true;
        return vers.some(v=>{
          const pv = t.perVersion[v]; if(!pv) return false;
          if(v!=='desktop' && pv.inherit) return false;
          return !!(pv.size || pv.lineHeight || pv.letterSpacing);
        });
      });
    }
    case 'buttons':
      return s.buttons.some(b=>{
        if(Object.values(b.states||{}).some(st=>st.bgRef||st.borderColorRef||st.borderWidth||st.textColorRef)) return true;
        if((b.customStates||[]).length) return true;
        if(b.shared.typoRef) return true;
        if(b.comment && b.comment.trim()) return true;
        return vers.some(v=>{
          const pv=b.perVersion[v]; if(!pv) return false;
          if(v!=='desktop'&&pv.inherit) return false;
          return !!(pv.height||pv.padV||pv.padH||pv.radiusOverride||pv.shadowOverride||pv.sizeOverride);
        });
      });
    case 'inputs':
      return s.inputs.some(f=>{
        if(Object.values(f.states||{}).some(st=>st.bgRef||st.textTypoRef||st.phTypoRef||st.borderColorRef||st.borderWidth||st.textColorRef||st.phColorRef)) return true;
        if((f.customStates||[]).length) return true;
        if(f.shared.labelTypoRef||f.shared.labelColorRef) return true;
        if(f.comment&&f.comment.trim()) return true;
        return vers.some(v=>{
          const pv=f.perVersion[v]; if(!pv) return false;
          if(v!=='desktop'&&pv.inherit) return false;
          return !!(pv.height||pv.padV||pv.padH||pv.radiusRef||pv.sizeOverride);
        });
      });
    case 'radius':
      return s.radius.some(r=>vers.some(v=>{
        const pv=r.perVersion[v]; if(!pv) return false;
        if(v!=='desktop'&&pv.inherit) return false;
        return !!(pv.common||pv.tl||pv.tr||pv.br||pv.bl);
      }) || (r.comment&&r.comment.trim()));
    case 'shadows':
      return s.shadows.some(sh=>sh.layers.some(l=>l.x||l.y||l.blur||l.spread||l.colorRef||l.opacity||(l.inner&&l.inner!==false)) || (sh.comment&&sh.comment.trim()));
    case 'spacing': {
      const anySpacing = s.spacing.items.some(sp=>vers.some(v=>{
        const pv=sp.perVersion[v]; if(!pv) return false;
        if(v!=='desktop'&&pv.inherit) return false;
        return !!pv.value;
      }) || (sp.comment&&sp.comment.trim()));
      if(anySpacing) return true;
      const gv = version ? [version] : VERSIONS;
      return gv.some(v=>{
        const g=s.grid.perVersion[v]; if(!g) return false;
        if(v!=='desktop'&&g.inherit) return false;
        return !!(g.containerWidth||g.columns||g.gutter||g.sideMargins||g.maxContentWidth);
      });
    }
  }
  return false;
}

/* ---- Разорванные связи ---- */
/* Сканируем все ref-поля проекта. Возвращаем [{kind:'color'|'typo'|'radius'|'shadow', brokenName, where:{sectionId, itemId, itemLabel, fieldLabel}}] */
function findBrokenLinks(project){
  const out = [];
  const s = project.sections;
  const colorIds = new Set(s.colors.map(c=>c.id));
  const typoIds = new Set(s.typography.items.map(t=>t.id));
  const radiusItems = s.radius; const shadowItems = s.shadows;

  const checkColor = (ref, where)=>{ if(ref && !colorIds.has(ref)) out.push(Object.assign({kind:'color', brokenName:'цвет удалён'}, where)); };
  const checkTypo = (ref, where)=>{ if(ref && !typoIds.has(ref)) out.push(Object.assign({kind:'typo', brokenName:'стиль типографики удалён'}, where)); };

  s.typography.items.forEach(t=>{
    checkColor(t.shared.colorRef, {sectionId:'typography', itemId:t.id, itemLabel:t.name, fieldLabel:'Цвет текста'});
  });

  s.buttons.forEach(b=>{
    const lbl = `${buttonStyleLabel(b.style)} ${b.size}`;
    checkTypo(b.shared.typoRef, {sectionId:'buttons', itemId:b.id, itemLabel:lbl, fieldLabel:'Типографика'});
    allButtonStates(b).forEach(st=>{
      checkColor(st.bgRef, {sectionId:'buttons', itemId:b.id, itemLabel:lbl, fieldLabel:`Фон (${st.label})`});
      checkColor(st.textColorRef, {sectionId:'buttons', itemId:b.id, itemLabel:lbl, fieldLabel:`Цвет текста (${st.label})`});
      checkColor(st.borderColorRef, {sectionId:'buttons', itemId:b.id, itemLabel:lbl, fieldLabel:`Обводка (${st.label})`});
    });
    checkRadius(b.shared.radiusRef, {sectionId:'buttons', itemId:b.id, itemLabel:lbl, fieldLabel:'Скругление'});
    checkRadius(VERSIONS.map(v=>b.perVersion[v]?.radiusOverride).find(x=>x), {sectionId:'buttons', itemId:b.id, itemLabel:lbl, fieldLabel:'Скругление'});
    checkShadow(b.shared.shadowRef, {sectionId:'buttons', itemId:b.id, itemLabel:lbl, fieldLabel:'Тень'});
    VERSIONS.forEach(v=>checkShadow(b.perVersion[v]?.shadowOverride, {sectionId:'buttons', itemId:b.id, itemLabel:lbl, fieldLabel:`Тень (${VERSION_LABELS[v]})`}));
  });

  s.inputs.forEach(f=>{
    const lbl = `Поле ${f.size}`;
    checkTypo(f.shared.labelTypoRef, {sectionId:'inputs', itemId:f.id, itemLabel:lbl, fieldLabel:'Label'});
    checkColor(f.shared.labelColorRef, {sectionId:'inputs', itemId:f.id, itemLabel:lbl, fieldLabel:'Цвет label'});
    allInputStates(f).forEach(st=>{
      checkColor(st.bgRef, {sectionId:'inputs', itemId:f.id, itemLabel:lbl, fieldLabel:`Фон (${st.label})`});
      checkTypo(st.textTypoRef, {sectionId:'inputs', itemId:f.id, itemLabel:lbl, fieldLabel:`Текст (${st.label})`});
      checkColor(st.textColorRef, {sectionId:'inputs', itemId:f.id, itemLabel:lbl, fieldLabel:`Цвет текста (${st.label})`});
      checkTypo(st.phTypoRef, {sectionId:'inputs', itemId:f.id, itemLabel:lbl, fieldLabel:`Плейсхолдер (${st.label})`});
      checkColor(st.phColorRef, {sectionId:'inputs', itemId:f.id, itemLabel:lbl, fieldLabel:`Цвет плейсхолдера (${st.label})`});
      checkColor(st.borderColorRef, {sectionId:'inputs', itemId:f.id, itemLabel:lbl, fieldLabel:`Обводка (${st.label})`});
    });
    VERSIONS.forEach(v=>{
      const pv=f.perVersion[v]; if(!pv) return;
      checkRadius(pv.radiusRef, {sectionId:'inputs', itemId:f.id, itemLabel:lbl, fieldLabel:`Скругление (${VERSION_LABELS[v]})`});
      checkShadow(pv.shadowRef, {sectionId:'inputs', itemId:f.id, itemLabel:lbl, fieldLabel:`Тень (${VERSION_LABELS[v]})`});
    });
  });

  s.shadows.forEach(sh=>{
    sh.layers.forEach((l,i)=>{
      checkColor(l.colorRef, {sectionId:'shadows', itemId:sh.id, itemLabel:sh.name, fieldLabel:`Слой ${i+1}: цвет`});
    });
  });

  function checkRadius(ref, where){
    if(!ref) return;
    if(String(ref).startsWith('auto-')){
      const found = resolveRadiusRef(project, ref);
      if(!found) out.push(Object.assign({kind:'radius', brokenName:'скругление удалено'}, where));
    }else if(!radiusItems.some(r=>r.id===ref)){
      out.push(Object.assign({kind:'radius', brokenName:'скругление удалено'}, where));
    }
  }
  function checkShadow(ref, where){
    if(!ref) return;
    if(String(ref).startsWith('auto-')){
      const found = resolveShadowRef(project, ref);
      if(!found) out.push(Object.assign({kind:'shadow', brokenName:'тень удалена'}, where));
    }else if(!shadowItems.some(sh=>sh.id===ref)){
      out.push(Object.assign({kind:'shadow', brokenName:'тень удалена'}, where));
    }
  }
  return out;
}

function sectionBrokenLinks(project, sectionId){
  return findBrokenLinks(project).filter(b=>b.sectionId===sectionId);
}

/* Все состояния кнопки (пресет + свои) */
function allButtonStates(b){
  const preset = BUTTON_STATE_PRESETS.map(sp=>b.states[sp.key]).filter(Boolean);
  return preset.concat(b.customStates||[]);
}
function allInputStates(f){
  const preset = INPUT_STATE_PRESETS.map(sp=>f.states[sp.key]).filter(Boolean);
  return preset.concat(f.customStates||[]);
}
function buttonStyleLabel(k){ const st=BUTTON_STYLES.find(s=>s.key===k); return st?st.label:k; }

/* Сводка элемента для свёрнутой строки и экспорта — эффективные значения */
function effectiveTypo(project, t, version){
  const primKey = TYPO_GROUPS.find(g=>g.key===t.group)?.primary || 'body';
  const prim = project.sections.typography.primary[primKey] || {family:'',weight:''};
  const pv = versionValue(t, version, (o)=>o);
  const desktopBase = t.perVersion.desktop || {};
  const val = {
    family: t.shared.fontOverride || prim.family || '',
    weight: t.shared.weight || prim.weight || '',
    size: pv.size || '',
    lineHeight: pv.lineHeight || '',
    lineHeightUnit: t.shared.lineHeightUnit || '%',
    letterSpacing: pv.letterSpacing || '',
    letterSpacingUnit: t.shared.letterSpacingUnit || '%',
    colorRef: t.shared.colorRef || null,
  };
  return val;
}

function effectiveRadius(project, r, version){
  const pv = versionValue(r, version, o=>o);
  if(r.mode==='corners'){
    return { mode:'corners', tl:pv.tl||'', tr:pv.tr||'', br:pv.br||'', bl:pv.bl||'' };
  }
  return { mode:'common', common: pv.common||'' };
}

function radiusSummary(r){
  const parts = VERSIONS.map(v=>{
    const pv = versionValue(r, v, o=>o);
    if(r.mode==='corners') return [pv.tl,pv.tr,pv.br,pv.bl].join('/');
    return pv.common;
  });
  const d = parts[0];
  if(!d && !parts[1] && !parts[2]) return '';
  return d + (parts[1]&&parts[1]!==d ? ' · '+parts[1] : '') + (parts[2]&&parts[2]!==parts[1]&&parts[2]!==d ? ' · '+parts[2] : '');
}

/* Цвета пункта скругления нет; тень — CSS-строка */
function shadowCSS(layer, hexWithAlpha){
  const inner = layer.inner ? 'inset ' : '';
  const x = numVal(layer.x)||0, y = numVal(layer.y)||0, b = numVal(layer.blur)||0, sp = numVal(layer.spread)||0;
  return `${inner}${x}px ${y}px ${b}px ${sp}px ${hexWithAlpha}`;
}

/* Получить список опций для выпадающего списка ссылок (порядок как в разделе) */
function colorOptions(project){ return project.sections.colors.map(c=>({id:c.id,name:c.name,hex:c.hex})); }
function typoOptions(project){ return project.sections.typography.items.map(t=>({id:t.id,name:t.name,group:t.group})); }
function radiusOptions(project){ return project.sections.radius.map(r=>({id:r.id,name:r.name})); }
function shadowOptions(project){ return project.sections.shadows.map(s=>({id:s.id,name:s.name})); }
