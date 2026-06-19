// ===== Цифровой архив «Зотов» — клик-прототип публичной части =====
// Связи хранятся в данных и делаются ДВУСТОРОННИМИ при инициализации —
// поэтому объект, созданный один раз, автоматически появляется на страницах
// всех связанных сущностей (главный принцип ТЗ).

const TYPES = {
  material:{l:'Материал',pl:'Материалы'}, person:{l:'Личность',pl:'Личности'},
  place:{l:'Место',pl:'Места'}, event:{l:'Событие',pl:'События'},
  theme:{l:'Тема',pl:'Темы'}, project:{l:'Выставка / проект',pl:'Выставки и проекты'},
  org:{l:'Организация',pl:'Организации'}, collection:{l:'Коллекция / фонд',pl:'Коллекции'},
  source:{l:'Источник',pl:'Источники'}, media:{l:'Медиафайл',pl:'Медиафайлы'},
  tag:{l:'Тег',pl:'Теги'}
};

const RAW = [
  {id:'m1',type:'material',title:'Фотография экспозиции выставки, 1927',subtype:'Фотография · Ч/б',date:'1927 (около)',access:'request',authors:['p1'],
   links:['p1','p2','pl1','e1','t1','t2','pr1','o1','c1','s1','md1','tg1','tg2']},
  {id:'m2',type:'material',title:'Афиша выставки «1927»',subtype:'Печатное издание · Афиша',date:'1927',access:'open',authors:['p2'],
   links:['p2','pr1','t1','o2','c1','s1','tg3']},
  {id:'m3',type:'material',title:'Чертёж фасада жилого дома',subtype:'Документ · Чертёж',date:'1925',access:'open',authors:['p3'],
   links:['p3','pl1','t1','o1','c1','tg1','tg2']},
  {id:'m4',type:'material',title:'Запись лекции об архитектуре',subtype:'Аудио',date:'1928',access:'request',
   links:['p1','e2','t1','pr1','md2']},

  {id:'p1',type:'person',title:'Александр Родченко',life:'1891–1956',role:'художник, фотограф, дизайнер',links:['e1','t1','t2','pr1','o1','o2','pl1','s1']},
  {id:'p2',type:'person',title:'Варвара Степанова',life:'1894–1958',role:'художница, дизайнер',links:['pr1','t1','o1']},
  {id:'p3',type:'person',title:'Эль Лисицкий',life:'1890–1941',role:'архитектор, типограф',links:['t1','t2','o1','pl1']},

  {id:'pl1',type:'place',title:'Хлебозавод №5',placeType:'Здание · промышленная архитектура',address:'Москва, ул. Ходынская, 2',status:'Существует',coord:'55.79, 37.59',links:['e1','o1','pr1','s1']},
  {id:'pl2',type:'place',title:'ВХУТЕМАС (Мясницкая, 21)',placeType:'Учебное заведение',address:'Москва, Мясницкая, 21',status:'Существует',coord:'55.76, 37.63',links:['o1','e2']},

  {id:'e1',type:'event',title:'Открытие выставки «1927»',date:'12 марта 1927',evType:'Открытие выставки',inChrono:true,links:['pr1','o1','t1']},
  {id:'e2',type:'event',title:'Лекция об архитектуре конструктивизма',date:'1928',evType:'Лекция',inChrono:true,links:['pl2','t1']},

  {id:'t1',type:'theme',title:'Конструктивизм',def:'Смысловой узел: направление, объединяющее материалы, личности, события и выставки.',sub:['Производственное искусство','Фотомонтаж','Типографика','Агитпроп'],links:['o1','o2']},
  {id:'t2',type:'theme',title:'Фотомонтаж',def:'Приём и тема в искусстве авангарда.',sub:[],links:[]},

  {id:'pr1',type:'project',title:'Выставка «1927»',dates:'12.03 — 30.06.1927',curators:'И. Иванов, П. Петров',venue:'pl1',prType:'Выставочный проект',links:['o1','o2','t1','s1']},

  {id:'o1',type:'org',title:'ВХУТЕМАС',orgType:'Учебно-производственные мастерские',period:'1920 — 1930',links:['pl2','s1']},
  {id:'o2',type:'org',title:'Госиздат',orgType:'Издательство',period:'1919 — 1930',links:[]},

  {id:'c1',type:'collection',title:'Архив выставок',colType:'Выставочный фонд',period:'1920-е — 1930-е',sub:['Каталоги','Фотохроника','Афиши','Документы'],links:['o1','t1','s1']},

  {id:'s1',type:'source',title:'Каталог выставки «1927»',author:'И. Иванов',year:'1927',srcType:'Каталог',publisher:'Госиздат',pubplace:'Москва',links:[]},

  {id:'md1',type:'media',title:'photo_001.jpg',format:'JPEG',size:'4.2 МБ',res:'4000 × 3000',dur:'—',access:'request',parent:'m1',links:[]},
  {id:'md2',type:'media',title:'lecture_1928.mp3',format:'MP3',size:'58 МБ',res:'—',dur:'42:10',access:'request',parent:'m4',links:[]},

  {id:'tg1',type:'tag',title:'лестница',links:[]},{id:'tg2',type:'tag',title:'чертёж',links:[]},{id:'tg3',type:'tag',title:'афиша',links:[]}
];

// --- расширение данных для демонстрации фильтрации ---
RAW.push(
  {id:'p4',type:'person',title:'Дзига Вертов',life:'1896–1954',role:'кинорежиссёр, теоретик кино',links:['pr2','t1']},
  {id:'pl3',type:'place',title:'Москва',placeType:'Город',address:'Россия',status:'Существует',coord:'55.75, 37.62',links:[]},
  {id:'pr2',type:'project',title:'Выставка «Дзига Вертов. Киноглаз»',dates:'2023',curators:'Центр «Зотов»',venue:'pl3',prType:'Выставочный проект',links:['t1','p4']},
  {id:'s2',type:'source',title:'Каталог «Киноглаз»',author:'—',year:'1924',srcType:'Каталог',publisher:'Госиздат',pubplace:'Москва',links:[]}
);
// тип материала / медиа / доступность для существующих материалов
const MAT_META={
  m1:{mtype:'Изображение',media:['image'],a11y:[],lang:'—'},
  m2:{mtype:'Печатная продукция',media:['image'],a11y:[],lang:'рус'},
  m3:{mtype:'Графика',media:['image','pdf'],a11y:[],lang:'—'},
  m4:{mtype:'Аудио',media:['audio'],a11y:['расшифровка'],lang:'рус'}
};
RAW.forEach(o=>{ if(MAT_META[o.id]) Object.assign(o,MAT_META[o.id]); });
RAW.push(
  {id:'m5',type:'material',title:'Интервью с Александром Родченко',subtype:'Интервью',mtype:'Видео',date:'1930',access:'open',media:['video'],a11y:['субтитры','РЖЯ'],lang:'рус',authors:['p1'],links:['p1','t1','t2']},
  {id:'m6',type:'material',title:'Кинохроника «Киноглаз»',subtype:'Фильм',mtype:'Видео',date:'1924',access:'open',media:['video'],a11y:['субтитры'],lang:'рус',authors:['p4'],links:['p4','pr2','t1']},
  {id:'m7',type:'material',title:'Каталог выставки «Киноглаз»',subtype:'Каталог',mtype:'Печатная продукция',date:'1924',access:'open',media:['pdf'],a11y:[],lang:'рус',links:['p4','pr2','s2','c1']},
  {id:'m8',type:'material',title:'Протокол заседания ВХУТЕМАС',subtype:'Протокол',mtype:'Документ',date:'1923',access:'restricted',media:['pdf'],a11y:[],lang:'рус',links:['o1','pl2']},
  {id:'m9',type:'material',title:'Статья о фотомонтаже',subtype:'Статья',mtype:'Текст',date:'1926',access:'open',media:[],a11y:[],lang:'рус',links:['t2','p1','s1']},
  {id:'m10',type:'material',title:'Макет агитустановки',subtype:'Эскиз-макет',mtype:'Макет',date:'1929',access:'request',media:['image','3d'],a11y:[],lang:'—',links:['p3','t1','pl3']},
  {id:'m11',type:'material',title:'Плакат «Москва строится»',subtype:'Плакат',mtype:'Графика',date:'1931',access:'open',media:['image'],a11y:[],lang:'рус',links:['pl3','t1','o2']},
  {id:'m12',type:'material',title:'Аудиогид по выставке',subtype:'Аудиогид',mtype:'Аудио',date:'2023',access:'open',media:['audio'],a11y:['аудиоописание','расшифровка'],lang:'рус',links:['pr1']}
);

