/* Модель данных и фабрики */

const VERSIONS = ['desktop','tablet','mobile'];
const VERSION_LABELS = { desktop:'Десктоп', tablet:'Планшет', mobile:'Телефон' };
const SHORT_VERSION_LABELS = { desktop:'ПК', tablet:'Планшет', mobile:'Телефон' };

const SECTIONS = [
  { id:'colors',      title:'Цвета',            icon:'palette',   crossVersion:true },
  { id:'typography',  title:'Типографика',      icon:'type' },
  { id:'buttons',     title:'Кнопки',           icon:'buttonUI' },
  { id:'inputs',      title:'Поля ввода',       icon:'inputUI' },
  { id:'radius',      title:'Скругления',       icon:'radiusUI' },
  { id:'shadows',     title:'Тени',             icon:'shadowUI',  crossVersion:true },
  { id:'spacing',     title:'Отступы и сетка',  icon:'spacingUI' },
];

const WEIGHTS = ['Light','Regular','Medium','SemiBold','Bold','ExtraBold','Black'];

const FONT_FAMILIES = [
  'System UI (-apple-system)','Inter','Roboto','Open Sans','Montserrat','Manrope','PT Sans',
  'Golos Text','Unbounded','Playfair Display','Merriweather','Lora','Cormorant','Raleigh',
  'IBM Plex Sans','Arial','Helvetica','Georgia','Times New Roman','Courier New','Verdana','Tahoma','Trebuchet MS','Tinos','Mannafont',
];

/* ---- Первичные источники типографики (сквозные) ---- */
const TYPO_PRIMARY_DEFAULTS = [
  { key:'headings', label:'Шрифт заголовки',      family:'', weight:'Bold',   appliesTo:'h' },
  { key:'body',     label:'Шрифт основной текст', family:'', weight:'Regular',appliesTo:'t' },
];

/* ---- Предопределённые цвета ---- */
const PRESET_COLORS = [
  { name:'Основной',                 role:'primary' },
  { name:'Акцентный',                role:'accent' },
  { name:'Дополнительный',           role:'secondary' },
  { name:'Цвет карточек и плашек',   role:'card' },
  { name:'Акцент наведение (hover)', role:'hover' },
  { name:'Ошибка',                   role:'error' },
  { name:'Успех',                    role:'success' },
  { name:'Неактивно',                role:'disabled' },
  { name:'Текст тёмный (основной)',  role:'textDark' },
  { name:'Текст светлый',            role:'textLight' },
];

/* дефолтный цвет текста для полей типографики/кнопок */
const DEFAULT_TEXT_COLOR_ROLE = 'textDark';

/* ---- Типографика: группы и предуставленные пункты ---- */
const TYPO_GROUPS = [
  { key:'h',  label:'Заголовки',     prefix:'H',  preset:['H1','H2','H3'],          lhDef:110, primary:'headings' },
  { key:'t',  label:'Основной текст',prefix:'T',  preset:['T1','T2','T3'],          lhDef:140, primary:'body' },
  { key:'mp', label:'Мелкие подписи',prefix:'MP', preset:['MP-1','MP-2','MP-3'],    lhDef:140, primary:'body' },
];

/* ---- Кнопки: стили и размеры ---- */
const BUTTON_STYLES = [
  { key:'fill',   label:'Заливка' },
  { key:'outline',label:'Обводка' },
];
const BUTTON_SIZE_ORDER = ['XXL','XL','L','M','S','XS','XXS']; // L — стартовый
const BUTTON_PRESET_SIZES = ['L'];

const BUTTON_STATE_PRESETS = [
  { key:'normal',   label:'Обычное',  locked:true },
  { key:'hover',    label:'Hover',    locked:true },
  { key:'active',   label:'Active',   locked:true },
  { key:'disabled', label:'Disabled', locked:true },
  { key:'focus',    label:'Focus',    locked:true },
];

/* ---- Поля ввода ---- */
const INPUT_SIZE_ORDER = ['XXL','XL','L','M','S','XS','XXS'];
const INPUT_PRESET_SIZES = ['L'];
const INPUT_STATE_PRESETS = [
  { key:'normal',   label:'Обычное',  locked:true },
  { key:'focus',    label:'Focus',    locked:true },
  { key:'error',    label:'Error',    locked:true },
  { key:'disabled', label:'Disabled', locked:true },
];

/* ---- Скругления ---- */
const RADIUS_PRESETS = ['Скругление кнопок','Скругление карточек','Скругление плашек'];
const RADIUS_LOCKED_NAMES = new Set(RADIUS_PRESETS); // удалить нельзя, только очистить

