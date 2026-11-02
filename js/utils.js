/* Утилиты */
const APP_VERSION = '1.0.0';

function uid(prefix){ return (prefix||'id') + '_' + Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4); }
function nowISO(){ return new Date().toISOString(); }
function deepClone(o){ return JSON.parse(JSON.stringify(o)); }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function fmtDate(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(isNaN(d)) return '';
  const today = new Date(); 
  const sameDay = d.toDateString()===today.toDateString();
  if(sameDay) return d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short',year: d.getFullYear()!==today.getFullYear()?'numeric':undefined});
}

/* el — создание DOM из тега-строки или helper */
function h(htmlStr){ const t=document.createElement('template'); t.innerHTML=htmlStr.trim(); return t.content.firstElementChild; }
function frag(htmlStr){ const t=document.createElement('template'); t.innerHTML=htmlStr.trim(); return t.content; }

/* Простейший реактивный стор-подход: render() перерисовывает экран целиком.
   Чтобы фокус в инпутах не терялся, поля ввода работают с делегированием событий
   и не перерисовывают экран при каждом нажатии (только commit по blur/change). */

function toast(msg){
  document.querySelectorAll('.toast').forEach(t=>t.remove());
  const el = h(`<div class="toast">${esc(msg)}</div>`);
  document.body.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; }, 1800);
  setTimeout(()=>el.remove(), 2200);
}

/* Модальные окна */
function openModal(contentNode){
  closeModal();
  const ov = h('<div class="overlay"></div>');
  ov.appendChild(contentNode);
  ov.addEventListener('mousedown', e=>{ if(e.target===ov) closeModal(); });
  document.body.appendChild(ov);
  return ov;
}
function closeModal(){ document.querySelectorAll('.overlay').forEach(o=>o.remove()); }

function confirmDialog({title, text, danger, okLabel, cancelLabel}){
  return new Promise(resolve=>{
    const m = h(`<div class="modal"><h3>${esc(title)}</h3>${text?`<div class="muted">${esc(text)}</div>`:''}
      <div class="modal-actions">
        <button class="btn" data-x="no">${esc(cancelLabel||'Отмена')}</button>
        <button class="btn ${danger?'btn-danger':'btn-primary'}" data-x="ok">${esc(okLabel||'Да')}</button>
      </div></div>`);
    m.querySelector('[data-x=no]').onclick=()=>{closeModal();resolve(false);};
    m.querySelector('[data-x=ok]').onclick=()=>{closeModal();resolve(true);};
    openModal(m);
  });
}

/* Валидация HEX */
function normHex(v){
  if(!v) return '';
  let s = String(v).trim().replace(/^#/,'');
  if(/^[0-9a-fA-F]{3}$/.test(s)) s = s.split('').map(c=>c+c).join('');
  if(/^[0-9a-fA-F]{6}$/.test(s)) return '#'+s.toUpperCase();
  return null;
}

/* Числа px: парсим "12", "12px" */
function numVal(v){ if(v==='' || v==null) return null; const n=parseFloat(String(v)); return isNaN(n)?null:n; }

/* Скачивание файла */
function downloadBlob(name, blob){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function downloadText(name, text, mime){ downloadBlob(name, new Blob([text], {type:mime||'text/plain;charset=utf-8'})); }

/* CSV helpers */
function csvEscape(v){ v = String(v==null?'':v); return /[",;\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; }

/* Drag & drop для списков (HTML5) */
function enableDragSort(listEl, onReorder){
  let dragIdx = null;
  listEl.addEventListener('dragstart', e=>{
    const row = e.target.closest('[data-dragidx]');
    if(!row){ e.preventDefault(); return; }
    dragIdx = +row.dataset.dragidx;
    e.dataTransfer.effectAllowed='move';
    try{ e.dataTransfer.setData('text/plain', String(dragIdx)); }catch(_){}
  });
  listEl.addEventListener('dragover', e=>{
    const row = e.target.closest('[data-dragidx]');
    if(!row || dragIdx===null) return;
    e.preventDefault();
    listEl.querySelectorAll('.item-row-dragover').forEach(r=>r.classList.remove('item-row-dragover'));
    row.classList.add('item-row-dragover');
  });
  listEl.addEventListener('drop', e=>{
    const row = e.target.closest('[data-dragidx]');
    if(!row || dragIdx===null) return;
    e.preventDefault();
    const to = +row.dataset.dragidx;
    if(to!==dragIdx && onReorder) onReorder(dragIdx, to);
    dragIdx=null;
  });
  listEl.addEventListener('dragend', ()=>{
    dragIdx=null;
    listEl.querySelectorAll('.item-row-dragover').forEach(r=>r.classList.remove('item-row-dragover'));
  });
}
