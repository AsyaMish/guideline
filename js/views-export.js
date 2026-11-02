/* Экран «Экспорт» проекта */

const ExportState = {
  versions:{desktop:true,tablet:true,mobile:true},
  onlyFilled:true,
  mode:'client', // 'client' | 'internal'
};

function renderExport(project, params){
  const scr=h('<div class="screen"></div>');
  const st=ExportState;

  const card=h('<div class="card" style="padding:16px"></div>');
  card.appendChild(h('<h3 style="margin:0 0 12px">Параметры экспорта</h3>'));

  // Версии (для PDF/CSV)
  const vg=h('<div class="filter-group"><label>Версии для выгрузки</label><div class="chips"></div></div>');
  VERSIONS.forEach(v=>{
    const c=h(`<button class="chip ${st.versions[v]?'on':''}">${VERSION_LABELS[v]}</button>`);
    c.onclick=()=>{st.versions[v]=!st.versions[v];App.render();};
    vg.querySelector('.chips').appendChild(c);
  });
  card.appendChild(vg);

  const of=h(`<label class="chk" style="margin-bottom:8px"><input type="checkbox" ${st.onlyFilled?'checked':''}> Только заполненные поля</label>`);
  of.querySelector('input').onchange=e=>{st.onlyFilled=e.target.checked;App.render();};
  card.appendChild(of);

  const mg=h('<div class="filter-group"><label>Формат PDF</label><div class="chips"></div></div>');
  [['client','Клиентский (титул + оглавление)'],['internal','Внутренний (без титула)']].forEach(([k,l])=>{
    const c=h(`<button class="chip ${st.mode===k?'on':''}">${l}</button>`);
    c.onclick=()=>{st.mode=k;App.render();};
    mg.querySelector('.chips').appendChild(c);
  });
  card.appendChild(mg);
  scr.appendChild(card);

  const opts={ versions: VERSIONS.filter(v=>st.versions[v]), onlyFilled: st.onlyFilled };

  // Кнопки выгрузки
  const btns=h('<div class="card section-gap" style="padding:16px;display:flex;flex-direction:column;gap:10px"></div>');
  const bPdf=h(`<button class="btn btn-primary btn-block">${ICONS.pdf} Выгрузить в PDF (печать → Сохранить как PDF)</button>`);
  bPdf.onclick=()=>exportPDF(project,opts,st.mode);
  const bCsv=h(`<button class="btn btn-block">${ICONS.table} Выгрузить в CSV</button>`);
  bCsv.onclick=()=>{
    const rows=flattenProject(project,opts);
    downloadText(safeFileName(project.name)+'.csv', toCSV(rows,{name:project.name,updatedAt:project.updatedAt}), 'text/csv;charset=utf-8');
    toast('CSV сохранён');
  };
  const bJson=h(`<button class="btn btn-block">${ICONS.braces} Выгрузить в JSON</button>`);
  bJson.onclick=()=>{
    downloadText(safeFileName(project.name)+'.json', projectToJSON(project), 'application/json');
    toast('JSON сохранён');
  };
  btns.appendChild(bPdf);btns.appendChild(bCsv);btns.appendChild(bJson);
  scr.appendChild(btns);

  // Предпросмотр
  const pv=h('<div class="card section-gap" style="padding:16px"></div>');
  pv.appendChild(h('<h3 style="margin:0 0 10px">Предпросмотр данных</h3>'));
  const previewBox=h('<div class="preview"></div>');
  const rows=flattenProject(project,opts);
  if(!rows.length) previewBox.appendChild(h('<div class="muted">Нет заполненных данных.</div>'));
  else{
    let bySec={};
    rows.forEach(r=>{(bySec[r.section]=bySec[r.section]||[]).push(r);});
    const table=h('<table><tr><th>Поле</th><th>Версия</th><th>Значение</th></tr></table>');
    Object.keys(bySec).forEach(sec=>{
      table.appendChild(h(`<tr><td colspan="3" style="background:var(--surface2);font-weight:700">${esc(sec)}</td></tr>`));
      bySec[sec].forEach(r=>{
        let val=esc(r.value);
        if(sec==='Цвета'){const hx=normHex(r.value); if(hx) val=`<span class="swatch" style="width:14px;height:14px;display:inline-block;border-radius:50%;vertical-align:-2px;background:${hx}"></span> `+val;}
        table.appendChild(h(`<tr><td>${esc(r.field)}</td><td>${r.version==='all'?'все':esc(VERSION_LABELS[r.version]||r.version)}</td><td>${val}</td></tr>`));
      });
    });
    previewBox.appendChild(table);
  }
  pv.appendChild(previewBox);
  scr.appendChild(pv);

  return scr;
}

function safeFileName(n){ return (n||'project').replace(/[\\/:*?"<>|]+/g,'_').slice(0,80); }