/* ---- Тени ---- */
const SHADOW_PRESETS = ['Тень кнопок','Тень карточек','Тень плашек','Тень полей ввода'];
const SHADOW_LOCKED_NAMES = new Set(SHADOW_PRESETS);

/* ---- Отступы ---- */
const SPACING_PRESETS = [
  'Между блоками',
  'От картинки до текста',
  'От текста до картинки',
  'От заголовка до подзаголовка',
  'От подзаголовка до подзаголовка меньшего порядка',
  'От подзаголовка меньшего порядка до основного текста',
  'От текста до кнопки',
  'От кнопки до текста',
  'От верхней границы блока до контента',
  'От контента до нижней границы блока',
  'Между карточками по горизонтали',
  'Между карточками по вертикали',
  'От контента до карточки сверху',
  'От карточки до контента снизу',
];

/* Tilda 12-col grid defaults (desktop) */
const TILDA_GRID = {
  desktop:{ containerWidth:'1170', columns:'12', gutter:'30', sideMargins:'15', maxContentWidth:'1140' },
  tablet: { containerWidth:'768',  columns:'12', gutter:'20', sideMargins:'20', maxContentWidth:'728'  },
  mobile: { containerWidth:'360',  columns:'12', gutter:'10', sideMargins:'15', maxContentWidth:'330'  },
};

/* ================= Фабрики ================= */

function makeColorItem(name, opts={}){
  return {
    id: opts.id || uid('c'),
    name,
    hex: '',
    locked: !!opts.locked,
    role: opts.role || null,
    comment: '',
    updatedAt: nowISO(),
  };
}

function makeTypoItem(groupKey, name){
  const g = TYPO_GROUPS.find(x=>x.key===groupKey);
  return {
    id: uid('ty'),
    group: groupKey,
    name,
    locked: true, // предустановленный или добавленный — удаление со схлопыванием; не "locked" в смысле удаления
    canDelete: true,
    fields: {}, // version -> overrides
    shared: {
      fontOverride: null,       // string|null — ручная правка шрифта
      weight: '',               // сквозное
      colorRef: null,           // uuid|null; null => default text color role
      lineHeightUnit: '%',      // '%' | 'ratio'
      letterSpacingUnit: '%',
    },
    perVersion: {
      desktop:{ size:'', lineHeight: String(g.lhDef), letterSpacing:'0' },
      tablet: { inherit:true },
      mobile: { inherit:true },
    },
    comment: '',
    updatedAt: nowISO(),
  };
}

function makeButtonCell(styleKey, size){
  const states = {};
  BUTTON_STATE_PRESETS.forEach(sp=>{
    states[sp.key] = {
      id: sp.key, label: sp.label, locked: true,
      bgRef: null,
      typoRef: null,
      textColorRef: null, // переопределение цвета поверх типографики
      borderColorRef: null, borderWidth: '',
    };
  });
  return {
    id: uid('btn'),
    style: styleKey, size,
    states, customStates: [],
    shared: {
      typoRef: null,
      radiusRef: 'auto-buttons', // ссылка на «Скругление кнопок» (по умолчанию)
      shadowRef: 'auto-buttons-shadow', // ссылка на «Тень кнопок»
    },
    perVersion: {
      desktop:{ height:'', padV:'', padH:'', radiusOverride:null, shadowOverride:null, sizeOverride:null },
      tablet: { inherit:true },
      mobile: { inherit:true },
    },
    comment: '',
    updatedAt: nowISO(),
  };
}

function makeInputField(size){
  const states = {};
  INPUT_STATE_PRESETS.forEach(sp=>{
    states[sp.key] = {
      id: sp.key, label: sp.label, locked: true,
      bgRef: null,
      textTypoRef: null, textColorRef: null,
      phTypoRef: null, phColorRef: null,
      borderColorRef: null, borderWidth: '',
    };
  });
  return {
    id: uid('inp'),
    size,
    states, customStates: [],
    shared: {
      labelTypoRef: null, labelColorRef: null,
    },
    perVersion: {
      desktop:{ height:'', padV:'', padH:'', radiusRef:null, shadowRef:'auto-inputs-shadow', sizeOverride:null },
      tablet: { inherit:true },
      mobile: { inherit:true },
    },
    comment: '',
    updatedAt: nowISO(),
  };
}

