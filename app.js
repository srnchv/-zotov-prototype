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

// index + bidirectional links
const DB = {}; RAW.forEach(o=>{o.links=o.links||[];DB[o.id]=o});
RAW.forEach(o=>o.links.forEach(id=>{ if(DB[id] && !DB[id].links.includes(o.id)) DB[id].links.push(o.id); }));
const all = t => RAW.filter(o=>o.type===t);
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;');

// ---------- shared chrome ----------
const NAV=[['Архив','#/archive'],['Хронограф','#/chrono'],['Карта','#/map'],['Личности','#/cat/person'],['Темы','#/cat/theme'],['Коллекции','#/cat/collection'],['Проекты','#/cat/project'],['Библиотека','#/cat/source']];
function header(active){
  return `<header class="top"><div class="row">
    <a class="logo" href="#/">ЗОТОВ · АРХИВ</a>
    <nav class="main">${NAV.map(([t,h])=>`<a href="${h}" class="${active===h?'active':''}">${t}</a>`).join('')}
    <a href="#/search">Поиск ⌕</a><a class="btn dark" href="#/cabinet">Войти</a></nav>
  </div></header>`;
}
function footer(){return `<footer><div class="cols">
  <div><h4>Архив</h4><a href="#/chrono">Хронограф</a><a href="#/map">Карта</a><a href="#/cat/person">Личности</a><a href="#/cat/theme">Темы</a></div>
  <div><h4>Коллекции</h4><a href="#/cat/collection">Проекты Центра</a><a href="#/cat/source">Библиотека</a><a href="#/archive">Весь архив</a></div>
  <div><h4>Исследователям</h4><a href="#/cabinet">Регистрация</a><a href="#/cabinet">Заявки на доступ</a><a href="#/cabinet">Личный кабинет</a></div>
  <div><h4>Центр «Зотов»</h4><a href="#/">О центре</a><a href="#/">Контакты</a><a href="#/">hello@zotov.ru</a></div>
</div></footer>`;}
const page=(active,inner)=>header(active)+`<main class="wrap">${inner}</main>`+footer();
const link=o=>`<a class="chip" href="#/e/${o.id}">${esc(o.title)}</a>`;
const tile=o=>`<a class="card tile" href="#/e/${o.id}"><div class="img"></div><div class="kicker">${TYPES[o.type].l}</div><div class="t">${esc(o.title)}</div><div class="muted" style="font-size:13px">${esc(o.date||o.subtype||o.role||'')}</div></a>`;

// related links grouped by type (демонстрирует двусторонние связи)
function relBlock(o,title){
  const by={}; o.links.forEach(id=>{const x=DB[id];if(!x)return;(by[x.type]=by[x.type]||[]).push(x);});
  const order=['person','material','place','event','theme','project','org','collection','source','tag','media'];
  const grps=order.filter(t=>by[t]&&t!=='media').map(t=>`<div class="grp"><div class="lbl">${TYPES[t].pl}</div><div class="chips">${by[t].map(link).join('')}</div></div>`).join('');
  return grps?`<h2>${title||'Связи'}</h2><div class="rel">${grps}</div>`:'';
}

// ---------- views ----------
function home(){
  const rec=all('material');
  return page('#/',`
  <section class="hero"><div class="kicker">Цифровой архив</div>
    <h1>Цифровой архив Центра «Зотов»</h1>
    <div class="lead">Связный архив о конструктивизме, медиа и городской истории: материалы, личности, события, места и проекты, объединённые в единую систему связей.</div>
    <a class="searchbar" href="#/search"><span>Поиск по архиву — материалы, личности, темы, события…</span><span class="btn dark">Найти</span></a>
    <div class="muted" style="margin-top:10px"><a href="#/search">→ Расширенный поиск по 14+ параметрам</a></div>
  </section>
  <section class="pad divider"><h2>Разделы архива</h2><div class="grid g4">
    ${[['Хронограф','#/chrono'],['Карта','#/map'],['Личности','#/cat/person'],['Темы','#/cat/theme'],['Коллекции','#/cat/collection'],['Проекты Центра','#/cat/project'],['Библиотека','#/cat/source'],['Весь архив','#/archive']].map(([t,h])=>`<a class="card" href="${h}"><div class="t" style="font-weight:600">${t}</div></a>`).join('')}
  </div></section>
  <section class="pad"><h2>Рекомендуемые материалы</h2><div class="grid g4">${rec.map(tile).join('')}</div></section>`);
}

