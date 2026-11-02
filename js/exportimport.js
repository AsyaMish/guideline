/* Экспорт (PDF/CSV/JSON) и импорт (CSV/JSON), предпросмотр */

/* ===== Плоское представление проекта: [{section, field, version, value, filled}] ===== */
function flattenProject(project, opts={}){
  const { versions = VERSIONS, onlyFilled = true } = opts;
  const rows = [];
  const add=(section,field,version,value,extra)=>{
    const filled = !isEmptyVal(value);
    if(onlyFilled && !filled) return;
    rows.push({ section, field, version, value: filled?String(value):'—', filled, ...(extra||{}) });
  };
  const s = project.sections;

  // Цвета — сквозные
  if(versions.length){
    s.colors.forEach(c=>{
      add('Цвета', c.name, 'все', c.hex);
      if(c.comment) add('Цвета', c.name+' — комментарий', 'все', c.comment);
    });
  }

  // Типографика
  const pr = s.typography.primary;
  add('Типографика','Шрифт заголовки','все', pr.headings.family);
  add('Типографика','Шрифт основной текст','все', pr.body.family);
  s.typography.items.forEach(t=>{
    const g = TYPO_GROUPS.find(x=>x.key===t.group);
    versions.forEach(v=>{
      const e = effectiveTypo(project, t, v);
      const cross = (v!=='desktop');
      add('Типографика', `${g.label}: ${t.name} — Шрифт`, 'все', e.family);
      add('Типографика', `${g.label}: ${t.name} — Начертание`, 'все', e.weight);
      add('Типографика', `${g.label}: ${t.name} — Кегль`, v, e.size && (e.size+'px'));
      const colName = e.colorRef ? (resolveColorRef(project,e.colorRef)?.name || 'цвет удалён') : '';
      add('Типографика', `${g.label}: ${t.name} — Цвет текста`, 'все', colName);
      add('Типографика', `${g.label}: ${t.name} — Межстрочный`, v, e.lineHeight && (e.lineHeight + (e.lineHeightUnit==='%'?'%':'')));
      add('Типографика', `${g.label}: ${t.name} — Межбуквенное`, v, e.letterSpacing && (e.letterSpacing + (e.letterSpacingUnit==='%'?'%':'')));
      if(t.comment) add('Типографика', `${g.label}: ${t.name} — Комментарий`, 'все', t.comment);
    });
  });

  // Кнопки
  s.buttons.forEach(b=>{
    const sec='Кнопки';
    const lbl = `${buttonStyleLabel(b.style)} ${b.size}`;
    allButtonStates(b).forEach(st=>{
      if(b.style==='fill') add(sec, `${lbl} — Фон (${st.label})`, 'все', st.bgRef?(resolveColorRef(project,st.bgRef)?.name||'цвет удалён'):'');
      else {
        add(sec, `${lbl} — Фон (${st.label})`, 'все', st.bgRef?(resolveColorRef(project,st.bgRef)?.name||'цвет удалён'):'');
        add(sec, `${lbl} — Обводка цвет (${st.label})`, 'все', st.borderColorRef?(resolveColorRef(project,st.borderColorRef)?.name||'цвет удалён'):'');
        add(sec, `${lbl} — Обводка толщина (${st.label})`, 'все', st.borderWidth&&(st.borderWidth+'px'));
      }
      if(b.style==='fill'){
        add(sec, `${lbl} — Обводка цвет (${st.label})`, 'все', st.borderColorRef?(resolveColorRef(project,st.borderColorRef)?.name||'цвет удалён'):'');
        add(sec, `${lbl} — Обводка толщина (${st.label})`, 'все', st.borderWidth&&(st.borderWidth+'px'));
      }
      const typoName = st.typoRef ? (resolveTypoRef(project, st.typoRef)?.name||'стиль удалён') : null;
      if(typoName) add(sec, `${lbl} — Текст (${st.label})`, 'все', typoName);
    });
    versions.forEach(v=>{
      const pv = versionValue(b, v, o=>o);
      const typoMain = b.shared.typoRef ? (resolveTypoRef(project,b.shared.typoRef)?.name||'стиль удалён') : '';
      add(sec, `${lbl} — Типографика`, 'все', typoMain);
      add(sec, `${lbl} — Высота`, v, pv.height&&(pv.height+'px'));
      add(sec, `${lbl} — Отступы (верт.)`, v, pv.padV&&(pv.padV+'px'));
      add(sec, `${lbl} — Отступы (гориз.)`, v, pv.padH&&(pv.padH+'px'));
      const radRef = pv.radiusOverride || b.shared.radiusRef;
      const rad = resolveRadiusRef(project, radRef);
      let radVal = '';
      if(rad){
        const re = effectiveRadius(project, rad, v);
        radVal = re.mode==='corners' ? [re.tl,re.tr,re.br,re.bl].join('/') : re.common;
        if(radVal) radVal += 'px ('+rad.name+')';
      } else if(radRef){ radVal='скругление удалено'; }
      add(sec, `${lbl} — Скругление`, v, radVal);
      const shRef = pv.shadowOverride || b.shared.shadowRef;
      const sh = resolveShadowRef(project, shRef);
      let shVal = sh ? shadowSummaryText(project, sh) : (shRef?'тень удалена':'');
      add(sec, `${lbl} — Тень`, 'все', shVal);
      if(b.comment) add(sec, `${lbl} — Комментарий`, 'все', b.comment);
    });
  });

  // Поля ввода
  s.inputs.forEach(f=>{
    const sec='Поля ввода';
    const lbl = `Размер ${f.size}`;
    allInputStates(f).forEach(st=>{
      add(sec, `${lbl} — Фон (${st.label})`, 'все', st.bgRef?(resolveColorRef(project,st.bgRef)?.name||'цвет удалён'):'');
      const tt = st.textTypoRef?(resolveTypoRef(project,st.textTypoRef)?.name||'стиль удалён'):'';
      add(sec, `${lbl} — Текст (${st.label})`, 'все', tt);
      add(sec, `${lbl} — Цвет текста (${st.label})`, 'все', st.textColorRef?(resolveColorRef(project,st.textColorRef)?.name||'цвет удалён'):'');
      const pt = st.phTypoRef?(resolveTypoRef(project,st.phTypoRef)?.name||'стиль удалён'):'';
      add(sec, `${lbl} — Плейсхолдер (${st.label})`, 'все', pt);
      add(sec, `${lbl} — Цвет плейсхолдера (${st.label})`, 'все', st.phColorRef?(resolveColorRef(project,st.phColorRef)?.name||'цвет удалён'):'');
      add(sec, `${lbl} — Обводка цвет (${st.label})`, 'все', st.borderColorRef?(resolveColorRef(project,st.borderColorRef)?.name||'цвет удалён'):'');
      add(sec, `${lbl} — Обводка толщина (${st.label})`, 'все', st.borderWidth&&(st.borderWidth+'px'));
    });
    add(sec, `${lbl} — Label (типографика)`, 'все', f.shared.labelTypoRef?(resolveTypoRef(project,f.shared.labelTypoRef)?.name||'стиль удалён'):'');
    add(sec, `${lbl} — Label (цвет)`, 'все', f.shared.labelColorRef?(resolveColorRef(project,f.shared.labelColorRef)?.name||'цвет удалён'):'');
    versions.forEach(v=>{
      const pv = versionValue(f, v, o=>o);
      add(sec, `${lbl} — Высота`, v, pv.height&&(pv.height+'px'));
      add(sec, `${lbl} — Отступы (верт.)`, v, pv.padV&&(pv.padV+'px'));
      add(sec, `${lbl} — Отступы (гориз.)`, v, pv.padH&&(pv.padH+'px'));
      const rad = resolveRadiusRef(project, pv.radiusRef);
      let radVal='';
      if(rad){
        const re = effectiveRadius(project, rad, v);
        radVal = re.mode==='corners'?[re.tl,re.tr,re.br,re.bl].join('/'):re.common;
        if(radVal) radVal+='px ('+rad.name+')';
      } else if(pv.radiusRef){ radVal='скругление удалено'; }
      add(sec, `${lbl} — Скругление`, v, radVal);
      const sh = resolveShadowRef(project, pv.shadowRef);
      add(sec, `${lbl} — Тень`, 'все', sh?shadowSummaryText(project, sh):(pv.shadowRef?'тень удалена':''));
      if(f.comment) add(sec, `${lbl} — Комментарий`, 'все', f.comment);
    });
  });

  // Скругления
  s.radius.forEach(r=>{
    versions.forEach(v=>{
      const re = effectiveRadius(project, r, v);
      const val = re.mode==='corners' ? [re.tl,re.tr,re.br,re.bl].filter(x=>x!=='').join('/') : re.common;
      add('Скругления', r.name, v, val&&(val+(re.mode==='corners'?' px (по углам)':'px')));
    });
    if(r.comment) add('Скругления', r.name+' — комментарий', 'все', r.comment);
  });

  // Тени — сквозные
  s.shadows.forEach(sh=>{
    sh.layers.forEach((l,i)=>{
      const pfx = `${sh.name} — слой ${i+1}`;
      add('Тени', pfx+' (тип)', 'все', l.inner?'внутренняя':'внешняя');
      add('Тени', pfx+' X', 'все', l.x&&(l.x+'px'));
      add('Тени', pfx+' Y', 'все', l.y&&(l.y+'px'));
      add('Тени', pfx+' Размытие', 'все', l.blur&&(l.blur+'px'));
      add('Тени', pfx+' Растяжение', 'все', l.spread&&(l.spread+'px'));
      add('Тени', pfx+' Цвет', 'все', l.colorRef?(resolveColorRef(project,l.colorRef)?.name||'цвет удалён'):'');
      add('Тени', pfx+' Прозрачность', 'все', l.opacity&&(l.opacity+'%'));
    });
    if(sh.comment) add('Тени', sh.name+' — комментарий', 'все', sh.comment);
  });

  // Отступы
  s.spacing.items.forEach(sp=>{
    versions.forEach(v=>{
      const pv = versionValue(sp, v, o=>o);
      add('Отступы', sp.name, v, pv.value&&(pv.value+'px'));
    });
    if(sp.comment) add('Отступы', sp.name+' — комментарий', 'все', sp.comment);
  });

  // Сетка
  const gridFields = [
    ['containerWidth','Ширина контейнера'],['columns','Количество колонок'],['gutter','Межколоночный отступ (gutter)'],
    ['sideMargins','Боковые поля'],['maxContentWidth','Макс. ширина контента'],
  ];
  versions.forEach(v=>{
    const g = s.grid.perVersion[v]||{};
    if(v!=='desktop' && g.inherit) return;
    gridFields.forEach(([k,label])=> add('Сетка', label, v, g[k]));
  });

  return rows;
}