// index + bidirectional links
const DB = {}; RAW.forEach(o=>{o.links=o.links||[];DB[o.id]=o});
RAW.forEach(o=>o.links.forEach(id=>{ if(DB[id] && !DB[id].links.includes(o.id)) DB[id].links.push(o.id); }));
const all = t => RAW.filter(o=>o.type===t);
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');

// ---------- shared chrome ----------
const NAV=[['Архив','#/archive'],['Хронограф','#/chrono'],['Карта','#/map'],['Личности','#/cat/person'],['Темы','#/cat/theme'],['Коллекции','#/cat/collection'],['Проекты','#/cat/project'],['Библиотека','#/library']];
function header(active){
  return `<header class="top"><div class="row">
    <a class="logo" href="#/">ЗОТОВ · АРХИВ</a>
    <nav class="main">${NAV.map(([t,h])=>`<a href="${h}" class="${active===h?'active':''}">${t}</a>`).join('')}
    <a href="#/archive">Поиск ⌕</a><a class="btn dark" href="#/cabinet">Войти</a></nav>
  </div></header>`;
}
function footer(){return `<footer><div class="cols">
  <div><h4>Архив</h4><a href="#/chrono">Хронограф</a><a href="#/map">Карта</a><a href="#/cat/person">Личности</a><a href="#/cat/theme">Темы</a></div>
  <div><h4>Коллекции</h4><a href="#/cat/collection">Проекты Центра</a><a href="#/library">Библиотека</a><a href="#/archive">Весь архив</a></div>
  <div><h4>Исследователям</h4><a href="#/cabinet">Регистрация</a><a href="#/cabinet">Заявки на доступ</a><a href="#/cabinet">Личный кабинет</a></div>
  <div><h4>Центр «Зотов»</h4><a href="#/">О центре</a><a href="#/">Контакты</a><a href="#/">hello@zotov.ru</a></div>
</div></footer>`;}
const page=(active,inner)=>header(active)+`<main class="wrap">${inner}</main>`+footer();
const link=o=>`<a class="chip" href="#/e/${o.id}">${esc(o.title)}</a>`;
const tileMeta=o=>o.date||o.subtype||o.role||o.dates||o.life||o.placeType||o.colType||o.prType||o.orgType||'';
const tile=o=>`<a class="card tile" href="#/e/${o.id}"><div class="img"></div><div class="kicker">${TYPES[o.type].l}</div><div class="t">${esc(o.title)}</div><div class="muted" style="font-size:13px">${esc(tileMeta(o))}</div></a>`;

// связанные сущности: часть — карточками (как материалы), часть — ссылками-чипами (как темы)
const CARD_TYPES=['material','person','place','event','project','collection'];
const REL_ORDER=['material','person','place','event','project','collection','theme','org','source','tag'];
const REL_HEAD={material:'Материалы',person:'Связанные личности',place:'Связанные места',event:'Связанные события',project:'Связанные выставки и проекты',collection:'Коллекции и фонды',theme:'Темы',org:'Организации',source:'Источники',tag:'Теги'};
function relatedSections(o){
  const by={}; (o.links||[]).forEach(id=>{const x=DB[id];if(x&&x.id!==o.id&&x.type!=='media')(by[x.type]=by[x.type]||[]).push(x);});
  return REL_ORDER.filter(t=>by[t]&&by[t].length).map(t=>{
    const items=by[t];
    const inner=CARD_TYPES.includes(t)
      ?`<div class="grid ${t==='person'?'g4':'g3'}">${items.map(tile).join('')}</div>`
      :`<div class="chips" style="margin-top:4px">${items.map(link).join('')}</div>`;
    return `<h2>${REL_HEAD[t]}</h2>${inner}`;
  }).join('');
}
// похожие материалы — по общим связям (темы/теги/личности), без дублей с прямыми связями
function similarBlock(o){
  if(o.type!=='material') return '';
  const direct=new Set(o.links||[]);
  const sim=all('material').filter(m=>m.id!==o.id&&!direct.has(m.id)&&(m.links||[]).some(id=>direct.has(id)));
  return sim.length?`<h2>Похожие материалы</h2><div class="muted" style="font-size:13px;margin:-6px 0 10px">По общим темам, тегам и связям.</div><div class="grid g3">${sim.map(resultCard).join('')}</div>`:'';
}
// компактный поиск внутри раздела (фильтрует видимый список по названию)
function sectionSearch(ph){return `<input class="secsearch" placeholder="${ph||'Поиск в разделе'}" oninput="filterCat(this.value)">`;}
window.filterCat=q=>{const ql=q.trim().toLowerCase();document.querySelectorAll('#catgrid > a').forEach(el=>{el.style.display=el.textContent.toLowerCase().includes(ql)?'':'none';});};