function archive(){
  const mats=all('material');
  return page('#/archive',`<div class="crumbs">Архив</div><h1>Архив</h1>
    <a class="searchbar" href="#/search"><span>Поиск по архиву — ключевые слова, личности, темы…</span><span class="btn dark">Найти</span></a>
    <div class="toolbar"><b>Найдено ${mats.length} материалов</b><div class="tools"><span class="btn sm">Сначала новые ▾</span><span class="btn sm">Список / Сетка</span><span class="btn sm">Сохранить поиск</span><span class="btn sm">Экспорт в Excel</span></div></div>
    <div class="archive">
      <div class="filters">
        <div class="grp"><div class="lbl">Тип материала</div>
          ${['Фотография','Документ','Видео','Аудио','Печатное издание','Афиша'].map((s,i)=>`<div class="opt ${i<2?'on':''}"><span class="bx"></span>${s}</div>`).join('')}</div>
        <div class="grp"><div class="lbl">Дата</div><div style="display:flex;gap:10px"><span class="inp" style="flex:1">от</span><span class="inp" style="flex:1">до</span></div><div class="muted" style="font-size:13px;margin-top:6px">точная · период · около</div></div>
        ${['Личность','Место','Событие','Тема','Тег','Проект Центра','Организация','Источник'].map(s=>`<div class="grp"><div class="lbl">${s}</div><div class="inp">Выберите ${s.toLowerCase()} ▾</div></div>`).join('')}
        <span class="btn dark" style="display:block;text-align:center">Применить фильтры</span>
      </div>
      <div><div class="grid g3">${mats.map(tile).join('')}</div></div>
    </div>`);
}

function search(){
  return page('#/search',`<h1>Расширенный поиск</h1>
    <div class="lead" style="font-size:17px">Поиск по 14+ параметрам. Можно комбинировать условия, сохранить запрос и поделиться ссылкой на набор фильтров.</div>
    <div class="field" style="margin-top:24px"><label>Ключевые слова</label><div class="inp" style="display:block">Название, описание, фрагмент текста…</div></div>
    <div class="grp"><div class="lbl" style="font-weight:500;margin:8px 0">Тип материала</div><div class="chips">${['Фотография','Документ','Видео','Аудио','Печатное издание','Афиша','Плакат','Рукопись'].map((s,i)=>`<span class="opt ${i<2?'on':''}" style="margin-right:14px"><span class="bx"></span>${s}</span>`).join('')}</div></div>
    <div class="grid g2" style="margin-top:18px">${['Дата','Личность','Место','Событие','Тема','Тег','Проект Центра','Организация','Коллекция','Источник'].map(s=>`<div class="field"><label>${s}</label><div class="inp" style="display:block">Выберите ${s.toLowerCase()} ▾</div></div>`).join('')}</div>
    <div class="opt on" style="margin:8px 0"><span class="bx"></span>Искать в транскрибациях видео и аудио</div>
    <div style="display:flex;gap:12px;margin-top:10px"><a class="btn dark" href="#/archive">Найти</a><span class="btn">Сохранить поиск</span><span class="btn">Сбросить</span></div>`);
}

function chrono(){
  const items=[...all('event'),...all('material').filter(m=>m.date)];
  const byYear={}; items.forEach(o=>{const y=(o.date||'').match(/\d{4}/);const k=y?y[0]:'—';(byYear[k]=byYear[k]||[]).push(o);});
  const years=Object.keys(byYear).sort();
  return page('#/chrono',`<h1>Хронограф</h1><div class="lead" style="font-size:17px">События и материалы на единой временной шкале.</div>
    <div class="chips" style="margin:18px 0">${['Все периоды','1910-е','1920-е','1930-е'].map((s,i)=>`<span class="chip" ${i==2?'style="background:#1f1f1f;color:#fff"':''}>${s}</span>`).join('')}</div>
    <div class="tl">${years.map(y=>`<div class="row"><div class="yr">${y}</div><div class="cont">${byYear[y].map(o=>`<a class="evt" href="#/e/${o.id}"><div class="th"></div><div><div class="kicker">${TYPES[o.type].l}</div><div class="t" style="font-weight:600;font-size:17px">${esc(o.title)}</div><div class="muted">${esc(o.date)}</div></div></a>`).join('')}</div></div>`).join('')}</div>`);
}

function map(){
  const places=all('place');
  const pts=[[28,26],[55,42],[40,62]];
  return page('#/map',`<h1>Карта</h1><div class="chips" style="margin:8px 0 18px">${['Места','События','Персоны','Организации','Выставки'].map((s,i)=>`<span class="chip" ${i<2?'style="background:#1f1f1f;color:#fff"':''}>${s}</span>`).join('')}</div>
    <div class="maprow"><div>
      <div class="inp" style="display:block;margin-bottom:12px">Поиск по объектам на карте</div>
      ${places.map(p=>`<a class="card" href="#/e/${p.id}" style="display:flex;gap:14px;align-items:center;margin-bottom:12px"><div style="width:40px;height:40px;background:var(--img);border-radius:6px;flex:none"></div><div><div class="t" style="font-weight:600">${esc(p.title)}</div><div class="muted" style="font-size:13px">Место · ${DB[p.id].links.length} связей</div></div></a>`).join('')}
    </div><div class="mapbox">${places.map((p,i)=>`<a class="pin ${i==0?'on':''}" style="left:${pts[i%3][0]}%;top:${pts[i%3][1]}%" href="#/e/${p.id}" title="${esc(p.title)}"></a>`).join('')}</div></div>`);
}