function makeRadiusItem(name){
  return {
    id: uid('r'),
    name,
    locked: !name, // preset locked if created via factory with preset name
    mode: 'common', // 'common' | 'corners'
    perVersion: {
      desktop:{ common:'', tl:'', tr:'', br:'', bl:'' },
      tablet: { inherit:true },
      mobile: { inherit:true },
    },
    comment: '',
    updatedAt: nowISO(),
  };
}

function makeShadowLayer(){
  return {
    id: uid('sl'),
    inner: false, x:'', y:'', blur:'', spread:'', colorRef:null, opacity:'',
  };
}
function makeShadowItem(name){
  return {
    id: uid('sh'),
    name,
    layers: [makeShadowLayer()],
    comment: '',
    updatedAt: nowISO(),
  };
}

function makeSpacingItem(name){
  return {
    id: uid('sp'),
    name,
    perVersion: {
      desktop:{ value:'' },
      tablet: { inherit:true },
      mobile: { inherit:true },
    },
    comment: '',
    updatedAt: nowISO(),
  };
}

function makeGridSection(){
  const per = {};
  VERSIONS.forEach(v=>{
    per[v] = { containerWidth:'', columns:'', gutter:'', sideMargins:'', maxContentWidth:'' };
  });
  per.tablet.inherit = true; per.mobile.inherit = true;
  return { perVersion: per, updatedAt: nowISO() };
}

/* Создать пустую структуру секций проекта */
function makeSectionsData(){
  const colors = PRESET_COLORS.map(p=>makeColorItem(p.name,{locked:true, role:p.role}));
  const typography = {
    primary: Object.fromEntries(TYPO_PRIMARY_DEFAULTS.map(p=>({key:p.key, val:{family:'', weight:p.weight}}))),
    items: []
  };
  TYPO_GROUPS.forEach(g=>g.preset.forEach(n=>typography.items.push(makeTypoItem(g.key,n))));

  const buttons = [];
  BUTTON_STYLES.forEach(st=>BUTTON_PRESET_SIZES.forEach(sz=>buttons.push(makeButtonCell(st.key,sz))));

  const inputs = INPUT_PRESET_SIZES.map(sz=>makeInputField(sz));

  const radius = RADIUS_PRESETS.map(n=>{ const r=makeRadiusItem(n); r.locked=true; return r; });
  const shadows = SHADOW_PRESETS.map(n=>{ const s=makeShadowItem(n); s.locked=true; return s; });
  const spacing = SPACING_PRESETS.map(n=>{ const s=makeSpacingItem(n); s.locked=true; return s; });

  return {
    colors,
    typography,
    buttons,
    inputs,
    radius,
    shadows,
    spacing: { items: spacing },
    grid: makeGridSection(),
  };
}

function makeProject(name, description){
  const t = nowISO();
  return {
    id: uid('p'),
    name: name || 'Новый проект',
    description: description || '',
    createdAt: t,
    updatedAt: t,
    activeVersion: 'desktop',
    sections: makeSectionsData(),
  };
}

/* Получить пункт по magic-ref ('auto-buttons' → «Скругление кнопок») */
function resolveRadiusRef(project, ref){
  if(!ref) return null;
  if(ref==='auto-buttons'){ return project.sections.radius.find(r=>r.name==='Скругление кнопок')||null; }
  if(ref==='auto-cards'){ return project.sections.radius.find(r=>r.name==='Скругление карточек')||null; }
  if(ref==='auto-tablets'){ return project.sections.radius.find(r=>r.name==='Скругление плашек')||null; }
  return project.sections.radius.find(r=>r.id===ref)||null;
}
function resolveShadowRef(project, ref){
  if(!ref) return null;
  if(ref==='auto-buttons-shadow'){ return project.sections.shadows.find(s=>s.name==='Тень кнопок')||null; }
  if(ref==='auto-inputs-shadow'){ return project.sections.shadows.find(s=>s.name==='Тень полей ввода')||null; }
  if(ref==='auto-cards-shadow'){ return project.sections.shadows.find(s=>s.name==='Тень карточек')||null; }
  if(ref==='auto-tablets-shadow'){ return project.sections.shadows.find(s=>s.name==='Тень плашек')||null; }
  return project.sections.shadows.find(s=>s.id===ref)||null;
}
function resolveColorRef(project, ref){
  if(!ref) return null;
  return project.sections.colors.find(c=>c.id===ref)||null;
}
function resolveTypoRef(project, ref){
  if(!ref) return null;
  return project.sections.typography.items.find(t=>t.id===ref)||null;
}