// ---------- views ----------
const goSearch="if(event.key==='Enter')location.hash=this.value.trim()?'#/archive?q='+encodeURIComponent(this.value.trim()):'#/archive'";
function searchInput(q,ph){return `<div class="searchbar"><input value="${esc(q||'')}" placeholder="${ph||'Поиск по архиву — материалы, личности, темы, события…'}" onkeydown="${goSearch}"><button class="btn dark" onclick="var v=this.previousElementSibling.value.trim();location.hash=v?'#/archive?q='+encodeURIComponent(v):'#/archive'">Найти</button></div>`;}
const homeSec=(dot,kick,href,label,body)=>`<section class="hsec"><div class="hsec-h"><div class="hkick"><span class="hdot" style="background:${dot}"></span>${kick}</div><a class="btn sm" href="${href}">→ ${label} →</a></div>${body}</section>`;
function home(){
  const POP=[['Конструктивизм','#/archive?theme=t1'],['1920-е','#/archive?decade='+encodeURIComponent('1920-е')],['ВХУТЕМАС','#/archive?org=o1'],['Советский авангард','#/archive?q='+encodeURIComponent('авангард')],['Архитектура','#/archive?q='+encodeURIComponent('Архитектура')],['Плакат','#/archive?subtype='+encodeURIComponent('Плакат')],['Родченко','#/archive?person=p1'],['+ ещё','#/archive']];
  const events=all('event').slice(0,2), persons=all('person').slice(0,5), colls=all('collection'), mats=all('material'), projs=all('project');
  const places=all('place'), pts=[[28,30],[58,46],[42,66]];
  const evCard=o=>`<a class="card tile" href="#/e/${o.id}"><div class="img" style="aspect-ratio:16/9"></div><div class="kicker">Событие${o.evType?' · '+esc(o.evType):''}</div><div class="t">${esc(o.title)}</div><div class="muted" style="font-size:13px">${esc(o.date||'')}</div></a>`;
  const portrait=o=>`<a class="pcard" href="#/e/${o.id}"><div class="pava"></div><div class="t">${esc(o.title)}</div><div class="muted" style="font-size:12px">${esc(o.role||o.life||'')}</div></a>`;
  const big=o=>`<a class="card tile" href="#/e/${o.id}"><div class="img" style="aspect-ratio:16/7"></div><div class="kicker">${TYPES[o.type].l}${o.subtype?' · '+esc(o.subtype):''}</div><div class="t" style="font-size:17px">${esc(o.title)}</div><div class="muted" style="font-size:13px">${esc(tileMeta(o))}</div></a>`;
  return page('#/',`
  <section class="hero" style="padding:64px 0 32px"><div class="kicker">Цифровой архив</div>
    <h1>Цифровой архив Центра «Зотов»</h1>
    <div class="lead">Связный архив о конструктивизме, медиа и городской истории: материалы, личности, события, места и проекты, объединённые в единую систему связей.</div>
  </section>
  <section class="hsec" style="border-top:none;padding-top:0">
    ${searchInput('')}
    <div class="chips" style="margin-top:16px">${POP.map(([t,h])=>`<a class="chip" href="${h}">${t}</a>`).join('')}</div>
  </section>
  ${homeSec('#c2410c','Хронограф','#/chrono','Хронограф',`<div class="minitl">${'<span class="d"></span>'.repeat(6)}</div><div class="grid g2" style="margin-top:20px">${events.map(evCard).join('')}</div>`)}
  ${homeSec('#7c3aed','Личности','#/cat/person','Личности',`<div class="prow">${persons.map(portrait).join('')}</div>`)}
  ${homeSec('#0d9488','Карта · Коллекции','#/map','Карта',`<div class="asym">
      <div class="mapbox" style="height:320px">${places.map((p,i)=>`<a class="pin ${i===0?'on':''}" style="left:${pts[i%3][0]}%;top:${pts[i%3][1]}%" href="#/e/${p.id}" title="${esc(p.title)}"></a>`).join('')}</div>
      <div><div class="hkick" style="margin-bottom:14px"><span class="hdot" style="background:#d97706"></span>Коллекции<a class="lnk" style="margin-left:auto;font-weight:400;text-transform:none;letter-spacing:0;font-size:13px" href="#/cat/collection">все →</a></div>
        ${colls.map(c=>`<a class="card" href="#/e/${c.id}" style="display:flex;gap:14px;align-items:center;margin-bottom:12px"><div class="cthumb"></div><div><div class="t" style="font-weight:600">${esc(c.title)}</div><div class="muted" style="font-size:13px">${esc(c.colType||'')}</div></div></a>`).join('')}</div>
    </div>`)}
  ${homeSec('#16a34a','Темы','#/cat/theme','Темы',`<div class="bigsmall">${big(mats[0])}${tile(mats[1])}</div>`)}
  ${homeSec('#db2777','Проекты / Выставки','#/cat/project','Проекты',`<div class="bigsmall">${big(projs[0])}${projs[1]?tile(projs[1]):''}</div>`)}
  `);
}

// ===== ПОИСК И ФИЛЬТРАЦИЯ (ТЗ: простой + расширенный, многомерные фильтры, URL-состояние) =====
const TYPELIST=['Видео','Аудио','Изображение','Текст','Документ','Печатная продукция','Графика','Живопись','Макет','Предмет / ДПИ','Цифровой объект','Сенсорный материал'];
const ACCESS={open:'Открытый',request:'По запросу',restricted:'Ограниченный'};
const MEDIA={image:'Изображение',video:'Видео',audio:'Аудио',pdf:'PDF','3d':'3D-модель'};
const A11Y=['РЖЯ','субтитры','расшифровка','аудиоописание'];
const SORTS={rel:'По релевантности',new:'Сначала новые',old:'Сначала старые',az:'По алфавиту',type:'По типу материала'};
const ENT=[['person','Личность'],['place','Место'],['event','Событие'],['theme','Тема'],['tag','Тег'],['project','Выставка / проект'],['org','Организация'],['collection','Коллекция / фонд'],['source','Источник']];
const ENTKEYS=ENT.map(e=>e[0]);
const DIMS=['type','subtype','decade','access','media','a11y','lang',...ENTKEYS];

let advOpen=false;
let FILT=blankFilt();
function blankFilt(){const f={q:'',sort:'rel'};DIMS.forEach(d=>f[d]=new Set());return f;}
const decadeOf=d=>{const m=(d||'').match(/\d{4}/);return m?Math.floor(+m[0]/10)*10+'-е':'';};
const yearOf=d=>{const m=(d||'').match(/\d{4}/);return m?+m[0]:0;};
const subtypesAll=()=>[...new Set(all('material').map(m=>(m.subtype||'').split('·')[0].trim()).filter(Boolean))];
const langsAll=()=>[...new Set(all('material').map(m=>m.lang).filter(l=>l&&l!=='—'))];
const decadesAll=()=>[...new Set(all('material').map(m=>decadeOf(m.date)).filter(Boolean))].sort();

// --- URL <-> состояние фильтров ---
function parseFilt(qs){
  const f=blankFilt();
  new URLSearchParams(qs||'').forEach((v,k)=>{
    if(k==='q') f.q=v;
    else if(k==='sort') f.sort=v;
    else if(f[k]instanceof Set) v.split(',').filter(Boolean).forEach(x=>f[k].add(x));
  });
  return f;
}
function buildHash(){
  const p=new URLSearchParams();
  if(FILT.q) p.set('q',FILT.q);
  DIMS.forEach(d=>{ if(FILT[d].size) p.set(d,[...FILT[d]].join(',')); });
  if(FILT.sort&&FILT.sort!=='rel') p.set('sort',FILT.sort);
  const s=p.toString();
  return '#/archive'+(s?'?'+s:'');
}
const hasFilters=()=>DIMS.some(d=>FILT[d].size);
const navFilt=()=>{location.hash=buildHash();};