function shadowSummaryText(project, sh){
  const parts = sh.layers.map(l=>{
    let hex = '';
    if(l.colorRef){
      const c = resolveColorRef(project, l.colorRef);
      hex = c ? (c.hex || 'цвет без HEX') : 'цвет удалён';
    }
    return `${l.inner?'inset ':''}${l.x||0}px ${l.y||0}px ${l.blur||0}px ${l.spread||0}px ${hex}${l.opacity?(' @'+l.opacity+'%'):''}`.trim();
  });
  return parts.join(', ');
}

/* ===== CSV ===== */
function toCSV(rows, meta){
  const lines = ['# app=guidelines;version='+APP_VERSION+';project='+encodeURIComponent(meta?.name||'')+';date='+(meta?.updatedAt||'')];
  lines.push(['Раздел','Поле','Версия','Значение'].map(csvEscape).join(','));
  rows.forEach(r=>{
    lines.push([r.section,r.field,r.version,r.value].map(csvEscape).join(','));
  });
  return '\uFEFF'+lines.join('\r\n');
}

function parseCSV(text){
  // Возвращает массив строк-массивов ячеек; пропускает служебные строки «#» и заголовок
  const clean = text.replace(/^\uFEFF/,'');
  const all=[]; let row=[], cell='', inQ=false;
  for(let i=0;i<clean.length;i++){
    const ch=clean[i];
    if(inQ){
      if(ch==='"'){ if(clean[i+1]==='"'){cell+='"';i++;} else inQ=false; }
      else cell+=ch;
    }else{
      if(ch==='"') inQ=true;
      else if(ch===','){ row.push(cell); cell=''; }
      else if(ch==='\n'){ row.push(cell); all.push(row); row=[]; cell=''; }
      else if(ch==='\r'){ /* skip */ }
      else cell+=ch;
    }
  }
  if(cell!==''||row.length){ row.push(cell); all.push(row); }
  return all.filter(r=>{
    if(!r.length) return false;
    const first = String(r[0]||'').trim();
    if(first.startsWith('#')) return false;              // служебная строка
    if(first==='Раздел') return false;                    // шапка
    return r.length>=4;
  });
}