function catalog(type){
  const items=all(type); const T=TYPES[type];
  return page('#/cat/'+type,`<div class="crumbs">${T.pl}</div><h1>${T.pl}</h1>
    <div class="grid ${type==='person'?'g4':'g3'}" style="margin-top:24px">${items.map(o=>`<a class="card tile" href="#/e/${o.id}"><div class="img"></div><div class="t" style="font-weight:600">${esc(o.title)}</div><div class="muted" style="font-size:13px">${esc(o.life||o.colType||o.srcType||o.def||'')}</div></a>`).join('')}</div>`);
}

// entity detail (generic + per-type hero)
function entity(o){
  if(!o) return page('#/','<h1>Не найдено</h1>');
  const T=TYPES[o.type];
  const back={material:'#/archive',person:'#/cat/person',place:'#/map',event:'#/chrono',theme:'#/cat/theme',project:'#/cat/project',org:'#/cat/collection',collection:'#/cat/collection',source:'#/cat/source',media:'#/archive',tag:'#/archive'}[o.type];
  const crumbs=`<div class="crumbs"><a href="${back}">${T.pl}</a> / ${esc(o.title)}</div>`;
  let hero='';
  if(o.type==='material'){
    const access=o.access==='request';
    hero=`${crumbs}<div class="two" style="margin-top:8px"><div><div class="media"></div><div class="thumbs"><div></div><div></div><div></div><div></div></div></div>
      <div><div class="kicker">${esc(o.subtype||'Материал')}</div><h1 style="font-size:30px">${esc(o.title)}</h1>
      <div class="metabox">${[['Тип и подтип',o.subtype],['Дата / период',o.date],['Авторы и участники',(o.authors||[]).map(id=>DB[id]&&DB[id].title).filter(Boolean).join(', ')||'—'],['Права и условия доступа',access?'По запросу · просмотр':'Открытый доступ']].map(r=>`<div class="r"><span class="k">${r[0]}</span><span class="v">${esc(r[1]||'—')}</span></div>`).join('')}</div>
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
    return page('',hero+relBlock(o,'Подтверждает информацию в'));
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
  // materials linked (для не-материальных сущностей показываем "Материалы" отдельной сеткой)
  let matGrid='';
  if(o.type!=='material'&&o.type!=='media'){
    const mats=o.links.map(id=>DB[id]).filter(x=>x&&x.type==='material');
    if(mats.length) matGrid=`<h2>Материалы</h2><div class="grid g4">${mats.map(tile).join('')}</div>`;
  }
  const similar = o.type==='material'?`<h2>Похожие и связанные материалы</h2><div class="grid g4">${all('material').filter(m=>m.id!==o.id).map(tile).join('')}</div>`:'';
  return page('',hero+matGrid+relBlock(o)+similar);
}

function cabinet(){
  const mats=all('material');
  return page('#/cabinet',`<div class="cab">
    <div class="side"><div style="display:flex;gap:12px;align-items:center;padding:8px 4px 16px"><div style="width:44px;height:44px;border-radius:50%;background:var(--img)"></div><div><b>Анна Исследователь</b><div class="kicker">Исследователь</div></div></div>
      ${['Профиль','Сохранённые материалы','Подборки','Заявки на доступ','История просмотров','Уведомления','Настройки'].map((s,i)=>`<a class="${i==1?'active':''}">${s}</a>`).join('')}</div>
    <div><h1 style="font-size:30px">Сохранённые материалы</h1><div class="muted">48 материалов · 3 подборки · 2 активные заявки</div>
      <div class="grid g4" style="margin-top:16px">${mats.map(tile).join('')}</div>
      <h2>Заявки на доступ</h2>
      <div class="metabox">${[['Фотография экспозиции, 1927','На рассмотрении'],['Документ фонда №14','Одобрена'],['Аудиозапись лекции','Требует уточнения']].map(r=>`<div class="r"><span>${r[0]}</span><span class="statbadge">${r[1]}</span></div>`).join('')}</div>
    </div></div>`);
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
function render(hash){
  document.getElementById('modal-root').innerHTML='';
  const h=(hash||location.hash||'#/').replace(/^#/,'');
  const seg=h.split('/').filter(Boolean); // e.g. ['e','m1']
  let html;
  if(seg.length===0) html=home();
  else if(seg[0]==='archive') html=archive();
  else if(seg[0]==='search') html=search();
  else if(seg[0]==='chrono') html=chrono();
  else if(seg[0]==='map') html=map();
  else if(seg[0]==='cabinet') html=cabinet();
  else if(seg[0]==='cat') html=catalog(seg[1]);
  else if(seg[0]==='e') html=entity(DB[seg[1]]);
  else if(seg[0]==='request'){ html=null; }
  else html=home();
  if(html!==null){document.getElementById('app').innerHTML=html;window.scrollTo(0,0);}
  if(seg[0]==='request') request(seg[1]);
}
window.addEventListener('hashchange',()=>render());
render();