// --- движок ---
function textMatch(o,ql){
  return ['title','alt','desc','role','def','author','subtype','mtype','date','placeType','orgType','srcType','prType','life']
    .some(k=>typeof o[k]==='string'&&o[k].toLowerCase().includes(ql));
}
const matAttrActive=()=>['type','subtype','decade','access','media','a11y','lang'].some(d=>FILT[d].size);
function passes(o){
  if(matAttrActive()&&o.type!=='material') return false;
  if(FILT.type.size&&!FILT.type.has(o.mtype)) return false;
  if(FILT.subtype.size&&![...FILT.subtype].some(s=>(o.subtype||'').includes(s))) return false;
  if(FILT.decade.size&&!FILT.decade.has(decadeOf(o.date))) return false;
  if(FILT.access.size&&!FILT.access.has(o.access)) return false;
  if(FILT.media.size&&!(o.media||[]).some(m=>FILT.media.has(m))) return false;
  if(FILT.a11y.size&&!(o.a11y||[]).some(a=>FILT.a11y.has(a))) return false;
  if(FILT.lang.size&&!FILT.lang.has(o.lang)) return false;
  for(const k of ENTKEYS){ if(FILT[k].size){ const ok=FILT[k].has(o.id)||(o.links||[]).some(id=>FILT[k].has(id)); if(!ok) return false; } }
  return true;
}
function runSearch(){
  let pool, direct=new Set();
  if(FILT.q){
    const ql=FILT.q.toLowerCase();
    const hits=RAW.filter(o=>textMatch(o,ql));
    hits.forEach(o=>direct.add(o.id));
    const ids=new Set(direct);
    hits.forEach(o=>(o.links||[]).forEach(id=>ids.add(id))); // + связанные данные (ТЗ)
    pool=[...ids].map(id=>DB[id]).filter(Boolean);
  } else if(hasFilters()){
    pool=RAW.slice();
  } else {
    pool=all('material'); // browse-каталог
  }
  return {res:pool.filter(passes),direct};
}
function sortItems(arr,direct){
  const cmp={
    new:(a,b)=>yearOf(b.date)-yearOf(a.date),
    old:(a,b)=>yearOf(a.date)-yearOf(b.date),
    az:(a,b)=>a.title.localeCompare(b.title,'ru'),
    type:(a,b)=>(a.mtype||TYPES[a.type].l).localeCompare(b.mtype||TYPES[b.type].l,'ru'),
    rel:(a,b)=>((direct.has(b.id)?1:0)-(direct.has(a.id)?1:0))||(yearOf(b.date)-yearOf(a.date))
  }[FILT.sort]||(()=>0);
  return arr.slice().sort(cmp);
}

// --- карточка результата ---
const accessBadge=a=>a?`<span class="tag-a ${a}">${ACCESS[a]||a}</span>`:'';
const mediaIcons=o=>{const ic={image:'IMG',video:'VIDEO',audio:'AUDIO',pdf:'PDF','3d':'3D'};return (o.media||[]).map(m=>`<span class="mico" title="${MEDIA[m]||m}">${ic[m]||'•'}</span>`).join('');};
function resultCard(o){
  const ln=(o.links||[]).map(id=>DB[id]).filter(Boolean);
  const person=ln.find(x=>x.type==='person'), coll=ln.find(x=>x.type==='collection'), proj=ln.find(x=>x.type==='project');
  const tags=ln.filter(x=>x.type==='tag');
  return `<a class="card tile rcard" href="#/e/${o.id}">
    <div class="img"></div>
    <div class="kicker">${esc(o.mtype||TYPES[o.type].l)}${o.subtype?' · '+esc(o.subtype):''}</div>
    <div class="t">${esc(o.title)}</div>
    <div class="muted" style="font-size:13px">${esc(o.date||'')}</div>
    <div class="rmeta">${accessBadge(o.access)}${mediaIcons(o)}</div>
    ${(person||coll||proj)?`<div class="rlinks">${person?`<span>Личность: ${esc(person.title)}</span>`:''}${proj?`<span>Выставка: ${esc(proj.title)}</span>`:''}${coll?`<span>Коллекция: ${esc(coll.title)}</span>`:''}</div>`:''}
    ${tags.length?`<div class="rtags">${tags.map(t=>'#'+esc(t.title)).join(' ')}</div>`:''}
  </a>`;
}

// --- активные фильтры (чипы со снятием) ---
function activeChips(){
  const c=[];
  if(FILT.q) c.push(['Запрос: «'+FILT.q+'»','q','']);
  FILT.type.forEach(v=>c.push(['Тип: '+v,'type',v]));
  FILT.subtype.forEach(v=>c.push(['Подтип: '+v,'subtype',v]));
  FILT.decade.forEach(v=>c.push(['Период: '+v,'decade',v]));
  FILT.access.forEach(v=>c.push(['Доступ: '+ACCESS[v],'access',v]));
  FILT.media.forEach(v=>c.push(['Медиа: '+MEDIA[v],'media',v]));
  FILT.a11y.forEach(v=>c.push(['Доступность: '+v,'a11y',v]));
  FILT.lang.forEach(v=>c.push(['Язык: '+v,'lang',v]));
  ENT.forEach(([k,lbl])=>FILT[k].forEach(id=>c.push([lbl+': '+(DB[id]?DB[id].title:id),k,id])));
  if(!c.length) return '';
  return `<div class="achips">${c.map(([t,d,v])=>`<span class="achip" onclick="rmFilter('${d}','${esc(v)}')">${esc(t)} ✕</span>`).join('')}<span class="achip clear" onclick="resetAll()">Сбросить всё</span></div>`;
}
function toolbar(count){
  const opts=Object.entries(SORTS).map(([k,l])=>`<option value="${k}"${FILT.sort===k?' selected':''}>${l}</option>`).join('');
  return `<div class="toolbar"><b>Найдено: ${count}</b>
    <div class="tools">
      <select class="sel" onchange="setSort(this.value)" title="Сортировка">${opts}</select>
      <span class="btn sm" onclick="saveSearch()">Сохранить поиск</span>
      <span class="btn sm" onclick="copyLink()">Скопировать ссылку</span>
      <span class="btn sm" onclick="exportCSV()">Скачать (CSV)</span>
    </div></div>`;
}

// --- фильтр-панель (чипы, множественный выбор) ---
function chipGroup(dim,label,opts){
  if(!opts.length) return '';
  return `<div class="grp"><div class="lbl">${label}</div><div class="chips">${opts.map(([v,l])=>`<span class="fchip${FILT[dim].has(''+v)?' on':''}" onclick="tf('${dim}','${esc(''+v)}')">${esc(l)}</span>`).join('')}</div></div>`;
}
function filtersPanel(){
  return `<div class="filters">
    <div class="grp" style="display:flex;align-items:baseline;justify-content:space-between">
      <div class="lbl" style="font-size:17px;font-weight:600;margin:0">Фильтры</div>
      <span class="muted lnk" style="font-size:13px" onclick="resetFilters()">Сбросить</span></div>
    ${chipGroup('type','Тип материала',TYPELIST.map(t=>[t,t]))}
    ${chipGroup('decade','Дата / период',decadesAll().map(d=>[d,d]))}
    <div class="muted" style="font-size:13px;margin:-6px 0 16px">Точная дата, диапазон и «около» — в полной версии.</div>
    <details class="adv"${advOpen?' open':''} ontoggle="advOpen=this.open">
      <summary>Расширенные фильтры</summary>
      <div style="margin-top:12px">
      ${chipGroup('subtype','Подтип материала',subtypesAll().map(s=>[s,s]))}
      ${ENT.map(([k,lbl])=>chipGroup(k,lbl,all(k).map(o=>[o.id,o.title]))).join('')}
      ${chipGroup('access','Уровень доступа',Object.entries(ACCESS))}
      ${chipGroup('media','Наличие медиафайла',Object.entries(MEDIA))}
      ${chipGroup('a11y','Доступность',A11Y.map(a=>[a,a]))}
      ${chipGroup('lang','Язык',langsAll().map(l=>[l,l]))}
      </div>
    </details>
  </div>`;
}