/* Импорт CSV → частичный проект (для слияния по правилам). Даты в CSV нет → приоритет текущей базе
   для совпадающих заполненных полей; пустые («—») игнорируются. Заполняем те поля базы, что пусты,
   и добавляем новые элементы. */
function csvToProjectPatch(rows, baseProject){
  const p = deepClone(baseProject);
  migrateProject(p);
  const DASH='—';
  const setNew=(arr,item)=>{ arr.push(item); };
  rows.forEach(r=>{
    if(r.length<4) return;
    const [section, field, version, value] = r.map(x=>String(x||'').trim());
    if(!value || value===DASH) return;
    const ver = (version==='все'||version==='all'||!version)?'all':(VERSIONS.includes(version)?version:'desktop');
    switch(section){
      case 'Цвета': {
        if(field.endsWith(' — комментарий')){
          const nm = field.replace(' — комментарий','');
          let c = p.sections.colors.find(x=>x.name.toLowerCase()===nm.toLowerCase());
          if(!c){ c=makeColorItem(nm); p.sections.colors.push(c);} 
          c.comment=value;
        }else{
          let c = p.sections.colors.find(x=>x.name.toLowerCase()===field.toLowerCase());
          if(!c){ c=makeColorItem(field); p.sections.colors.push(c); }
          const hx = normHex(value); if(hx) c.hex=hx;
        }
        break;
      }
      case 'Типографика': {
        if(field==='Шрифт заголовки'){ p.sections.typography.primary.headings.family=value; break; }
        if(field==='Шрифт основной текст'){ p.sections.typography.primary.body.family=value; break; }
        const m = field.match(/^(Заголовки|Основной текст|Мелкие подписи): (\S+) — (.+)$/);
        if(!m) break;
        const gLabel=m[1], name=m[2], param=m[3];
        const g = TYPO_GROUPS.find(x=>x.label===gLabel); if(!g) break;
        let t = p.sections.typography.items.find(x=>x.group===g.key && x.name===name);
        if(!t){ t=makeTypoItem(g.key,name); p.sections.typography.items.push(t); }
        if(param==='Шрифт') t.shared.fontOverride=value;
        else if(param==='Начертание') t.shared.weight=value;
        else if(param==='Цвет текста'){ const c=p.sections.colors.find(x=>x.name===value); if(c) t.shared.colorRef=c.id; }
        else if(param==='Комментарий') t.comment=value;
        else if(ver!=='all'){
          if(param==='Кегль') setVersionField(t,ver,o=>o.size=value.replace('px',''));
          else if(param==='Межстрочный') setVersionField(t,ver,o=>{ o.lineHeight=value.replace('%',''); t.shared.lineHeightUnit = value.includes('%')?'%':'ratio'; });
          else if(param==='Межбуквенное') setVersionField(t,ver,o=>{ o.letterSpacing=value.replace('%',''); t.shared.letterSpacingUnit = value.includes('%')?'%':'ratio'; });
        }
        break;
      }
      case 'Кнопки': {
        const m = field.match(/^(Заливка|Обводка) (\w+)(?: — (.+))?$/);
        if(!m) break;
        const styleKey = m[1]==='Заливка'?'fill':'outline';
        const size=m[2]; const rest=m[3]||'';
        let b = p.sections.buttons.find(x=>x.style===styleKey && x.size===size);
        if(!b){ b=makeButtonCell(styleKey,size); p.sections.buttons.push(b); }
        const sm = rest.match(/^(Фон|Цвет текста|Обводка цвет|Обводка толщина|Текст) \((.+)\)$/);
        if(sm){
          const kind=sm[1], stateLabel=sm[2];
          let st = findOrCreateState(b, stateLabel, BUTTON_STATE_PRESETS);
          if(kind==='Фон'){ const c=p.sections.colors.find(x=>x.name===value||x.hex===value); if(c) st.bgRef=c.id; }
          else if(kind==='Цвет текста'){ const c=p.sections.colors.find(x=>x.name===value||x.hex===value); if(c) st.textColorRef=c.id; }
          else if(kind==='Обводка цвет'){ const c=p.sections.colors.find(x=>x.name===value||x.hex===value); if(c) st.borderColorRef=c.id; }
          else if(kind==='Обводка толщина'){ st.borderWidth=value.replace('px',''); }
          else if(kind==='Текст'){ const t=p.sections.typography.items.find(x=>x.name===value); if(t) st.typoRef=t.id; }
        }else if(rest==='Типографика'){ const t=p.sections.typography.items.find(x=>x.name===value); if(t) b.shared.typoRef=t.id; }
        else if(rest==='Комментарий'){ b.comment=value; }
        else if(rest==='Тень'){ const sh=p.sections.shadows.find(x=>x.name===value); if(sh) b.shared.shadowRef=sh.id; }
        else if(rest==='Высота'&&ver!=='all') setVersionField(b,ver,o=>o.height=value.replace('px',''));
        else if(rest.startsWith('Отступы')&&ver!=='all'){ const vert=rest.includes('верт'); setVersionField(b,ver,o=> vert?o.padV=value.replace('px',''):o.padH=value.replace('px','')); }
        else if(rest==='Скругление'&&ver!=='all'){ const rad=p.sections.radius.find(x=>value.includes(x.name)); if(rad) setVersionField(b,ver,o=>o.radiusOverride=rad.id); }
        break;
      }
      case 'Поля ввода': {
        const m = field.match(/^Размер (\w+)(?: — (.+))?$/);
        if(!m) break;
        const size=m[1]; const rest=m[2]||'';
        let f = p.sections.inputs.find(x=>x.size===size);
        if(!f){ f=makeInputField(size); p.sections.inputs.push(f); }
        const sm = rest.match(/^(Фон|Текст|Цвет текста|Плейсхолдер|Цвет плейсхолдера|Обводка цвет|Обводка толщина) \((.+)\)$/);
        if(sm){
          const kind=sm[1], stateLabel=sm[2];
          let st = findOrCreateState(f, stateLabel, INPUT_STATE_PRESETS);
          if(kind==='Фон'){ const c=p.sections.colors.find(x=>x.name===value); if(c) st.bgRef=c.id; }
          else if(kind==='Текст'){ const t=p.sections.typography.items.find(x=>x.name===value); if(t) st.textTypoRef=t.id; }
          else if(kind==='Цвет текста'){ const c=p.sections.colors.find(x=>x.name===value); if(c) st.textColorRef=c.id; }
          else if(kind==='Плейсхолдер'){ const t=p.sections.typography.items.find(x=>x.name===value); if(t) st.phTypoRef=t.id; }
          else if(kind==='Цвет плейсхолдера'){ const c=p.sections.colors.find(x=>x.name===value); if(c) st.phColorRef=c.id; }
          else if(kind==='Обводка цвет'){ const c=p.sections.colors.find(x=>x.name===value); if(c) st.borderColorRef=c.id; }
          else if(kind==='Обводка толщина'){ st.borderWidth=value.replace('px',''); }
        }else if(rest==='Label (типографика)'){ const t=p.sections.typography.items.find(x=>x.name===value); if(t) f.shared.labelTypoRef=t.id; }
        else if(rest==='Label (цвет)'){ const c=p.sections.colors.find(x=>x.name===value); if(c) f.shared.labelColorRef=c.id; }
        else if(rest==='Комментарий'){ f.comment=value; }
        else if(rest==='Высота'&&ver!=='all') setVersionField(f,ver,o=>o.height=value.replace('px',''));
        else if(rest.startsWith('Отступы')&&ver!=='all'){ const vert=rest.includes('верт'); setVersionField(f,ver,o=> vert?o.padV=value.replace('px',''):o.padH=value.replace('px','')); }
        else if(rest==='Скругление'&&ver!=='all'){ const rad=p.sections.radius.find(x=>value.includes(x.name)); if(rad) setVersionField(f,ver,o=>o.radiusRef=rad.id); }
        break;
      }
      case 'Скругления': {
        if(field.endsWith(' — комментарий')){
          const nm=field.replace(' — комментарий','');
          let r=p.sections.radius.find(x=>x.name.toLowerCase()===nm.toLowerCase());
          if(!r){ r=makeRadiusItem(nm); r.locked=false; p.sections.radius.push(r);} 
          r.comment=value;
        }else{
          let r=p.sections.radius.find(x=>x.name.toLowerCase()===field.toLowerCase());
          if(!r){ r=makeRadiusItem(field); r.locked=false; p.sections.radius.push(r); }
          if(ver!=='all'){
            const corners=/\//.test(value.replace('px','')) || value.includes('по углам');
            const nums = value.replace(/[^0-9\/.\- ]/g,'').split(/[\/ ]+/).filter(Boolean);
            if(corners && nums.length>=4){
              r.mode='corners';
              setVersionField(r,ver,o=>{ o.tl=nums[0];o.tr=nums[1];o.br=nums[2];o.bl=nums[3]; });
            }else if(nums.length){
              setVersionField(r,ver,o=>{ o.common=nums[0]; });
            }
          }
        }
        break;
      }
      case 'Тени': {
        const m = field.match(/^(.+?) — слой (\d+)(?: (.+))?$/);
        if(!m) break;
        const nm=m[1], li=+m[2]-1, part=(m[3]||'').trim();
        let sh=p.sections.shadows.find(x=>x.name.toLowerCase()===nm.toLowerCase());
        if(!sh){ sh=makeShadowItem(nm); sh.locked=false; p.sections.shadows.push(sh); }
        while(sh.layers.length<=li) sh.layers.push(makeShadowLayer());
        const l=sh.layers[li];
        if(part==='(тип)') l.inner = value==='внутренняя';
        else if(part==='X') l.x=value.replace('px','');
        else if(part==='Y') l.y=value.replace('px','');
        else if(part==='Размытие') l.blur=value.replace('px','');
        else if(part==='Растяжение') l.spread=value.replace('px','');
        else if(part==='Цвет'){ const c=p.sections.colors.find(x=>x.name===value); if(c) l.colorRef=c.id; }
        else if(part==='Прозрачность') l.opacity=value.replace('%','');
        break;
      }
      case 'Отступы': {
        if(field.endsWith(' — комментарий')){
          const nm=field.replace(' — комментарий','');
          let sp=p.sections.spacing.items.find(x=>x.name.toLowerCase()===nm.toLowerCase());
          if(!sp){ sp=makeSpacingItem(nm); sp.locked=false; p.sections.spacing.items.push(sp);} 
          sp.comment=value;
        }else{
          let sp=p.sections.spacing.items.find(x=>x.name.toLowerCase()===field.toLowerCase());
          if(!sp){ sp=makeSpacingItem(field); sp.locked=false; p.sections.spacing.items.push(sp); }
          if(ver!=='all') setVersionField(sp,ver,o=>o.value=value.replace('px',''));
        }
        break;
      }
      case 'Сетка': {
        if(ver==='all') break;
        const map={'Ширина контейнера':'containerWidth','Количество колонок':'columns','Межколоночный отступ (gutter)':'gutter','Боковые поля':'sideMargins','Макс. ширина контента':'maxContentWidth'};
        const k=map[field]; if(!k) break;
        const g=p.sections.grid.perVersion[ver];
        if(g && g.inherit){ p.sections.grid.perVersion[ver]=deepClone(p.sections.grid.perVersion.desktop||{}); delete p.sections.grid.perVersion[ver].inherit; }
        p.sections.grid.perVersion[ver][k]=value.replace('px','');
        break;
      }
    }
  });
  migrateProject(p);
  return p;
}

