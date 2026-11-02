/* Слияние данных при импорте (п. 2.6 ТЗ) */

/* Правила «Слить» для скалярных полей с updatedAt:
   - совпадающие поля → остаётся более свежее по дате
   - только в импорте → добавляется
   - только в базе → сохраняется
   - пустое в импорте → не затирает заполненное
   - нет даты в импорте → приоритет базе
*/

function isEmptyVal(v){
  if(v===null||v===undefined) return true;
  if(typeof v==='string' && v.trim()==='') return true;
  if(Array.isArray(v) && v.length===0) return true;
  return false;
}

/* Слияние двух записей-объектов (плоских, c updatedAt) — returns merged */
function mergeRecord(base, incoming){
  const bTime = base.updatedAt ? Date.parse(base.updatedAt) : 0;
  const iTime = incoming.updatedAt ? Date.parse(incoming.updatedAt) : null;
  // если в импорте нет даты — приоритет базе (кроме случаев, когда поле базы пусто)
  const out = deepClone(base);
  for(const k of Object.keys(incoming)){
    if(k==='updatedAt') continue;
    const iv = incoming[k], bv = base[k];
    if(isEmptyVal(iv)) continue;            // пустое в импорте не затирает
    if(isEmptyVal(bv)){ out[k]=deepClone(iv); continue; }
    if(iTime===null) continue;              // нет даты — приоритет базе
    if(iTime > bTime) out[k]=deepClone(iv); // более свежее
  }
  out.updatedAt = new Date(Math.max(bTime, iTime||0)).toISOString();
  return out;
}

/* Слияние списков элементов по id; элементы, у которых id отсутствует в базе, добавляются.
   compareByName — сливать также по name (для цветов/скруглений и т.п., чтобы не плодить дубликаты) */
function mergeListById(baseArr, incArr, compareKeyFn){
  const result = deepClone(baseArr);
  incArr.forEach(inc=>{
    const keyFn = compareKeyFn || (x=>x.id);
    const bi = result.findIndex(x=>keyFn(x)===keyFn(inc));
    if(bi>=0){
      result[bi] = mergeRecord(result[bi], inc);
    }else{
      result.push(deepClone(inc));
    }
  });
  return result;
}

/* Специфичное слияние perVersion: inherit-состояние сохраняем из более свежего whole-record merge выше;
   но внутри perVersion тоже нужны правила по датам — upsert на уровне record уже достаточен,
   т.к. каждое поле версии меняется вместе с updatedAt элемента. */

function mergeProject(base, incoming){
  const out = deepClone(base);
  // Мета проекта
  ['name','description'].forEach(k=>{
    const iv = incoming[k];
    if(!isEmptyVal(iv)){
      const iTime = incoming.updatedAt?Date.parse(incoming.updatedAt):null;
      const bTime = base.updatedAt?Date.parse(base.updatedAt):0;
      if(isEmptyVal(base[k]) || (iTime!==null && iTime>bTime)) out[k]=iv;
    }
  });
  out.updatedAt = new Date(Math.max(Date.parse(base.updatedAt)||0, Date.parse(incoming.updatedAt)||0)).toISOString();

  const s = out.sections, si = incoming.sections;
  if(si){
    s.colors = mergeListById(s.colors||[], si.colors||[], x=>x.name.toLowerCase());
    // primary-источники типографики
    const pb = s.typography.primary || {};
    const pi = si.typography?.primary || {};
    Object.keys(pi).forEach(k=>{
      if(!pb[k]) pb[k]=pi[k];
      else pb[k]=mergeRecord(Object.assign({updatedAt:base.updatedAt},pb[k]), Object.assign({updatedAt:incoming.updatedAt},pi[k]));
    });
    s.typography.primary = pb;
    s.typography.items = mergeListById(s.typography.items||[], si.typography?.items||[]);
    s.buttons = mergeListById(s.buttons||[], si.buttons||[]);
    s.inputs = mergeListById(s.inputs||[], si.inputs||[]);
    s.radius = mergeListById(s.radius||[], si.radius||[], x=>x.name.toLowerCase());
    s.shadows = mergeListById(s.shadows||[], si.shadows||[], x=>x.name.toLowerCase());
    s.spacing.items = mergeListById(s.spacing.items||[], si.spacing?.items||[], x=>x.name.toLowerCase());
    // grid
    const gb = s.grid||makeGridSection(), gi = si.grid;
    if(gi){
      VERSIONS.forEach(v=>{
        const a = gb.perVersion[v]||{}, b = gi.perVersion?.[v];
        if(!b) return;
        if(b.inherit && !a.inherit){ /* база локальна — не наследуем от импорта, если база правлена позже */ 
          const iTime=gi.updatedAt?Date.parse(gi.updatedAt):(incoming.updatedAt?Date.parse(incoming.updatedAt):null);
          const bTime=(gb.updatedAt?Date.parse(gb.updatedAt):0);
          if(iTime!==null && iTime>bTime && isEmptyVal(a.containerWidth)) gb.perVersion[v]=deepClone(b);
          return;
        }
        gb.perVersion[v] = mergeRecord(Object.assign({updatedAt:gb.updatedAt},a), Object.assign({updatedAt:gi.updatedAt||incoming.updatedAt},b));
      });
      s.grid = gb;
    }
  }
  migrateProject(out);
  return out;
}

/* Полная замена */
function replaceProject(base, incoming){
  const out = deepClone(incoming);
  out.id = base.id; // сохраняем id в базе, если импорт в конкретный проект
  migrateProject(out);
  return out;
}

/* Слияние всей базы проектов: по id проекта; новых добавляем; совпадающие — mergeProject */
function mergeDatabase(baseState, incomingState){
  const result = deepClone(baseState);
  const incProjects = Array.isArray(incomingState.projects)?incomingState.projects:[].concat(incomingState.projects||[]);
  incProjects.forEach(ip=>{
    const bi = result.projects.findIndex(p=>p.id===ip.id);
    if(bi>=0){
      result.projects[bi] = mergeProject(result.projects[bi], ip);
    }else{
      result.projects.push(deepClone(ip));
    }
  });
  result.projects.forEach(migrateProject);
  return result;
}

function replaceDatabase(baseState, incomingState){
  const result = { projects: deepClone(incomingState.projects||[]), settings: baseState.settings };
  result.projects.forEach(migrateProject);
  return result;
}