// --- страница архива / результатов ---
function archive(qs){
  FILT=parseFilt(qs);
  const {res,direct}=runSearch();
  const browse=!FILT.q&&!hasFilters();
  const order=['material','person','place','event','theme','project','org','collection','source','tag','media'];
  const by={}; res.forEach(o=>(by[o.type]=by[o.type]||[]).push(o));
  let body;
  if(!res.length){
    body=`<p class="muted">Ничего не найдено. Измените запрос или фильтры. <span class="lnk" onclick="resetAll()">Сбросить всё</span><br><span style="font-size:13px">Подсказка: «Родченко», «Вертов», «Конструктивизм», «1927».</span></p>`;
  } else if(browse){
    body=`<div class="grid g3">${sortItems(by.material||[],direct).map(resultCard).join('')}</div>`;
  } else {
    body=order.filter(t=>by[t]).map(t=>{
      const items=sortItems(by[t],direct);
      const inner=t==='material'?`<div class="grid g3">${items.map(resultCard).join('')}</div>`:`<div class="chips">${items.map(link).join('')}</div>`;
      return `<div class="grpres"><h3>${TYPES[t].pl}<span class="c">${items.length}</span></h3>${inner}</div>`;
    }).join('');
  }
  const head=browse
    ?`<div class="crumbs">Архив</div><h1>Архив</h1><div class="muted">Каталог материалов. Введите запрос или выберите фильтры слева — результаты обновятся.</div>`
    :`<div class="crumbs"><a href="#/archive">Архив</a> / ${FILT.q?'Результаты поиска':'Результаты фильтрации'}</div><h1 style="font-size:32px">${FILT.q?'Результаты по запросу «'+esc(FILT.q)+'»':'Результаты фильтрации'}</h1>${FILT.q?'<div class="muted" style="font-size:13px">Поиск по названиям и связанным данным — результаты сгруппированы по типам.</div>':''}`;
  return page('#/archive',`${head}
    ${searchInput(FILT.q)}
    <div class="archive" style="margin-top:18px">${filtersPanel()}<div>${activeChips()}${toolbar(res.length)}${body}</div></div>`);
}

// --- обработчики фильтров / действий ---
window.tf=(dim,v)=>{const S=FILT[dim];S.has(v)?S.delete(v):S.add(v);navFilt();};
window.rmFilter=(dim,v)=>{if(dim==='q')FILT.q='';else FILT[dim].delete(v);navFilt();};
window.setSort=v=>{FILT.sort=v;navFilt();};
window.resetFilters=()=>{const q=FILT.q,s=FILT.sort;FILT=blankFilt();FILT.q=q;FILT.sort=s;navFilt();};
window.resetAll=()=>{FILT=blankFilt();navFilt();};