function findOrCreateState(obj, stateLabel, presets){
  const preset = presets.find(p=>p.label===stateLabel || p.key===stateLabel);
  if(preset){ return obj.states[preset.key]; }
  let cs = (obj.customStates||[]).find(x=>x.label===stateLabel);
  if(!cs){ cs={id:uid('st'),label:stateLabel,locked:false,bgRef:null,textColorRef:null,borderColorRef:null,borderWidth:'',typoRef:null}; obj.customStates.push(cs); }
  return cs;
}

/* ===== PDF через печать ===== */
function buildPreviewHTML(project, opts, mode){
  const rows = flattenProject(project, opts);
  const title = esc(project.name);
  const desc = esc(project.description||'');
  const dateStr = new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
  const versLabel = opts.versions.map(v=>VERSION_LABELS[v]).join(', ');
  let html = `<html lang="ru"><head><meta charset="utf-8"><title>${title}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;color:#1a1f2b;font-size:12px;margin:24px;}
    h1{font-size:22px;margin:0 0 4px;} h2{font-size:15px;margin:22px 0 6px;border-bottom:2px solid #4f6ef2;padding-bottom:3px;}
    table{border-collapse:collapse;width:100%;margin:6px 0 14px;}
    th,td{border:1px solid #ccd2dd;padding:5px 8px;text-align:left;vertical-align:top;}
    th{background:#eef1f7;} .cover{text-align:center;padding:60px 0 30px;} .cover .desc{color:#666;margin-top:8px;}
    .toc a{color:#4f6ef2;text-decoration:none;} .muted{color:#777;} .swatchdot{display:inline-block;width:10px;height:10px;border-radius:50%;border:1px solid #ccc;margin-right:6px;vertical-align:-1px;}
    @media print{ body{margin:10mm;} .no-print{display:none;} }
  </style></head><body>`;
  if(mode==='client'){
    html += `<div class="cover"><h1>${title}</h1><div class="desc">${desc}</div><div class="muted" style="margin-top:16px">${dateStr} · Версии: ${versLabel}</div></div>`;
    const secs=[...new Set(rows.map(r=>r.section))];
    html += `<div class="toc"><h2>Оглавление</h2><ol>`+secs.map(s=>`<li>${esc(s)}</li>`).join('')+`</ol></div>`;
  }
  // Группировка по разделу
  let curSec=null, bySection={};
  rows.forEach(r=>{ (bySection[r.section]=bySection[r.section]||[]).push(r); });
  Object.keys(bySection).forEach(sec=>{
    html += `<h2>${esc(sec)}</h2><table><tr><th>Поле</th><th>Версия</th><th>Значение</th></tr>`;
    bySection[sec].forEach(r=>{
      let val = esc(r.value);
      if(sec==='Цвета'){ const hx=normHex(r.value); if(hx) val=`<span class="swatchdot" style="background:${hx}"></span>`+val; }
      html += `<tr><td>${esc(r.field)}</td><td>${r.version==='all'?'все':esc(VERSION_LABELS[r.version]||r.version)}</td><td>${val}</td></tr>`;
    });
    html += '</table>';
  });
  if(!rows.length) html += '<p class="muted">Нет заполненных данных для выбранных версий.</p>';
  html += '</body></html>';
  return html;
}

function exportPDF(project, opts, mode){
  const html = buildPreviewHTML(project, opts, mode);
  const w = window.open('', '_blank');
  if(!w){ toast('Разрешите всплывающие окна для печати PDF'); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(()=>{ try{ w.focus(); w.print(); }catch(e){} }, 400);
}

/* ===== JSON ===== */
function projectToJSON(project){
  return JSON.stringify({ app:'guidelines-app', version:APP_VERSION, exportedAt:nowISO(), projects:[project] }, null, 2);
}
function databaseToJSON(state){
  return JSON.stringify({ app:'guidelines-app', version:APP_VERSION, exportedAt:nowISO(), projects:state.projects, settings:state.settings }, null, 2);
}
function parseJSONFile(text){
  const data = JSON.parse(text);
  if(data.app!=='guidelines-app') throw new Error('Не наш файл JSON');
  return data;
}