const SKEY='zotov_saved';
const getSaved=()=>{try{return JSON.parse(localStorage.getItem(SKEY)||'[]')}catch(e){return[]}};
const setSaved=a=>localStorage.setItem(SKEY,JSON.stringify(a));
function toast(msg){const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>t.remove(),1900);}
window.copyLink=()=>{const u=location.href;if(navigator.clipboard)navigator.clipboard.writeText(u);toast('Ссылка на выдачу скопирована');};
window.saveSearch=()=>{
  const {res}=runSearch();
  const def=FILT.q||[...FILT.type][0]||(ENTKEYS.map(k=>[...FILT[k]][0]).filter(Boolean).map(id=>DB[id]&&DB[id].title)[0])||'Мой поиск';
  const name=prompt('Название сохранённого поиска:',def);
  if(!name) return;
  const a=getSaved();
  a.unshift({name,hash:buildHash(),count:res.length,date:new Date().toLocaleDateString('ru-RU')});
  setSaved(a); toast('Поиск сохранён в личном кабинете');
};
window.exportCSV=()=>{
  const {res,direct}=runSearch();
  const rows=[['Название','Тип','Подтип','Дата','Уровень доступа','Темы','Личности']];
  sortItems(res,direct).forEach(o=>{
    const ln=(o.links||[]).map(id=>DB[id]).filter(Boolean);
    const th=ln.filter(x=>x.type==='theme').map(x=>x.title).join('; ');
    const pr=ln.filter(x=>x.type==='person').map(x=>x.title).join('; ');
    rows.push([o.title,o.mtype||TYPES[o.type].l,o.subtype||'',o.date||'',ACCESS[o.access]||'',th,pr]);
  });
  const csv='﻿'+rows.map(r=>r.map(c=>'"'+(''+c).replace(/"/g,'""')+'"').join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='zotov-search.csv';a.click();URL.revokeObjectURL(url);
  toast('Результаты выгружены (CSV)');
};
window.copySaved=i=>{const s=getSaved()[i];if(s){const u=location.origin+location.pathname+s.hash;if(navigator.clipboard)navigator.clipboard.writeText(u);toast('Ссылка скопирована');}};
window.delSaved=i=>{const a=getSaved();a.splice(i,1);setSaved(a);render();};

// --- ЛК: сохранённые материалы, история, подборки (localStorage) ---
const lsGet=k=>{try{return JSON.parse(localStorage.getItem(k)||'[]')}catch(e){return[]}};
const lsSet=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
function histAdd(id){let h=lsGet('zotov_hist').filter(x=>x!==id);h.unshift(id);lsSet('zotov_hist',h.slice(0,12));}
window.toggleSaveMat=id=>{let s=lsGet('zotov_savedmat');const on=s.includes(id);s=on?s.filter(x=>x!==id):[id,...s];lsSet('zotov_savedmat',s);toast(on?'Удалено из сохранённых':'Материал сохранён');render();};
window.rmSaveMat=id=>{lsSet('zotov_savedmat',lsGet('zotov_savedmat').filter(x=>x!==id));render();};
window.clearHist=()=>{lsSet('zotov_hist',[]);toast('История очищена');render();};
window.newCollection=()=>{const n=prompt('Название подборки:');if(!n)return;const c=lsGet('zotov_coll');c.unshift({name:n,n:0});lsSet('zotov_coll',c);toast('Подборка создана');render();};
window.delCollection=i=>{const c=lsGet('zotov_coll');c.splice(i,1);lsSet('zotov_coll',c);render();};

function chrono(){
  const items=[...all('event'),...all('material').filter(m=>m.date)];
  const byYear={}; items.forEach(o=>{const y=(o.date||'').match(/\d{4}/);const k=y?y[0]:'—';(byYear[k]=byYear[k]||[]).push(o);});
  const years=Object.keys(byYear).sort();
  const decs=['Все периоды','1910-е','1920-е','1930-е','2020-е'];
  return page('#/chrono',`<h1>Хронограф</h1><div class="lead" style="font-size:17px">События и материалы на единой временной шкале.</div>
    <div class="chips" style="margin:18px 0">${decs.map((s,i)=>`<span class="chip" onclick="filterChrono(this,'${i==0?'all':s}')"${i==0?' style="background:#1f1f1f;color:#fff"':''}>${s}</span>`).join('')}</div>
    <div class="tl" id="tl">${years.map(y=>{const d=/^\d/.test(y)?Math.floor(+y/10)*10+'-е':'—';return `<div class="row" data-d="${d}"><div class="yr">${y}</div><div class="cont">${byYear[y].map(o=>`<a class="evt" href="#/e/${o.id}"><div class="th"></div><div><div class="kicker">${TYPES[o.type].l}</div><div class="t" style="font-weight:600;font-size:17px">${esc(o.title)}</div><div class="muted">${esc(o.date)}</div></div></a>`).join('')}</div></div>`}).join('')}</div>`);
}
window.filterChrono=(el,d)=>{[...el.parentElement.children].forEach(c=>c.removeAttribute('style'));el.style.background='#1f1f1f';el.style.color='#fff';document.querySelectorAll('#tl .row').forEach(r=>{r.style.display=(d==='all'||r.dataset.d===d)?'':'none';});};

function map(){
  const places=all('place');
  const pts=[[28,26],[55,42],[40,62]];
  return page('#/map',`<h1>Карта</h1>
    <div class="muted" style="font-size:15px">Места архива на карте: здания, организации, места событий и съёмок.</div>
    <div class="chips" style="margin:14px 0 4px">${['Все места','Здания','Организации','Места событий','Утраченные'].map((s,i)=>`<span class="chip"${i==0?' style="background:#1f1f1f;color:#fff"':''}>${s}</span>`).join('')}</div>
    ${sectionSearch('Поиск по местам')}
    <div class="maprow" style="margin-top:14px"><div id="catgrid">
      ${places.map(p=>`<a class="card" href="#/e/${p.id}" style="display:flex;gap:14px;align-items:center;margin-bottom:12px"><div style="width:40px;height:40px;background:var(--img);border-radius:6px;flex:none"></div><div><div class="t" style="font-weight:600">${esc(p.title)}</div><div class="muted" style="font-size:13px">${esc(p.placeType||'Место')} · ${esc(p.status||'')} · ${DB[p.id].links.length} связей</div></div></a>`).join('')}
    </div><div class="mapbox">${places.map((p,i)=>`<a class="pin ${i==0?'on':''}" style="left:${pts[i%3][0]}%;top:${pts[i%3][1]}%" href="#/e/${p.id}" title="${esc(p.title)}"></a>`).join('')}</div></div>`);
}

function catalog(type){
  const items=all(type); const T=TYPES[type];
  return page('#/cat/'+type,`<div class="crumbs">${T.pl}</div><h1>${T.pl}</h1>
    ${sectionSearch('Поиск среди: '+T.pl.toLowerCase())}
    <div class="grid ${type==='person'?'g4':'g3'}" id="catgrid" style="margin-top:18px">${items.map(tile).join('')}</div>`);
}
function library(){
  const items=all('material').filter(m=>['Печатная продукция','Текст'].includes(m.mtype));
  return page('#/library',`<div class="crumbs">Библиотека</div><h1>Библиотека</h1>
    <div class="muted">Издания, тексты и публикации: каталоги, книги, статьи, печатная продукция.</div>
    ${sectionSearch('Поиск по библиотеке')}
    <div class="grid g3" id="catgrid" style="margin-top:18px">${items.length?items.map(resultCard).join(''):'<p class="muted">В библиотеке пока нет материалов нужных типов.</p>'}</div>`);
}

// entity detail (generic + per-type hero)
function entity(o){
  if(!o) return page('#/','<h1>Не найдено</h1>');
  const T=TYPES[o.type];
  const back={material:'#/archive',person:'#/cat/person',place:'#/map',event:'#/chrono',theme:'#/cat/theme',project:'#/cat/project',org:'#/cat/collection',collection:'#/cat/collection',source:'#/cat/source',media:'#/archive',tag:'#/archive'}[o.type];
  const crumbs=`<div class="crumbs"><a href="${back}">${T.pl}</a> / ${esc(o.title)}</div>`;
  if(o.type==='material') histAdd(o.id);
  let hero='';
  if(o.type==='material'){
    const access=o.access==='request';
    const saved=lsGet('zotov_savedmat').includes(o.id);
    hero=`${crumbs}<div class="two" style="margin-top:8px"><div><div class="media"></div><div class="thumbs"><div></div><div></div><div></div><div></div></div></div>
      <div><div class="kicker">${esc(o.subtype||'Материал')}</div><h1 style="font-size:30px">${esc(o.title)}</h1>
      <div class="metabox">${[['Тип и подтип',o.subtype],['Дата / период',o.date],['Авторы и участники',(o.authors||[]).map(id=>DB[id]&&DB[id].title).filter(Boolean).join(', ')||'—'],['Права и условия доступа',access?'По запросу · просмотр':'Открытый доступ']].map(r=>`<div class="r"><span class="k">${r[0]}</span><span class="v">${esc(r[1]||'—')}</span></div>`).join('')}</div>
      <div style="margin-top:12px"><span class="btn" onclick="toggleSaveMat('${o.id}')">${saved?'✓ В сохранённых':'＋ Сохранить материал'}</span></div>
      ${access?`<div class="access"><b>Материал доступен по запросу</b><div class="muted" style="margin:6px 0 12px">Зарегистрированные исследователи могут запросить доступ.</div><a class="btn dark" href="#/request/${o.id}">Запросить доступ</a></div>`:''}
      <h3>Описание</h3><div class="muted">Происхождение, контекст создания, связанные обстоятельства — редакторское описание с научным аппаратом.</div>
      ${(o.links.filter(id=>DB[id]&&DB[id].type==='media')).map(id=>`<div style="margin-top:10px"><a href="#/e/${id}">▶ ${esc(DB[id].title)} →</a></div>`).join('')}
      </div></div>`;
  } else if(o.type==='media'){
    const p=DB[o.parent];
    hero=`${crumbs}<div class="kicker">Медиафайл</div><h1 style="font-size:28px">${esc(o.title)}</h1>
      <div class="two" style="grid-template-columns:1fr 380px"><div style="background:#222;border-radius:10px;height:440px;display:flex;align-items:center;justify-content:center"><span class="btn">▶ просмотр / проигрыватель</span></div>
      <div><div class="metabox">${[['Формат',o.format],['Размер',o.size],['Разрешение',o.res],['Длительность',o.dur],['Права / доступ','По запросу']].map(r=>`<div class="r"><span class="k">${r[0]}</span><span class="v">${esc(r[1])}</span></div>`).join('')}</div>
      <a class="btn dark" style="display:block;text-align:center;margin-top:12px">Скачать файл</a>
      ${p?`<div class="note" style="margin-top:12px"><div class="kicker">Относится к материалу</div><b>${esc(p.title)}</b><div><a href="#/e/${p.id}">→ открыть карточку материала</a></div></div>`:''}</div></div>
      <div class="muted" style="margin-top:16px">Медиафайл — техническая сущность: конкретный файл, прикреплённый к материалу.</div>`;
    return page('',hero);
  } else if(o.type==='person'){
    hero=`${crumbs}<div class="two" style="grid-template-columns:240px 1fr"><div class="media" style="aspect-ratio:3/4"></div>
      <div><div class="kicker">Личность</div><h1>${esc(o.title)}</h1><div class="muted" style="font-size:18px">${esc(o.life)} · ${esc(o.role)}</div>
      <p class="muted" style="max-width:640px">Краткая биографическая справка: роль персоны в контексте архива, ключевые проекты и связи.</p></div></div>`;
  } else if(o.type==='theme'){
    hero=`${crumbs}<div class="kicker">Тема</div><h1>${esc(o.title)}</h1><div class="lead">${esc(o.def)}</div>
      <div class="media" style="aspect-ratio:auto;height:240px;margin:24px 0"></div>
      ${o.sub&&o.sub.length?`<h3>Дочерние темы</h3><div class="chips">${o.sub.map(s=>`<span class="chip">${esc(s)}</span>`).join('')}</div>`:''}`;
  } else if(o.type==='project'){
    const v=DB[o.venue];
    hero=`${crumbs}<div class="media" style="aspect-ratio:auto;height:340px;margin-top:8px"></div>
      <div class="kicker">Выставка · завершённый проект</div><h1>${esc(o.title)}</h1>
      <div class="chips">${[['Даты',o.dates],['Кураторы',o.curators],['Место',v?v.title:'—'],['Тип',o.prType]].map(kv=>`<span class="muted">${kv[0]}: <b style="color:var(--ink);font-weight:500">${esc(kv[1])}</b></span>`).join('&nbsp;&nbsp;·&nbsp;&nbsp;')}</div>
      <p>Кураторское описание проекта. Проект собирает вокруг себя материалы, события, личности, организации, места, темы и источники — через связи.</p>
      <h3>Галерея</h3><div class="grid" style="grid-template-columns:repeat(5,1fr)">${'<div class="media" style="aspect-ratio:1"></div>'.repeat(5)}</div>`;
  } else if(o.type==='place'){
    hero=`${crumbs}<div class="kicker">Место</div><h1>${esc(o.title)}</h1>
      <div class="two" style="grid-template-columns:560px 1fr"><div><div class="mapbox" style="height:300px;position:relative"><span class="pin on" style="left:50%;top:50%"></span></div><div class="muted" style="margin-top:8px">Координаты: ${esc(o.coord)}</div></div>
      <div class="metabox">${[['Тип места',o.placeType],['Адрес',o.address],['Статус',o.status]].map(r=>`<div class="r"><span class="k">${r[0]}</span><span class="v">${esc(r[1])}</span></div>`).join('')}</div></div>`;
  } else if(o.type==='source'){
    hero=`${crumbs}<div class="kicker">Источник / библиография</div><h1 style="font-size:32px">${esc(o.title)}</h1>
      <div class="metabox" style="max-width:560px">${[['Автор / составитель',o.author],['Год',o.year],['Тип источника',o.srcType],['Издательство',o.publisher],['Место издания',o.pubplace]].map(r=>`<div class="r"><span class="k">${r[0]}</span><span class="v">${esc(r[1])}</span></div>`).join('')}</div>`;
    return page('',hero+relatedSections(o));
  } else if(o.type==='org'){
    hero=`${crumbs}<div class="kicker">Организация</div><h1>${esc(o.title)}</h1>
      <div class="metabox" style="max-width:560px">${[['Тип',o.orgType],['Период деятельности',o.period]].map(r=>`<div class="r"><span class="k">${r[0]}</span><span class="v">${esc(r[1])}</span></div>`).join('')}</div>`;
  } else if(o.type==='collection'){
    hero=`${crumbs}<div class="media" style="aspect-ratio:auto;height:260px;margin-top:8px"></div><div class="kicker">Коллекция / фонд</div><h1>${esc(o.title)}</h1>
      <div class="metabox" style="max-width:560px">${[['Тип коллекции',o.colType],['Период',o.period]].map(r=>`<div class="r"><span class="k">${r[0]}</span><span class="v">${esc(r[1])}</span></div>`).join('')}</div>
      ${o.sub?`<h3>Дочерние коллекции и разделы</h3><div class="chips">${o.sub.map(s=>`<span class="chip">${esc(s)}</span>`).join('')}</div>`:''}`;
  } else if(o.type==='event'){
    hero=`${crumbs}<div class="kicker">Событие</div><h1>${esc(o.title)}</h1>
      ${o.inChrono?'<span class="statbadge">Показывается в хронографе</span>':''}
      <div class="metabox" style="max-width:560px;margin-top:14px">${[['Дата / период',o.date],['Тип события',o.evType]].map(r=>`<div class="r"><span class="k">${r[0]}</span><span class="v">${esc(r[1])}</span></div>`).join('')}</div>`;
  } else if(o.type==='tag'){
    const mats=all('material').filter(m=>m.links.includes(o.id));
    return page('',`${crumbs}<div class="kicker">Тег</div><h1>#${esc(o.title)}</h1>
      <div class="lead" style="font-size:17px">Лёгкая метка для навигации. Материалы с этим тегом:</div>
      <div class="grid g4" style="margin-top:18px">${mats.map(tile).join('')}</div>`);
  }
  return page('',hero+relatedSections(o)+similarBlock(o));
}

const CAB_TABS=[['profile','Профиль'],['saved','Сохранённые материалы'],['searches','Сохранённые поиски'],['collections','Личные подборки'],['requests','Заявки на доступ'],['history','История просмотров'],['notifications','Уведомления'],['settings','Настройки']];
function cabinet(tab){
  if(!CAB_TABS.some(([k])=>k===tab)) tab='profile';
  const side=`<div class="side"><div style="display:flex;gap:12px;align-items:center;padding:8px 4px 16px"><div style="width:44px;height:44px;border-radius:50%;background:var(--img)"></div><div><b>Анна Исследователь</b><div class="kicker">Исследователь</div></div></div>
    ${CAB_TABS.map(([k,l])=>`<a href="#/cabinet/${k}" class="${tab===k?'active':''}">${l}</a>`).join('')}</div>`;
  const views={profile:cabProfile,saved:cabSaved,searches:cabSearches,collections:cabCollections,requests:cabRequests,history:cabHistory,notifications:cabNotifications,settings:cabSettings};
  return page('#/cabinet',`<div class="cab">${side}<div>${views[tab]()}</div></div>`);
}
function cabProfile(){
  const rows=[['Имя','Анна'],['Фамилия','Исследователь'],['Email','anna.r@example.ru'],['Организация / учебное заведение','НИУ ВШЭ, Школа дизайна'],['Должность / статус','исследователь'],['Сфера интересов','конструктивизм, авангард, фотомонтаж'],['Дата регистрации','12.01.2026'],['Статус аккаунта','Активен']];
  return `<h1 style="font-size:30px">Профиль</h1>
    <div class="metabox" style="max-width:640px">${rows.map(r=>`<div class="r"><span class="k">${r[0]}</span><span class="v">${esc(r[1])}</span></div>`).join('')}</div>
    <div style="margin-top:16px"><span class="btn dark" onclick="toast('Демо: редактирование профиля')">Редактировать профиль</span></div>`;
}
function cabSaved(){
  const ids=lsGet('zotov_savedmat').map(id=>DB[id]).filter(Boolean);
  const body=ids.length
    ? `<div class="grid g3">${ids.map(o=>`<div class="savedwrap">${resultCard(o)}<span class="lnk" style="font-size:13px" onclick="rmSaveMat('${o.id}')">Убрать из сохранённых</span></div>`).join('')}</div>`
    : `<p class="muted">Пока нет сохранённых материалов. Откройте карточку материала и нажмите «Сохранить материал». <a href="#/archive">Перейти в архив →</a></p>`;
  return `<h1 style="font-size:30px">Сохранённые материалы</h1><div class="muted">${ids.length} материалов</div><div style="margin-top:16px">${body}</div>`;
}
function cabSearches(){
  const saved=getSaved();
  const html=saved.length
    ? `<div class="metabox">${saved.map((s,i)=>`<div class="r"><div><b>${esc(s.name)}</b><div class="muted" style="font-size:13px">${esc(s.hash.replace('#/archive','').replace(/^\?/,'')||'все материалы')} · ${s.count} рез. · ${esc(s.date)}</div></div><div class="tools"><a class="btn sm" href="${s.hash}">Открыть</a><span class="btn sm" onclick="copySaved(${i})">Ссылка</span><span class="btn sm" onclick="delSaved(${i})">Удалить</span></div></div>`).join('')}</div>`
    : `<p class="muted">Сохранённых поисков пока нет. Откройте <a href="#/archive">Архив</a>, настройте фильтры и нажмите «Сохранить поиск».</p>`;
  return `<h1 style="font-size:30px">Сохранённые поиски</h1><div class="muted" style="font-size:13px;margin-bottom:12px">Сохраняются параметры поиска и фильтров (а не статичный список) — при открытии выдача пересчитывается по актуальным данным.</div>${html}`;
}
function cabCollections(){
  const c=lsGet('zotov_coll');
  const list=c.length
    ? `<div class="metabox">${c.map((x,i)=>`<div class="r"><div><b>${esc(x.name)}</b><div class="muted" style="font-size:13px">${x.n||0} материалов</div></div><div class="tools"><span class="btn sm" onclick="toast('Демо: открытие подборки')">Открыть</span><span class="btn sm" onclick="delCollection(${i})">Удалить</span></div></div>`).join('')}</div>`
    : `<p class="muted">Личных подборок пока нет.</p>`;
  return `<h1 style="font-size:30px">Личные подборки</h1><div class="muted" style="font-size:13px;margin-bottom:12px">Собственные списки материалов для исследования. Видны только вам.</div>
    <div style="margin-bottom:16px"><span class="btn dark" onclick="newCollection()">＋ Создать подборку</span></div>${list}`;
}
function cabRequests(){
  const rows=[['Фотография экспозиции, 1927','На рассмотрении'],['Документ фонда №14','Одобрена'],['Аудиозапись лекции','Требует уточнения'],['Протокол заседания ВХУТЕМАС','Новая']];
  return `<h1 style="font-size:30px">Заявки на доступ</h1><div class="muted" style="font-size:13px;margin-bottom:12px">Статусы обновляются после рассмотрения модератором.</div>
    <div class="metabox">${rows.map(r=>`<div class="r"><span>${r[0]}</span><span class="statbadge">${r[1]}</span></div>`).join('')}</div>`;
}
function cabHistory(){
  const ids=lsGet('zotov_hist').map(id=>DB[id]).filter(Boolean);
  const body=ids.length
    ? `<div class="grid g4" style="margin-top:8px">${ids.map(tile).join('')}</div>`
    : `<p class="muted">История пуста. Открытые вами материалы появятся здесь.</p>`;
  return `<h1 style="font-size:30px">История просмотров</h1>${ids.length?`<div><span class="lnk" style="font-size:13px" onclick="clearHist()">Очистить историю</span></div>`:''}${body}`;
}
function cabNotifications(){
  const items=[['Заявка одобрена','«Документ фонда №14» — доступ предоставлен на 30 дней','сегодня'],['Требуется уточнение','По заявке «Аудиозапись лекции» нужно указать цель запроса','вчера'],['Заявка принята в работу','«Фотография экспозиции, 1927» — на рассмотрении','2 дня назад'],['Материал обновлён','Обновлено описание сохранённого «Афиша выставки «1927»»','3 дня назад']];
  return `<h1 style="font-size:30px">Уведомления</h1>
    <div class="metabox">${items.map(n=>`<div class="r"><div><b>${esc(n[0])}</b><div class="muted" style="font-size:13px">${esc(n[1])}</div></div><span class="muted" style="font-size:13px;white-space:nowrap">${esc(n[2])}</span></div>`).join('')}</div>`;
}
function cabSettings(){
  return `<h1 style="font-size:30px">Настройки аккаунта</h1>
    <div class="metabox" style="max-width:640px">${[['Имя и фамилия','Анна Исследователь'],['Email','anna.r@example.ru'],['Пароль','••••••••']].map(r=>`<div class="r"><span class="k">${r[0]}</span><span class="v">${esc(r[1])} · <span class="lnk" onclick="toast('Демо: изменение')">изменить</span></span></div>`).join('')}
      <div class="r"><span class="k">Email-уведомления</span><span class="v"><span class="opt on" style="display:inline-flex;padding:0" onclick="this.classList.toggle('on')"><span class="bx"></span></span></span></div></div>
    <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap"><span class="btn" onclick="toast('Демо: политика обработки ПД')">Политика обработки ПД</span><span class="btn" onclick="toast('Демо: правила использования')">Правила использования</span></div>
    <div style="margin-top:24px"><span class="lnk" style="color:#9a2e2e" onclick="toast('Демо: запрос на удаление аккаунта отправлен')">Удалить аккаунт</span></div>`;
}

// заявка на доступ — модалка-флоу
function request(id){
  const o=DB[id]; render('#/e/'+id); // показываем карточку под модалкой
  const root=document.getElementById('modal-root');
  root.innerHTML=`<div class="ov"><div class="modal">
    <h2>Запросить доступ</h2>
    <div class="note" style="margin:8px 0 4px"><div class="kicker">Материал</div><b>${esc(o?o.title:'')}</b></div>
    <div class="field"><label>Цель запроса</label><textarea class="inp" placeholder="Опишите, для чего нужен доступ"></textarea></div>
    <div class="field"><label>Организация / аффилиация</label><div class="inp">Учреждение, проект или независимый исследователь</div></div>
    <div class="field"><label>Тип доступа</label><div class="radio on"><span class="rb"></span>Только просмотр</div><div class="radio"><span class="rb"></span>Просмотр и скачивание</div></div>
    <div class="opt on"><span class="bx"></span>Согласен на обработку персональных данных</div>
    <div class="right"><span class="btn" onclick="closeModal()">Отмена</span><span class="btn dark" onclick="reqSent()">Отправить запрос</span></div>
  </div></div>`;
}
window.closeModal=()=>{document.getElementById('modal-root').innerHTML='';if(location.hash.startsWith('#/request/'))history.back();};
window.reqSent=()=>{document.getElementById('modal-root').innerHTML=`<div class="ov"><div class="modal" style="text-align:center;width:460px">
    <div style="width:60px;height:60px;border-radius:50%;background:#1f1f1f;margin:6px auto 14px"></div>
    <h2>Заявка отправлена</h2><p class="muted">Модератор рассмотрит запрос. Статус — в личном кабинете, раздел «Заявки на доступ».</p>
    <div class="muted" style="margin:10px 0">Новая → На рассмотрении → Решение</div>
    <div class="right" style="justify-content:center"><a class="btn dark" href="#/cabinet" onclick="closeModal()">Перейти к заявкам</a><span class="btn" onclick="closeModal()">Закрыть</span></div>
  </div></div>`;};

// ---------- router ----------
let lastPath='';
function render(hash){
  document.getElementById('modal-root').innerHTML='';
  const raw=(hash||location.hash||'#/').replace(/^#/,'');
  const qi=raw.indexOf('?');
  const path=qi<0?raw:raw.slice(0,qi);
  const qs=qi<0?'':raw.slice(qi+1);
  const seg=path.split('/').filter(Boolean); // e.g. ['e','m1']
  let html;
  if(seg.length===0) html=home();
  else if(seg[0]==='archive') html=archive(seg[1]?'q='+seg[1]:qs); // legacy #/archive/<text> → ?q=
  else if(seg[0]==='search'){location.hash='#/archive';return;}
  else if(seg[0]==='chrono') html=chrono();
  else if(seg[0]==='map') html=map();
  else if(seg[0]==='library') html=library();
  else if(seg[0]==='cabinet') html=cabinet(seg[1]);
  else if(seg[0]==='cat') html=catalog(seg[1]);
  else if(seg[0]==='e') html=entity(DB[seg[1]]);
  else if(seg[0]==='request'){ html=null; }
  else html=home();
  if(html!==null){document.getElementById('app').innerHTML=html;if((seg[0]||'')!==lastPath)window.scrollTo(0,0);lastPath=seg[0]||'';}
  if(seg[0]==='request') request(seg[1]);
}
window.addEventListener('hashchange',()=>render());
render();
