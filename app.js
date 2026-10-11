"use strict";

/* =========================================================
   Speicher
   ========================================================= */
const KEY = "familienkalender.v1";
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const PALETTE = ["#f5a524","#38bdf8","#22c55e","#f43f5e","#a855f7","#14b8a6","#ec4899","#84cc16"];

function defaults(){
  return {
    categories:[
      {id:uid(), name:"Papa",  color:"#38bdf8"},
      {id:uid(), name:"Mama",  color:"#f43f5e"},
      {id:uid(), name:"Kids",  color:"#22c55e"},
      {id:uid(), name:"Familie", color:"#f5a524"}
    ],
    events:[], todos:[],tasks:[],routines:[], meals:{}, lists:null, rewards:[], points:0, history:[],
    settings:{ weekStart:1, showDone:false, appTitle:"Familienkalender", paidBreakfastMin:0, showMoon:false, showZodiac:false, segTask:"open", segRoutine:"open", segCalTask:"all", segCalRoutine:"all" }
  };
}

let S;
let activeProfile = null;
let calMode = "month";
function inProfile(catId){ return !activeProfile || !catId || catId === activeProfile; }
function renderProfiles(){
  try{
    const box = document.getElementById('profiles');
    if(!box) return;
    let html = '<button class="avatar all'+(activeProfile?'':' active')+'" data-profile="" title="Alle Profile anzeigen">★</button>';
    html += S.categories.map(c=>{
      const ini = (c.name||'?').trim().charAt(0).toUpperCase();
      return '<button class="avatar'+(activeProfile===c.id?' active':'')+'" data-profile="'+c.id+'" style="background:'+c.color+'" title="'+esc(c.name)+' anzeigen">'+esc(ini)+'</button>';
    }).join('');
    box.innerHTML = html;
  }catch(e){}
}
function refreshFiltered(){
  try{ if(typeof renderCalendar==='function' && document.getElementById('calGrid')) renderCalendar(); }catch(e){}
  try{ if(typeof renderTasks==='function') renderTasks(); }catch(e){}
  try{ if(typeof renderRoutines==='function') renderRoutines(); }catch(e){}
  try{ if(typeof updateBadges==='function') updateBadges(); }catch(e){}
}
function load(){
  try{
    const raw = localStorage.getItem(KEY);
    S = raw ? Object.assign(defaults(), JSON.parse(raw)) : defaults();
  }catch(e){ S = defaults(); }
  if(!S.lists || !S.lists.length){
    S.lists = [{id:uid(), name:"Einkaufsliste", items:[]}];
  }
  if(!S.settings) S.settings = defaults().settings;
}
function save(){
  localStorage.setItem(KEY, JSON.stringify(S));
  const el = document.getElementById("storageInfo");
  if(el) el.textContent = "Belegt " + (new Blob([JSON.stringify(S)]).size/1024).toFixed(1) + " KB im localStorage.";
}
function setSegActive(id,val){
  var seg=document.getElementById(id); if(!seg) return;
  seg.querySelectorAll('.segbtn').forEach(function(b){ b.classList.toggle('active', (b.dataset.seg||'')===val); });
}
function applySegState(){
  try{
    var st=(typeof S!=="undefined"&&S&&S.settings)||{};
    setSegActive('taskSeg', st.segTask||'open');
    setSegActive('routineSeg', st.segRoutine||'open');
    setSegActive('calTaskSeg', st.segCalTask||'all');
    setSegActive('calRoutineSeg', st.segCalRoutine||'all');
  }catch(e){}
}
function rememberSeg(key,val){
  try{ if(!S.settings) S.settings={}; S.settings[key]=val; save(); }catch(e){}
}
load(); save();
try{
  var t=(S.settings&&S.settings.appTitle)||"Familienkalender";
  document.title = t + " – Ordnung im Alltag ohne Abo";
  var bt=document.getElementById("brandTitle"); if(bt) bt.textContent=t;
}catch(e){}
try{ applySegState(); }catch(e){}
try{ if(S.settings && S.settings.calMode==="day") calMode="day"; }catch(e){}
try{
  if(S && Array.isArray(S.todos)){
    var __mig=false;
    S.todos.forEach(function(t){
      if(t.startDate==null){ if(t.due){ t.startDate=t.due; __mig=true; } else t.startDate=""; }
      if(t.allDay==null){ t.allDay = !(t.startTime||t.dueTime); __mig=true; }
      if(t.startTime==null && t.dueTime && !t.allDay){ t.startTime=t.dueTime; __mig=true; }
      if(t.endDate==null) t.endDate="";
      if(t.endTime==null) t.endTime="";
      if("due" in t){ delete t.due; __mig=true; }
      if("dueTime" in t){ delete t.dueTime; __mig=true; }
    });
    if(__mig) save();
  }
}catch(e){}


/* =========================================================
   Datum / Helfer
   ========================================================= */
const pad = n => String(n).padStart(2,"0");
const iso = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parseISO = s => { const [y,m,d]=s.split("-").map(Number); return new Date(y,m-1,d); };
const today = () => { const d=new Date(); d.setHours(0,0,0,0); return d; };
const clone = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d,n) => { const c=clone(d); c.setDate(c.getDate()+n); return c; };
const sameDay = (a,b) => iso(a)===iso(b);

const ICON_EDIT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
const ICON_TRASH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
const ICON_MORE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';

function astroHTML(d){
  const s=S.settings||{};
  if(!s.showMoon && !s.showZodiac) return "";
  let parts=[];
  if(s.showMoon){ const p=moonInfo(d); parts.push('<span class="m-ph" title="Mondphase: '+esc(p.name)+'">'+p.emoji+"</span>"); }
  if(s.showZodiac){ const z=zodiacInfo(d); parts.push('<span class="m-zod" title="Sternzeichen: '+esc(z.name)+'">'+z.sym+"</span>"); }
  return '<div class="astro">'+parts.join("")+"</div>";
}

let undoInfo=null, undoTimer=null;
function showUndo(msg, fn){
  let bar=document.getElementById('undoToast');
  if(!bar){ bar=document.createElement('div'); bar.id='undoToast'; document.body.appendChild(bar); }
  bar.innerHTML = '<span class="undo-msg">'+msg+'</span><button type="button" class="undo-btn">Rückgängig</button>';
  clearTimeout(undoTimer);
  bar.classList.add('show');
  const run=fn;
  undoInfo=run;
  undoTimer=setTimeout(hideUndo, 6000);
  bar.querySelector('.undo-btn').onclick=function(){
    const f=undoInfo; undoInfo=null;
    hideUndo();
    if(f) f();
  };
}
function hideUndo(){
  clearTimeout(undoTimer);
  const bar=document.getElementById('undoToast');
  if(bar) bar.classList.remove('show');
  undoInfo=null;
}

const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const DOW_FULL = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];

function weekStartDay(){ return Number(S.settings.weekStart ?? 1); }
function startOfWeek(d){
  const c = clone(d), ws = weekStartDay();
  const diff = (c.getDay() - ws + 7) % 7;
  return addDays(c, -diff);
}
function isoWeek(d){
  const c = clone(d); c.setDate(c.getDate() + 3 - ((c.getDay()+6)%7));
  const w1 = new Date(c.getFullYear(),0,4);
  return 1 + Math.round(((c - w1)/86400000 - 3 + ((w1.getDay()+6)%7))/7);
}
function fmtDate(d){
  return DOW_FULL[d.getDay()] + ", " + d.getDate() + ". " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>t.classList.remove("show"), 2600);
}
function hexA(hex, a){
  const h = hex.replace("#","");
  const n = parseInt(h.length===3 ? h.split("").map(c=>c+c).join("") : h, 16);
  return "rgba("+((n>>16)&255)+","+((n>>8)&255)+","+(n&255)+","+a+")";
}
const esc = s => String(s??"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const cat = id => S.categories.find(c=>c.id===id) || {name:"–", color:"#64748b"};

/* =========================================================
   Feiertage (Deutschland, bundesweit)
   ========================================================= */
function easter(y){
  const a=y%19, b=Math.floor(y/100), c=y%100, d=Math.floor(b/4), e=b%4,
        f=Math.floor((b+8)/25), g=Math.floor((b-f+1)/3),
        h=(19*a+b-d-g+15)%30, i=Math.floor(c/4), k=c%4,
        l=(32+2*e+2*i-h-k)%7, m=Math.floor((a+11*h+22*l)/451),
        mo=Math.floor((h+l-7*m+114)/31), da=((h+l-7*m+114)%31)+1;
  return new Date(y, mo-1, da);
}
const holidaysCache = {};
function holidays(y){
  if(holidaysCache[y]) return holidaysCache[y];
  const H = {};
  const add = (d,name)=>{ H[iso(d)] = name; };
  add(new Date(y,0,1), "Neujahr");
  const e = easter(y);
  add(addDays(e,-2), "Karfreitag");
  add(addDays(e,1), "Ostermontag");
  add(new Date(y,4,1), "Tag der Arbeit");
  add(addDays(e,39), "Christi Himmelfahrt");
  add(addDays(e,50), "Pfingstmontag");
  add(addDays(e,60), "Fronleichnam");
  add(new Date(y,9,3), "Tag der Deutschen Einheit");
  add(new Date(y,11,25), "1. Weihnachtsfeiertag");
  add(new Date(y,11,26), "2. Weihnachtsfeiertag");
  add(new Date(y,11,24), "Heiligabend");
  add(new Date(y,11,31), "Silvester");
  holidaysCache[y] = H;
  return H;
}

/* =========================================================
   Mondphase & Sternzeichen
   ========================================================= */
const MOON_NAMES = ["Neumond","Zunehmende Sichel","Erstes Viertel","Zunehmender Mond",
                    "Vollmond","Abnehmender Mond","Letztes Viertel","Abnehmende Sichel"];
function moonInfo(d){
  const toRad = Math.PI/180;
  const constrain = v => { let t = v % 360; return t < 0 ? t+360 : t; };
  // Meeus, Astron. Algorithms – mittlere Elongation D (47.2), Sonnen-/Mond-Anomalie (47.3/47.4)
  const jd = d.getTime()/86400000 + 2440587.5;
  const T = (jd - 2451545) / 36525;
  const D  = constrain(297.8501921 + 445267.1114034*T - 0.0018819*T*T + T**3/545868 - T**4/113065000);
  const M  = constrain(357.5291092 + 35999.0502909*T - 0.0001536*T*T + T**3/24490000);
  const Mp = constrain(134.9633964 + 477198.8675055*T + 0.0087414*T*T + T**3/69699 - T**4/14712000);
  // Phasenwinkel i (48.4) und beleuchteter Anteil k
  const i = constrain(180 - D - 6.289*Math.sin(Mp*toRad) + 2.1*Math.sin(M*toRad)
    - 1.274*Math.sin((2*D-Mp)*toRad) - 0.658*Math.sin(2*D*toRad)
    - 0.214*Math.sin(2*Mp*toRad) - 0.11*Math.sin(D*toRad));
  const illum = Math.round((1 + Math.cos(i*toRad)) / 2 * 100);
  const p = D / 360;
  const idx = Math.round(p*8) % 8;
  return { idx, emoji:["🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘"][idx],
           name:MOON_NAMES[idx], illum, p };
}
const ZODIAC = [
  ["♑","Steinbock","20.12."], ["♒","Wassermann","20.01."], ["♓","Fische","19.02."],
  ["♈","Widder","21.03."], ["♉","Stier","20.04."], ["♊","Zwillinge","21.05."],
  ["♋","Krebs","21.06."], ["♌","Löwe","23.07."], ["♍","Jungfrau","24.08."],
  ["♎","Waage","23.09."], ["♏","Skorpion","24.10."], ["♐","Schütze","23.11."]
];
function zodiacInfo(d){
  const m = d.getMonth()+1, day = d.getDate();
  const starts = [20,19,21,20,21,21,23,23,23,23,22,22];
  // Tag vor dem Monatsbeginn -> Zeichen des Vormonats, sonst das ab diesem Monat startende
  const idx = day < starts[m-1] ? (m+11)%12 : m%12;
  const [sym,name] = ZODIAC[idx];
  return {sym, name};
}

/* =========================================================
   Views / Navigation
   ========================================================= */
let curView = "cal";
function setView(v){
  curView = v;
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active", b.dataset.view===v));
  document.querySelectorAll(".view").forEach(s=>s.classList.toggle("active", s.id==="view-"+v));
  render();
}
var __el=document.getElementById("tabs"); if(__el)__el.addEventListener("click", e=>{
  const b = e.target.closest(".tab"); if(b) setView(b.dataset.view);
});

function render(){
  renderProfiles();
  updateBadges();
  if(curView==="cal") renderCalendar();
  if(curView==="tasks" && typeof renderTasks==="function") renderTasks();
  if(curView==="routines" && typeof renderRoutines==="function") renderRoutines();
  if(curView==="work" && typeof renderWork==="function") renderWork();
  if(curView==="todos") renderTodos();
  if(curView==="meals") renderMeals();
  if(curView==="lists") renderLists();
  if(curView==="points") renderPoints();
  if(curView==="settings") renderSettings();
  try{ if(typeof updateWorkLive==="function" && (curView==="cal" || curView==="work" || (!!(typeof workOpenInterval==="function" && workOpenInterval(wkTodayKey()))))) updateWorkLive(); }catch(e){}
}
function updateBadges(){
  try{
    let n = 0;
    if(S && Array.isArray(S.todos)) S.todos.forEach(t=>{ if(inProfile(t.cat) && !isDone(t)) n++; });
    const b = document.getElementById("todoBadge");
    if(b){ b.textContent = n; b.style.display = n ? "grid" : "none"; }
    let rn = 0;
    if(S && Array.isArray(S.routines)) rn = S.routines.filter(r=>inProfile(r.cat) && !routineIsDone(r)).length;
    const rb = document.getElementById("routineBadge");
    if(rb){ rb.textContent = rn; rb.style.display = rn ? "grid" : "none"; }
  }catch(e){}
}

document.addEventListener("click", e=>{
  const p = e.target.closest("[data-profile]");
  if(!p) return;
  const id = p.dataset.profile;
  activeProfile = (!id || activeProfile === id) ? null : id;
  renderProfiles(); refreshFiltered();
});

/* =========================================================
   Kalender
   ========================================================= */
let calMonth = clone(today());
let selDate = clone(today());

function renderCalendar(){
  updateCalModeUI();
  if(calMode==="day"){ renderDayView(); return; }
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  document.getElementById("calTitle").textContent = MONTHS[m] + " " + y;

  const first = new Date(y,m,1);
  const ws = weekStartDay();
  let lead = (first.getDay() - ws + 7) % 7;
  const start = addDays(first, -lead);
  const H = holidays(y), Hnext = holidays(y+1), Hprev = holidays(y-1);
  const grid = document.getElementById("calGrid");
  let html = "";

  for(let i=0;i<42;i++){
    const d = addDays(start,i);
    const key = iso(d);
    const out = d.getMonth()!==m;
    const evs = eventsOn(key);
    const tks = tasksOn(key);
    let chips = "";
    const cellItems = evs.map(chipHTML).concat(tks.map(taskChipHTML));
    cellItems.slice(0,3).forEach(h=>{ chips += h; });
    if(cellItems.length>3) chips += '<div class="more">+'+(cellItems.length-3)+" weitere</div>";
    const hol = (H[key] || Hnext[key] || Hprev[key]) || "";
    html += '<div class="day'+(out?" out":"")+(sameDay(d,today())?" today":"")+(sameDay(d,selDate)?" selected":"")+'" data-date="'+key+'">'
          +   '<div class="day-head">'
          +     '<div class="daynum">'+d.getDate()+"</div>"
          +     '<button class="plus" data-new="'+key+'" title="Termin anlegen">+</button>'
          +   "</div>"
          +   (hol ? '<div class="holiday">'+esc(hol)+"</div>" : "")
          +   astroHTML(d)
          +   chips
          + "</div>";
  }
  grid.innerHTML = html;
  grid.classList.toggle("copy-mode", !!copyEvId);
  renderLegend();
  renderAgenda(); try{if(typeof updateWorkLive==="function") updateWorkLive();}catch(e){}
  try{ if(typeof renderCalSide==="function") renderCalSide(); }catch(e){}
}
function setCalMode(m){
  calMode = (m==="day") ? "day" : "month";
  try{ if(!S.settings) S.settings={}; S.settings.calMode=calMode; save(); }catch(e){}
  renderCalendar();
}
function updateCalModeUI(){
  try{
    const seg=document.getElementById("calModeSeg");
    if(seg) seg.querySelectorAll(".segbtn").forEach(b=>b.classList.toggle("active", (b.dataset.calmode||"")===calMode));
    const mw=document.getElementById("monthWrap");
    const dv=document.getElementById("dayView");
    if(mw) mw.hidden = calMode==="day";
    if(dv) dv.hidden = calMode!=="day";
    document.body.classList.toggle("cal-day", calMode==="day");
  }catch(e){}
}
function dvHM(m){
  m = Math.max(0, Math.min(1440, m));
  return pad(Math.floor(m/60)%24)+":"+pad(m%60);
}
function layoutDayItems(items){
  items.sort(function(a,b){ return (a.start-b.start) || (a.end-b.end); });
  let i=0;
  while(i<items.length){
    let clusterEnd=items[i].end, j=i;
    const cluster=[];
    while(j<items.length && items[j].start<clusterEnd){
      cluster.push(items[j]);
      if(items[j].end>clusterEnd) clusterEnd=items[j].end;
      j++;
    }
    const lanes=[];
    cluster.forEach(function(it){
      let li=-1;
      for(let k=0;k<lanes.length;k++){ if(lanes[k]<=it.start){ li=k; break; } }
      if(li<0){ li=lanes.length; lanes.push(it.end); }
      else lanes[li]=it.end;
      it.lane=li;
    });
    const n=lanes.length;
    cluster.forEach(function(it){ it.lanes=n; });
    i=j;
  }
  return items;
}
function renderDayView(){
  const key=iso(selDate);
  document.getElementById("calTitle").innerHTML = esc(fmtDate(selDate)) + "<span>Tagesansicht</span>";
  const evs=eventsOn(key);
  const banner=evs.filter(function(e){ return e.allDay || evEndKey(e)!==e.date; });
  const timed=evs.filter(function(e){ return !e.allDay && evEndKey(e)===e.date; });
  const tks=tasksOn(key,true);
  const tksBanner=tks.filter(function(t){ return taskIsAllDay(t) || taskRangeEnd(t)!==taskDate(t); });
  const tksTimed=tks.filter(function(t){ return !taskIsAllDay(t) && taskRangeEnd(t)===taskDate(t); });

  const items=[];
  timed.forEach(function(e){
    const s=e.start?hmToMin(e.start):9*60;
    let en=e.end?hmToMin(e.end):s+60;
    if(en<=s) en=s+60;
    items.push({kind:"ev", ev:e, start:s, end:en});
  });
  tksTimed.forEach(function(t){
    const s=hmToMin(taskStartTime(t));
    const en=taskEndTime(t);
    let e = en ? hmToMin(en) : s+30;
    if(e<=s) e=s+30;
    items.push({kind:"task", task:t, start:s, end:e});
  });
  layoutDayItems(items);

  const PXH=48, PXM=PXH/60, totalH=24*PXH;
  let grid='<div class="dv-grid" data-date="'+key+'" style="height:'+totalH+'px">';
  for(let h=0;h<24;h++) grid+='<div class="dv-hour" style="top:'+(h*PXH)+'px"><span>'+pad(h)+":00</span></div>";
  if(sameDay(selDate,today())){
    const now=new Date(), nowMin=now.getHours()*60+now.getMinutes();
    grid+='<div class="dv-now" style="top:'+(nowMin*PXM)+'px" title="Jetzt"></div>';
  }
  items.forEach(function(it){
    const top=it.start*PXM;
    const hgt=Math.max((it.end-it.start)*PXM,20);
    const w=100/(it.lanes||1);
    const left=it.lane*w;
    const style="top:"+top+"px;height:"+hgt+"px;left:calc("+left+"% + 4px);width:calc("+w+"% - 6px)";
    if(it.kind==="ev"){
      const c=cat(it.ev.cat);
      grid+='<div class="dv-ev dv-ev-term'+(it.ev.done?" done":"")+'" data-ev="'+it.ev.id+'" style="'+style+";background:"+c.color+'" title="'+esc(it.ev.title)+'">'
          + '<div class="dv-ev-t">'+esc(it.ev.start||"")+(it.ev.end?"–"+esc(it.ev.end):"")+"</div>"
          + '<div class="dv-ev-n">'+esc(it.ev.title)+"</div>"
          + '<div class="dv-ev-resize" style="position:absolute;left:0;right:0;bottom:0;height:6px;cursor:ns-resize"></div>'
          + '</div>';
    } else {
      const c=cat(it.task.cat);
      grid+='<div class="dv-ev dv-task'+(taskIsDone(it.task)?" done":"")+'" data-task-open="'+it.task.id+'" style="'+style+";--tc:"+c.color+'" title="'+esc(it.task.title)+'">'
          + '<span class="mark">✓</span><span class="dv-ev-n">'+esc(it.task.title)+"</span></div>";
    }
  });
  grid+="</div>";

  const bannerEvHtml = banner.map(function(e){
    const c=cat(e.cat);
    return '<div class="dv-ad'+(e.done?" done":"")+'" data-ev="'+e.id+'" style="background:'+c.color+'" title="'+esc(e.title)+'">'
         + (evDays(e)>1?"⇥ ":"")+esc(e.title)+"</div>";
  });
  const bannerTaskHtml = tksBanner.map(function(t){
    const c=cat(t.cat);
    return '<div class="dv-ad dv-ad-task'+(taskIsDone(t)?" done":"")+'" data-task-open="'+t.id+'" style="background:'+c.color+'" title="'+esc(t.title)+'">'
         + '<span class="mark">✓</span>'+esc(t.title)+"</div>";
  });
  const bannerAll = bannerEvHtml.concat(bannerTaskHtml);
  const bannerHtml = bannerAll.length ? bannerAll.join("") : '<span class="dv-ad-empty">—</span>';

  document.getElementById("dayView").innerHTML =
      '<div class="dv-allday"><div class="dv-allday-lbl">Ganztägig</div><div class="dv-allday-items">'+bannerHtml+"</div></div>"
    + '<div class="dv-scroll">'+grid+"</div>";

  renderLegend();
  try{ if(typeof renderCalSide==="function") renderCalSide(); }catch(e){}
  try{ if(typeof updateWorkLive==="function") updateWorkLive(); }catch(e){}
  const sc=document.querySelector("#dayView .dv-scroll");
  if(sc){
    if(sameDay(selDate,today())){
      const now=new Date();
      sc.scrollTop=Math.max(0,(now.getHours()*60+now.getMinutes())*PXM-120);
    } else {
      sc.scrollTop=7*PXH;
    }
  }
}
function evEndKey(ev){
  return (ev.endDate && ev.endDate > ev.date) ? ev.endDate : ev.date;
}
function evDays(ev){
  return Math.round((parseISO(evEndKey(ev)) - parseISO(ev.date)) / 86400000) + 1;
}
function evSpanLabel(ev){
  const n = evDays(ev);
  return n===1 ? "1 Tag" : n+" Tage (bis "+evEndKey(ev).split("-").reverse().join(".")+")";
}
let copyEvId = null;
function setCopyEv(id){
  copyEvId = (copyEvId===id) ? null : id;
  const src = copyEvId ? S.events.find(e=>e.id===copyEvId) : null;
  const bar = document.getElementById("copyBar");
  if(copyEvId){
    bar.style.display = "flex";
    document.getElementById("copyBarTitle").textContent = src ? src.title : "";
  } else {
    bar.style.display = "none";
  }
  renderCalendar();
}
function copyEventTo(key){
  if(!copyEvId) return;
  const src = S.events.find(e=>e.id===copyEvId);
  if(!src) return;
  if(S.events.some(e=>e.date===key && e.title===src.title && e.start===src.start && e.cat===src.cat)){
    toast("Bereits vorhanden am "+key.split("-").reverse().join("."));
    return;
  }
  const span = evDays(src);
  S.events.push(Object.assign({}, src, {id:uid(), done:false, date:key,
    endDate: span>1 ? iso(addDays(parseISO(key), span-1)) : ""}));
  save(); renderCalendar();
  toast("Kopiert nach "+key.split("-").reverse().join("."));
}
function eventsOn(key){
  return S.events.filter(e=>inProfile(e.cat) && key >= e.date && key <= evEndKey(e))
    .sort((a,b)=>{
      if(a.date!==b.date) return a.date.localeCompare(b.date);
      if(a.allDay!==b.allDay) return a.allDay?-1:1;
      return (a.start||"").localeCompare(b.start||"");
    });
}
function chipHTML(ev){
  const c = cat(ev.cat);
  const t = ev.allDay ? "" : '<span class="t">'+esc(ev.start||"")+"</span>";
  const n = evDays(ev);
  const marker = n>1 ? "<span>⇥</span>" : "";
  const tip = esc(ev.title) + (n>1 ? " ("+evSpanLabel(ev)+")" : "");
  return '<div class="ev'+(ev.id===copyEvId?" copysrc":"")+(ev.done?" done":"")+'" data-ev="'+ev.id+'" style="background:'+c.color+'" title="'+tip+'">'
       + '<button class="ev-copy" data-copy="'+ev.id+'" title="Termin kopieren">⧉</button>'
       + t + marker + "<span>" + esc(ev.title) + "</span></div>";
}
function taskDate(t){ return (t && (t.startDate || t.due)) ? (t.startDate || t.due) : ""; }
function taskStartTime(t){ return (t && !t.allDay && (t.startTime || t.dueTime)) ? (t.startTime || t.dueTime) : ""; }
function taskEndTime(t){ return (t && !t.allDay && t.endTime) ? t.endTime : ""; }
function taskIsAllDay(t){ return !taskStartTime(t); }
function taskRangeEnd(t){ var s=taskDate(t); return (t && t.endDate && t.endDate>s) ? t.endDate : s; }
function tasksOn(key, includeDone){
  return (Array.isArray(S.todos)?S.todos:[]).filter(function(t){
    if(!inProfile(t.cat)) return false;
    if(!includeDone && taskIsDone(t)) return false;
    if(t.repeat && t.repeat!=="none") return false;
    var s=taskDate(t); if(!s) return false;
    return key>=s && key<=taskRangeEnd(t);
  }).sort(function(a,b){
    var aa=taskIsAllDay(a)?0:1, bb=taskIsAllDay(b)?0:1;
    if(aa!==bb) return aa-bb;
    return (taskStartTime(a)||"").localeCompare(taskStartTime(b)||"");
  });
}
function taskChipHTML(t){
  var c = cat(t.cat);
  var st = taskStartTime(t), en = taskEndTime(t);
  var tip = esc(t.title) + (st ? " · "+esc(st)+(en ? "–"+esc(en) : "") : " · ganztägig");
  return '<div class="task-chip'+(taskIsDone(t)?" done":"")+'" data-task-open="'+t.id+'" style="--tc:'+c.color+'" title="'+tip+'">'
       + (st ? '<span class="t">'+esc(st)+'</span>' : '')
       + '<span class="mark" aria-hidden="true">✓</span>'
       + '<span>'+esc(t.title)+'</span></div>';
}
function renderLegend(){
  document.getElementById("legend").innerHTML = S.categories.map(c=>
    '<span class="chip" style="background:'+hexA(c.color,.16)+';border-color:'+hexA(c.color,.45)+(activeProfile&&c.id!==activeProfile?";opacity:.4":"")+'">'
    + '<span style="width:10px;height:10px;border-radius:3px;background:'+c.color+';display:inline-block"></span>'
    + esc(c.name) + "</span>").join("");
}
function renderAgenda(){
  document.getElementById("agendaDate").textContent = fmtDate(selDate);
  const key = iso(selDate);
  const evs = eventsOn(key);
  const tks = tasksOn(key);
  const hol = holidays(selDate.getFullYear())[key];
  const parts = [];
  if(evs.length) parts.push(evs.length+(evs.length===1?" Termin":" Termine"));
  if(tks.length) parts.push(tks.length+(tks.length===1?" Aufgabe":" Aufgaben"));
  document.getElementById("agendaSub").innerHTML =
    (hol ? '<span style="color:#fca5a5">🎉 '+esc(hol)+"</span> · " : "")
    + (sameDay(selDate,today()) ? "Heute · " : "")
    + (parts.length ? parts.join(" · ") : "keine Einträge");

  const box = document.getElementById("agenda");
  if(!evs.length && !tks.length){
    box.innerHTML = '<div class="empty"><span class="big">🗓️</span>Noch keine Termine an diesem Tag.<br>'
                  + 'Über „+ Termin“ oder das <b>+</b> in der Tageszelle anlegen.</div>';
    return;
  }
  const evHtml = evs.map(ev=>{
    const c = cat(ev.cat);
    return '<div class="ag-item'+(ev.done?" done":"")+'" style="--c:'+c.color+'">'
      + '<div class="when">'+(ev.allDay?"ganztägig":esc((ev.start||"—")+"–"+(ev.end||"")))+"</div>"
      + "<div><div class=\"ttl\">"+esc(ev.title)+"</div>"
      + '<div class="sub"><span class="pill" style="background:'+c.color+'">'+esc(c.name)+"</span>"
      + (evDays(ev)>1 ? " · 📅 "+esc(ev.date.split("-").reverse().join("."))+"–"+esc(evEndKey(ev).split("-").reverse().join(".")) : "")
      + (ev.note ? " · "+esc(ev.note) : "") + "</div></div>"
      + '<div class="ag-actions"><button type="button" class="linkbtn act" data-ev="'+ev.id+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
      + '<button type="button" class="linkbtn act" data-copy="'+ev.id+'">⧉ Kopieren</button>'
      + '<button type="button" class="linkbtn act del" data-evdel="'+ev.id+'" title="Löschen">'+ICON_TRASH+'</button></div>'
      + "</div>";
  }).join("");
  const tkHtml = tks.map(t=>{
    const c = cat(t.cat);
    const idx = S.todos.indexOf(t);
    return '<div class="ag-item task" style="--c:'+c.color+'">'
      + '<button type="button" class="task-check" data-task-toggle="'+idx+'" title="Erledigt abhaken">✓</button>'
      + '<div class="when">'+(taskIsAllDay(t)?"ganztägig":esc(taskStartTime(t))+(taskEndTime(t)?"–"+esc(taskEndTime(t)):""))+'</div>'
      + '<div class="tclick" data-task-open="'+t.id+'"><div class="ttl">'+esc(t.title)+'</div>'
      + '<div class="sub"><span class="pill" style="background:'+c.color+'">'+esc(c.name)+'</span>'
      + (spanTxt(t) ? " · 🗓 "+esc(spanTxt(t)) : "")
      + (t.note ? " · "+esc(t.note) : "") + "</div></div>"
      + '<div class="ag-actions"><button type="button" class="linkbtn act" data-task-edit="'+idx+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
      + '<button type="button" class="linkbtn act del" data-task-del="'+idx+'" title="Löschen">'+ICON_TRASH+'</button></div>'
      + "</div>";
  }).join("");
  box.innerHTML = evHtml + tkHtml;
}

var __el=document.getElementById("calGrid"); if(__el)__el.addEventListener("click", e=>{
  const tOpen = e.target.closest("[data-task-open]");
  if(tOpen){ const tt=S.todos.find(x=>x.id===tOpen.dataset.taskOpen); if(tt){ openTodo(tt.id,"task"); return; } }
  const copy = e.target.closest("[data-copy]");
  if(copy){ setCopyEv(copy.dataset.copy); return; }
  if(copyEvId){
    const day = e.target.closest(".day");
    if(day && !e.target.closest("[data-new]") && !e.target.closest(".ev")){
      copyEventTo(day.dataset.date);
      return;
    }
  }
  const plus = e.target.closest("[data-new]");
  if(plus){ openEvent(null, plus.dataset.new); return; }
  const evBtn = e.target.closest("[data-ev]");
  if(evBtn){ openEvent(evBtn.dataset.ev); return; }
  const day = e.target.closest(".day");
  if(day){
    selDate = parseISO(day.dataset.date);
    document.querySelectorAll("#calGrid .day.selected").forEach(x=>x.classList.remove("selected"));
    day.classList.add("selected");
    renderAgenda(); try{if(typeof updateWorkLive==="function") updateWorkLive();}catch(e){}
    try{ if(typeof renderCalSide==="function") renderCalSide(); }catch(e){}
  }
});
var __el=document.getElementById("agenda"); if(__el)__el.addEventListener("click", e=>{
  const tOpen = e.target.closest("[data-task-open]");
  if(tOpen){ const tt=S.todos.find(x=>x.id===tOpen.dataset.taskOpen); if(tt){ openTodo(tt.id,"task"); return; } }
  const ed = e.target.closest("[data-evdel]");
  if(ed){ 
    if(copyEvId && e.target.closest("[data-copy]")) return;
    deleteEvent(ed.dataset.evdel); return; 
  }
  const cp = e.target.closest("[data-copy]");
  if(cp){ setCopyEv(cp.dataset.copy); return; }
  const ev = e.target.closest("[data-ev]");
  if(ev){ openEvent(ev.dataset.ev); }
});
var __el=document.getElementById("calGrid"); if(__el)__el.addEventListener("dblclick", e=>{
  if(e.target.closest("[data-new],[data-ev],[data-task-open],[data-copy]")) return;
  const day=e.target.closest(".day");
  if(day){ selDate=parseISO(day.dataset.date); setCalMode("day"); }
});
var __cms=document.getElementById("calModeSeg"); if(__cms)__cms.addEventListener("click", e=>{
  const b=e.target.closest("[data-calmode]");
  if(b) setCalMode(b.dataset.calmode);
});
var __dv=document.getElementById("dayView"); if(__dv)__dv.addEventListener("click", e=>{
  const to=e.target.closest("[data-task-open]");
  if(to){ const tt=S.todos.find(x=>x.id===to.dataset.taskOpen); if(tt){ openTodo(tt.id,"task"); return; } }
  const ev=e.target.closest("[data-ev]");
  if(ev){ openEvent(ev.dataset.ev); return; }
  const grid=e.target.closest(".dv-grid");
  if(grid){
    const rect=grid.getBoundingClientRect();
    let min=Math.round(((e.clientY-rect.top)/48*60)/30)*30;
    if(isNaN(min)) return;
    min=Math.max(0,Math.min(min,1440-30));
    openEvent(null, grid.dataset.date, dvHM(min));
  }
});
document.getElementById("btnPrev").onclick = ()=>{
  if(calMode==="day"){ selDate=addDays(selDate,-1); calMonth=new Date(selDate.getFullYear(),selDate.getMonth(),1); }
  else { calMonth.setMonth(calMonth.getMonth()-1); }
  renderCalendar();
};
document.getElementById("btnNext").onclick = ()=>{
  if(calMode==="day"){ selDate=addDays(selDate,1); calMonth=new Date(selDate.getFullYear(),selDate.getMonth(),1); }
  else { calMonth.setMonth(calMonth.getMonth()+1); }
  renderCalendar();
};
document.getElementById("btnToday").onclick = ()=>{ calMonth=clone(today()); selDate=clone(today()); renderCalendar(); };
document.getElementById("btnNewEvent").onclick = ()=>openEvent(null, iso(selDate));
document.getElementById("btnNewEvent2").onclick = ()=>openEvent(null, iso(selDate));
document.getElementById("copyBarBtn").onclick = ()=>setCopyEv(null);
document.addEventListener("click", e=>{
  const tp = e.target.closest("[data-timefor]");
  if(!tp) return;
  const inp = document.getElementById(tp.dataset.timefor);
  if(!inp) return;
  if(inp.showPicker){ try{ inp.showPicker(); }catch(err){ inp.focus(); } }
  else { inp.focus(); }
});

/* =========================================================
   Termin-Modal
   ========================================================= */
let editingEvent = null;
function fillCatSelect(sel, selected){
  sel.innerHTML = S.categories.map(c=>'<option value="'+c.id+'"'+(c.id===selected?" selected":"")+">"
    + esc(c.name) + "</option>").join("");
}
function openEvent(id, date, start){
  editingEvent = id ? S.events.find(e=>e.id===id) : null;
  const e = editingEvent;
  document.getElementById("evModalTitle").textContent = e ? "Termin bearbeiten" : "Neuer Termin";
  document.getElementById("evTitle").value = e ? e.title : "";
  document.getElementById("evDate").value = e ? e.date : (date || iso(selDate));
  document.getElementById("evEndDate").value = e && e.endDate ? e.endDate : "";
  const daysEl = document.getElementById("evDays");
  if(daysEl) daysEl.value = e && e.endDate
    ? (Math.round((parseISO(e.endDate) - parseISO(e.date)) / 86400000) + 1)
    : 1;
  fillCatSelect(document.getElementById("evCat"), e ? e.cat : (S.categories[0]||{}).id);
  document.getElementById("evAllDay").checked = e ? !!e.allDay : !start;
  document.getElementById("evStart").value = e && e.start ? e.start : (start || "09:00");
  document.getElementById("evEnd").value = e && e.end ? e.end
    : (start ? dvHM(Math.min(hmToMin(start)+60, 1439)) : "10:00");
  document.getElementById("evDur").value = "";
  document.getElementById("evDurUnit").value = "60";
  if(e && !e.allDay && e.start && e.end) evSetDurFromTimes();
  document.getElementById("evNote").value = e ? (e.note||"") : "";
  document.getElementById("evDelete").style.display = e ? "" : "none";
  document.getElementById("evDoneField").style.display = e ? "" : "none";
  document.getElementById("evDone").checked = e ? !!e.done : false;
  toggleTimeFields();
  updateSpan();
  openModal("evModal");
  document.getElementById("evTitle").focus();
}
function updateSpan(){
  const s = document.getElementById("evDate").value;
  const e = document.getElementById("evEndDate").value;
  const endEl = document.getElementById("evEndDate");
  if(s) endEl.min = s;
  let n = 1;
  if(s && e && e > s) n = Math.round((parseISO(e) - parseISO(s)) / 86400000) + 1;
  const daysEl = document.getElementById("evDays");
  if(daysEl) daysEl.value = n;
}
document.getElementById("evDate").onchange = ()=>{
  const s = document.getElementById("evDate").value;
  const e = document.getElementById("evEndDate");
  if(s && e.value && e.value < s) e.value = s;
  updateSpan();
};
document.getElementById("evEndDate").onchange = updateSpan;
document.getElementById("evDays").onchange = ()=>{
  const s = document.getElementById("evDate").value;
  if(!s) return;
  let n = parseInt(document.getElementById("evDays").value) || 1;
  if(n < 1) n = 1;
  if(n > 366) n = 366;
  document.getElementById("evDays").value = n;
  document.getElementById("evEndDate").value = iso(addDays(parseISO(s), n - 1));
  updateSpan();
};
function toggleTimeFields(){
  const ad = document.getElementById("evAllDay").checked;
  document.getElementById("evTimeFields").style.display = ad ? "none" : "grid";
  document.getElementById("evDurField").style.display = ad ? "none" : "";
}
document.getElementById("evAllDay").onchange = toggleTimeFields;
function evDurMinutes(){
  const d=parseFloat(document.getElementById("evDur").value||"0")||0;
  const u=parseInt(document.getElementById("evDurUnit").value||"60",10)||60;
  return Math.round(d*u);
}
function evSetDurFromTimes(){
  const s=document.getElementById("evStart").value;
  const e=document.getElementById("evEnd").value;
  if(!s||!e) return;
  let diff=hmToMin(e)-hmToMin(s);
  if(diff<0) diff+=1440;
  const u=parseInt(document.getElementById("evDurUnit").value||"60",10)||60;
  const val=diff/u;
  document.getElementById("evDur").value=(val%1===0)?val:(Math.round(val*100)/100);
}
function evSetEndFromDur(){
  const s=document.getElementById("evStart").value;
  const mins=evDurMinutes();
  if(!s||!mins) return;
  const total=hmToMin(s)+mins;
  document.getElementById("evEnd").value=dvHM(total%1440);
  const roll=Math.floor(total/1440);
  const sd=document.getElementById("evDate").value;
  if(roll>0 && sd){ const ed=document.getElementById("evEndDate"); if(!ed.value){ ed.value=iso(addDays(parseISO(sd), roll)); updateSpan(); } }
}
document.getElementById("evStart").onchange=()=>{
  if(parseFloat(document.getElementById("evDur").value||"0")) evSetEndFromDur();
  else evSetDurFromTimes();
};
document.getElementById("evEnd").onchange=evSetDurFromTimes;
document.getElementById("evDur").onchange=evSetEndFromDur;
document.getElementById("evDurUnit").onchange=evSetEndFromDur;

document.getElementById("evSave").onclick = ()=>{
  const title = document.getElementById("evTitle").value.trim();
  const date = document.getElementById("evDate").value;
  if(!title){ toast("Bitte einen Titel eingeben."); return; }
  if(!date){ toast("Bitte ein Datum wählen."); return; }
  let endDate = document.getElementById("evEndDate").value;
  if(endDate && endDate < date){ toast("Das Enddatum liegt vor dem Beginn."); return; }
  if(endDate === date) endDate = "";
  const allDay = document.getElementById("evAllDay").checked;
  const data = {
    title, date, endDate,
    cat: document.getElementById("evCat").value,
    allDay,
    start: allDay ? "" : document.getElementById("evStart").value,
    end: allDay ? "" : document.getElementById("evEnd").value,
    note: document.getElementById("evNote").value.trim(),
    done: document.getElementById("evDone").checked
  };
  if(editingEvent) Object.assign(editingEvent, data);
  else S.events.push(Object.assign({id:uid()}, data));
  save(); closeModals();
  selDate = parseISO(date); calMonth = new Date(selDate.getFullYear(), selDate.getMonth(), 1);
  render();
  toast(endDate ? "Termin über "+evSpanLabel({date, endDate})+" gespeichert." : "Termin gespeichert.");
};
document.getElementById("evDelete").onclick = ()=>{
  if(!editingEvent) return;
  deleteEvent(editingEvent.id);
};
function deleteEvent(id){
  S.events = S.events.filter(e=>e.id!==id);
  if(copyEvId===id) setCopyEv(null);
  save(); closeModals(); render(); toast("Termin gelöscht.");
}

/* =========================================================
   To-Dos & Routinen
   ========================================================= */
let tFilter = "todo";
function isDone(t){
  return taskIsDone(t);
}
function renderTodos(){
  if(!document.getElementById("todoList")) return;
  document.getElementById("fTodo").classList.toggle("active", tFilter==="todo");
  document.getElementById("fRoutine").classList.toggle("active", tFilter==="routine");
  document.getElementById("fAll").classList.toggle("active", tFilter==="all");
  document.getElementById("todoListTitle").textContent =
    tFilter==="routine" ? "Routinen" : tFilter==="all" ? "Alle offenen Einträge" : "Offene To-Dos";

  const open = S.todos.filter(t=>{
    if(isDone(t)) return false;
    if(tFilter==="todo") return t.repeat==="none";
    if(tFilter==="routine") return t.repeat!=="none";
    return true;
  });
  const box = document.getElementById("todoList");
  if(!open.length){
    box.innerHTML = '<div class="empty"><span class="big">🎉</span>Alles erledigt – Klasse!</div>';
  }else{
    box.innerHTML = open.map(todoHTML).join("");
  }

  const doneBtn = document.getElementById("btnToggleDone");
  doneBtn.textContent = S.settings.showDone ? "Erledigte ausblenden" : "Erledigte anzeigen";
  const done = S.settings.showDone ? S.todos.filter(isDone) : [];
  document.getElementById("doneList").innerHTML = done.length
    ? '<h2 class="sec">Erledigt</h2>' + done.map(todoHTML).join("")
    : "";
  updateBadges();
}
function todoHTML(t){
  const c = cat(t.cat);
  const rep = t.repeat==="daily" ? "täglich" : t.repeat==="weekly" ? "wöchentlich" : "";
  const due = t.due ? (parseISO(t.due) < today() && !isDone(t)
      ? '<span style="color:#f87171">überfällig '+esc((t.due||"").split("-").reverse().join("."))+"</span>" : esc((t.due||"").split("-").reverse().join("."))) : "";
  return '<div class="item'+(isDone(t)?" done":"")+'">'
    + '<button class="check'+(isDone(t)?" on":"")+'" data-td-toggle="'+t.id+'">✓</button>'
    + '<div><div class="it-title">'+esc(t.title)+"</div>"
    + '<div class="it-sub"><span class="pill" style="background:'+c.color+'">'+esc(c.name)+"</span>"
    + (rep ? "<span>↻ "+rep+"</span>" : "")
    + (due ? "<span>📅 "+due+"</span>" : "")
    + (t.points ? '<span class="plus-points">+'+t.points+" ⭐</span>" : "")
    + "</div></div>"
    + '<div class="it-actions"><button class="linkbtn" data-td-edit="'+t.id+'">Bearbeiten</button></div>'
    + "</div>";
}
if((document.getElementById("view-todos")||document.getElementById("view-tasks")))(document.getElementById("view-todos")||document.getElementById("view-tasks")).addEventListener("click", e=>{
  const f = e.target.closest("[data-tfilter]");
  if(f){ tFilter = f.dataset.tfilter; renderTodos(); return; }
  const tg = e.target.closest("[data-td-toggle]");
  if(tg){ toggleTodo(tg.dataset.tdToggle); return; }
  const ed = e.target.closest("[data-td-edit]");
  if(ed){ openTodo(ed.dataset.tdEdit); }
});
(function(){ const el = document.getElementById("btnToggleDone"); if(el) el.onclick = ()=>{
  S.settings.showDone = !S.settings.showDone; save(); renderTodos();
}; })();
function toggleTodo(id){
  const t = S.todos.find(x=>x.id===id); if(!t) return;
  if(t.repeat==="none"){
    const was = t.done; t.done = !was;
    if(!was) addPoints(t.points||1, t.title);
    else removePoints(t.points||1, t.title);
  }else{
    const was = isDone(t);
    if(was){ t.lastDone = null; removePoints(t.points||1, t.title); }
    else { t.lastDone = iso(today()); addPoints(t.points||1, t.title); }
  }
  save(); render();
}
let editingTodo = null;
let editingRoutine = null;
let tdMode = "task";
var __btnNewTodo=document.getElementById("btnNewTodo"); if(__btnNewTodo) __btnNewTodo.onclick = ()=>openTodo(null);
var __btnNewTask=document.getElementById("btnNewTask"); if(__btnNewTask) __btnNewTask.onclick = ()=>openTodo(null, "task");
var __btnNewRoutine=document.getElementById("btnNewRoutine"); if(__btnNewRoutine) __btnNewRoutine.onclick = ()=>openTodo(null, "routine");
function openTodo(id, mode){
  tdMode = mode || "task";
  editingTodo = null; editingRoutine = null;
  if(id!=null){
    if(tdMode==="routine"){ const i=Number(id); if(!isNaN(i)) editingRoutine = S.routines[i]; }
    else editingTodo = S.todos.find(t=>t.id===id) || null;
  }
  const e = editingTodo || editingRoutine;
  const isR = tdMode==="routine";
  document.getElementById("tdModalTitle").textContent = e
    ? (isR ? "Routine bearbeiten" : "Aufgabe bearbeiten")
    : (isR ? "Neue Routine" : "Neue Aufgabe");
  document.getElementById("tdTitle").value = e ? (e.title || e.name || "") : "";
  fillCatSelect(document.getElementById("tdCat"), e ? e.cat : (activeProfile || (S.categories[0]||{}).id));
  document.getElementById("tdRepeat").value = e ? (e.repeat || e.freq || "none") : (isR ? "daily" : "none");
  document.getElementById("tdPoints").value = e ? (e.points ?? 1) : 1;
  document.getElementById("tdDone").checked = e ? taskIsDone(e) : false;
  document.getElementById("tdDoneField").style.display = isR ? "none" : "";
  document.getElementById("tdTime").value = (e && e.time && e.time!=="any") ? e.time : "";
  document.getElementById("tdStart").value = (e && e.startDate) ? e.startDate : "";
  document.getElementById("tdEnd").value = (e && e.endDate) ? e.endDate : "";
  const tdAllDay = e ? (e.allDay !== false) : true;
  document.getElementById("tdAllDay").checked = tdAllDay;
  document.getElementById("tdStartTime").value = (e && e.startTime) ? e.startTime : "";
  document.getElementById("tdEndTime").value = (e && e.endTime) ? e.endTime : "";
  document.getElementById("tdDur").value = "";
  document.getElementById("tdDurUnit").value = "60";
  if(!tdAllDay && e && e.startTime && e.endTime) setDurFromTimes();
  updateTdSpan();
  document.getElementById("tdRoutineTimeField").style.display = isR ? "" : "none";
  document.getElementById("tdSpanFields").style.display = isR ? "none" : "";
  document.getElementById("tdAllDayField").style.display = isR ? "none" : "";
  if(isR){ document.getElementById("tdTimeFields").style.display="none"; document.getElementById("tdDurFields").style.display="none"; }
  else { toggleTdTimeFields(); }
  document.getElementById("tdNote").value = (e && e.note) ? e.note : "";
  document.getElementById("tdDelete").style.display = e ? "" : "none";
  openModal("tdModal");
  document.getElementById("tdTitle").focus();
}
function setTaskDone(t, done){
  const pts = t.points || 1;
  if(t.repeat && t.repeat !== "none"){
    if(done){ t.lastDone = iso(today()); t.completedAt = new Date().toISOString(); addPoints(pts, t.title); }
    else { t.lastDone = null; delete t.completedAt; removePoints(pts, t.title); }
  }else{
    t.done = !!done;
    if(done){ t.completedAt = new Date().toISOString(); addPoints(pts, t.title); }
    else { delete t.completedAt; removePoints(pts, t.title); }
  }
}
document.getElementById("tdSave").onclick = ()=>{
  const title = document.getElementById("tdTitle").value.trim();
  if(!title){ toast("Bitte einen Titel eingeben."); return; }
  const cat = document.getElementById("tdCat").value;
  const repeat = document.getElementById("tdRepeat").value;
  const points = Math.max(0, parseInt(document.getElementById("tdPoints").value||"0",10));
  const note = document.getElementById("tdNote").value.trim();
  if(tdMode==="routine"){
    const time = document.getElementById("tdTime").value || "";
    const data = {name:title, freq:repeat, cat, note, points, time};
    if(editingRoutine) Object.assign(editingRoutine, data);
    else S.routines.push(Object.assign({id:uid(), done:false, lastDone:null, completedAt:null}, data));
  }else{
    const allDay = document.getElementById("tdAllDay").checked;
    let startDate = document.getElementById("tdStart").value || "";
    let endDate = document.getElementById("tdEnd").value || "";
    let startTime = allDay ? "" : (document.getElementById("tdStartTime").value || "");
    let endTime = allDay ? "" : (document.getElementById("tdEndTime").value || "");
    if(endDate && !startDate){ startDate = endDate; endDate = ""; }
    if(startDate && endDate && endDate < startDate){ toast("Das Enddatum liegt vor dem Beginn."); return; }
    if(endDate === startDate) endDate = "";
    if(!allDay){
      if(!startTime){ toast("Bitte eine Von-Zeit angeben."); return; }
      if(!startDate) startDate = iso(today());
      if(endTime && endTime < startTime && !endDate) endDate = iso(addDays(parseISO(startDate),1));
    }
    const data = {title, cat, repeat, points, note, startDate, endDate, allDay, startTime, endTime};
    const doneNow = document.getElementById("tdDone").checked;
    if(editingTodo){
      const wasDone = taskIsDone(editingTodo);
      Object.assign(editingTodo, data);
      if(doneNow !== wasDone) setTaskDone(editingTodo, doneNow);
    }else{
      const t = Object.assign({id:uid(), done:false, lastDone:null}, data);
      S.todos.push(t);
      if(doneNow) setTaskDone(t, true);
    }
  }
  save(); closeModals(); render(); toast("Eintrag gespeichert.");
};
document.getElementById("tdDelete").onclick = ()=>{
  if(tdMode==="routine"){
    if(!editingRoutine) return;
    S.routines = S.routines.filter(r=>r!==editingRoutine);
  }else{
    if(!editingTodo) return;
    S.todos = S.todos.filter(t=>t!==editingTodo);
  }
  save(); closeModals(); render(); toast("Eintrag gelöscht.");
};
function updateTdSpan(){
  const s=document.getElementById("tdStart").value;
  const e=document.getElementById("tdEnd");
  if(e && s) e.min=s;
}
document.getElementById("tdStart").onchange = ()=>{
  const s=document.getElementById("tdStart").value;
  const e=document.getElementById("tdEnd");
  if(s && e.value && e.value < s) e.value=s;
  updateTdSpan();
};
document.getElementById("tdEnd").onchange = updateTdSpan;
function toggleTdTimeFields(){
  const allDay=document.getElementById("tdAllDay").checked;
  document.getElementById("tdTimeFields").style.display = allDay ? "none" : "grid";
  document.getElementById("tdDurFields").style.display = allDay ? "none" : "grid";
}
document.getElementById("tdAllDay").onchange = toggleTdTimeFields;
function tdDurMinutes(){
  const d=parseFloat(document.getElementById("tdDur").value||"0")||0;
  const u=parseInt(document.getElementById("tdDurUnit").value||"60",10)||60;
  return Math.round(d*u);
}
function setDurFromTimes(){
  const s=document.getElementById("tdStartTime").value;
  const e=document.getElementById("tdEndTime").value;
  if(!s||!e) return;
  let diff=hmToMin(e)-hmToMin(s);
  if(diff<0) diff+=1440;
  const u=parseInt(document.getElementById("tdDurUnit").value||"60",10)||60;
  const val=diff/u;
  document.getElementById("tdDur").value=(val%1===0)?val:(Math.round(val*100)/100);
}
function setEndFromDur(){
  const s=document.getElementById("tdStartTime").value;
  const mins=tdDurMinutes();
  if(!s||!mins) return;
  const total=hmToMin(s)+mins;
  document.getElementById("tdEndTime").value=dvHM(total%1440);
  const roll=Math.floor(total/1440);
  const sd=document.getElementById("tdStart").value;
  if(roll>0 && sd) document.getElementById("tdEnd").value=iso(addDays(parseISO(sd), roll));
}
document.getElementById("tdStartTime").onchange=()=>{
  if(parseFloat(document.getElementById("tdDur").value||"0")) setEndFromDur();
  else setDurFromTimes();
};
document.getElementById("tdEndTime").onchange=setDurFromTimes;
document.getElementById("tdDur").onchange=setEndFromDur;
document.getElementById("tdDurUnit").onchange=setEndFromDur;

/* =========================================================
   Mahlzeiten
   ========================================================= */
let mealWeek = clone(today());
const MEALS = [["breakfast","Frühstück"],["lunch","Mittagessen"],["dinner","Abendessen"]];
function renderMeals(){
  const ws = startOfWeek(mealWeek);
  const we = addDays(ws,6);
  document.getElementById("mealTitle").innerHTML =
    ws.getDate()+". "+MONTHS[ws.getMonth()]+" – "+we.getDate()+". "+MONTHS[we.getMonth()]+" "+we.getFullYear()
    + "<span>KW "+isoWeek(ws)+"</span>";

  let head = "<tr><th></th>";
  for(let i=0;i<7;i++){
    const d = addDays(ws,i);
    const wend = d.getDay()===0 || d.getDay()===6;
    head += '<th class="'+(wend?"wkend":"")+'">'+DOW_FULL[d.getDay()].slice(0,2)+". "+d.getDate()+"."+pad(d.getMonth()+1)+"</th>";
  }
  head += "</tr>";

  let body = "";
  MEALS.forEach(([k,label])=>{
    body += "<tr><th>"+label+"</th>";
    for(let i=0;i<7;i++){
      const key = iso(addDays(ws,i));
      const m = (S.meals[key]||{})[k];
      const val = m ? m.text : "";
      body += '<td><button class="meal-cell'+(val?"":" empty-cell")+'" data-meal="'+key+"|"+k+'">'
            + "<b>"+label+"</b>"+(val ? esc(val) : "eintragen…")+"</button></td>";
    }
    body += "</tr>";
  });
  document.getElementById("mealTable").innerHTML = head + body;
}
document.getElementById("mealPrev").onclick = ()=>{ mealWeek = addDays(mealWeek,-7); renderMeals(); };
document.getElementById("mealNext").onclick = ()=>{ mealWeek = addDays(mealWeek,7); renderMeals(); };
document.getElementById("mealToday").onclick = ()=>{ mealWeek = clone(today()); renderMeals(); };
document.getElementById("mealToShop").onclick = ()=>setView("lists");

let mealKey = null;
var __el=document.getElementById("mealTable"); if(__el)__el.addEventListener("click", e=>{
  const b = e.target.closest("[data-meal]"); if(!b) return;
  mealKey = b.dataset.meal;
  const [date,k] = mealKey.split("|");
  const m = (S.meals[date]||{})[k];
  document.getElementById("mealModalTitle").textContent =
    DOW_FULL[parseISO(date).getDay()] + " · " + MEALS.find(x=>x[0]===k)[1];
  document.getElementById("mealText").value = m ? m.text : "";
  document.getElementById("mealIngredients").value = m && m.ing ? m.ing : "";
  openModal("mealModal");
  document.getElementById("mealText").focus();
});
document.getElementById("mealSave").onclick = ()=>{
  const [date,k] = mealKey.split("|");
  const text = document.getElementById("mealText").value.trim();
  const ing = document.getElementById("mealIngredients").value.trim();
  if(!text){ delete (S.meals[date]||{})[k]; }
  else{
    S.meals[date] = S.meals[date]||{};
    S.meals[date][k] = {text, ing};
  }
  save(); closeModals(); renderMeals(); toast("Speiseplan gespeichert.");
};
document.getElementById("mealDelete").onclick = ()=>{
  const [date,k] = mealKey.split("|");
  if(S.meals[date]) delete S.meals[date][k];
  save(); closeModals(); renderMeals(); toast("Zelle geleert.");
};

/* =========================================================
   Listen (Einkaufsliste & Co.)
   ========================================================= */
let curList = null;
function activeList(){ return S.lists.find(l=>l.id===curList) || S.lists[0]; }
function renderLists(){
  if(!activeList()) curList = S.lists[0] && S.lists[0].id;
  document.getElementById("listTabs").innerHTML = S.lists.map(l=>
    '<button class="btn sm'+(l.id===activeList().id?" primary":"")+'" data-list="'+l.id+'">'+esc(l.name)+"</button>"
  ).join("");
  const L = activeList();
  const done = L.items.filter(i=>i.done).length;
  const pct = L.items.length ? Math.round(done/L.items.length*100) : 0;
  document.getElementById("shopProgress").textContent = pct+"%";
  document.getElementById("shopBar").style.width = pct+"%";

  const box = document.getElementById("shopList");
  if(!L.items.length){
    box.innerHTML = '<div class="empty"><span class="big">🛒</span>Liste ist leer.</div>';
  }else{
    const sorted = L.items.slice().sort((a,b)=>a.done-b.done);
    box.innerHTML = sorted.map(i=>
      '<div class="item'+(i.done?" done":"")+'">'
      + '<button class="check'+(i.done?" on":"")+'" data-li-tog="'+i.id+'">✓</button>'
      + '<div><div class="it-title">'+esc(i.name)+"</div>"
      + (i.qty ? '<div class="it-sub">'+esc(i.qty)+"</div>" : "") + "</div>"
      + '<div class="it-actions"><button type="button" class="linkbtn act del" data-li-del="'+i.id+'" title="Löschen">'+ICON_TRASH+'</button></div>'
      + "</div>").join("");
  }
}
var __el=document.getElementById("view-lists"); if(__el)__el.addEventListener("click", e=>{
  const lt = e.target.closest("[data-list]");
  if(lt){ curList = lt.dataset.list; renderLists(); return; }
  const tg = e.target.closest("[data-li-tog]");
  if(tg){
    const it = activeList().items.find(x=>x.id===tg.dataset.liTog);
    it.done = !it.done; save(); renderLists(); return;
  }
  const dl = e.target.closest("[data-li-del]");
  if(dl){
    const L = activeList();
    const rem = L.items.find(x=>x.id===dl.dataset.liDel);
    L.items = L.items.filter(x=>x.id!==dl.dataset.liDel);
    save(); renderLists();
    if(rem){
      showUndo('Eintrag gelöscht', function(){
        activeList().items.push(rem);
        save(); renderLists();
      });
    }
  }
});
function addItem(){
  const inp = document.getElementById("shopInput");
  const q = document.getElementById("shopQty");
  const name = inp.value.trim(); if(!name) return;
  activeList().items.push({id:uid(), name, qty:q.value.trim(), done:false});
  inp.value=""; q.value=""; save(); renderLists(); inp.focus();
}
document.getElementById("shopAdd").onclick = addItem;
document.getElementById("btnNewShopItem").onclick = ()=>document.getElementById("shopInput").focus();
var __el=document.getElementById("shopInput"); if(__el)__el.addEventListener("keydown", e=>{ if(e.key==="Enter") addItem(); });
var __el=document.getElementById("shopQty"); if(__el)__el.addEventListener("keydown", e=>{ if(e.key==="Enter") addItem(); });
document.getElementById("btnClearDone").onclick = ()=>{
  const L = activeList();
  L.items = L.items.filter(i=>!i.done); save(); renderLists();
};
document.getElementById("btnNewList").onclick = ()=>{
  document.getElementById("listName").value = ""; openModal("listModal");
  document.getElementById("listName").focus();
};
document.getElementById("listSave").onclick = ()=>{
  const n = document.getElementById("listName").value.trim();
  if(!n){ toast("Bitte einen Namen eingeben."); return; }
  const l = {id:uid(), name:n, items:[]};
  S.lists.push(l); curList = l.id;
  save(); closeModals(); renderLists(); toast("Liste angelegt.");
};

/* =========================================================
   Punkte & Belohnungen
   ========================================================= */
function addPoints(n, label){
  if(!n) return;
  S.points += n;
  S.history.unshift({id:uid(), label:label, pts:n, ts:Date.now()});
  S.history = S.history.slice(0,60);
}
function removePoints(n, label){
  if(!n) return;
  S.points = Math.max(0, S.points - n);
  S.history.unshift({id:uid(), label:"Rückgängig: "+label, pts:-n, ts:Date.now()});
  S.history = S.history.slice(0,60);
}
function renderPoints(){
  document.getElementById("pointsNum").textContent = S.points;
  const next = S.rewards.slice().sort((a,b)=>a.cost-b.cost).find(r=>r.cost>S.points);
  const bar = document.getElementById("nextRewardBar");
  const txt = document.getElementById("nextRewardTxt");
  if(next){
    bar.style.width = Math.min(100, Math.round(S.points/next.cost*100))+"%";
    txt.textContent = S.points+" von "+next.cost+" Punkten für „"+next.title+"“";
  }else if(S.rewards.length){
    bar.style.width = "100%";
    txt.textContent = "Alle Belohnungen frei! 🎉";
  }else{
    bar.style.width = "0%";
    txt.textContent = "Noch keine Belohnung angelegt.";
  }

  const rl = document.getElementById("rewardList");
  rl.innerHTML = S.rewards.length ? S.rewards.map(r=>{
    const can = S.points >= r.cost;
    return '<div class="reward"><div style="flex:1"><div class="it-title">'+esc(r.title)+"</div>"
      + '<div class="muted">'+r.cost+" Punkte</div></div>"
      + '<div class="cost">'+(can?"✓":"🔒")+"</div>"
      + '<button class="btn sm'+(can?" primary":"")+'" data-rw-use="'+r.id+'"'+(can?"":" disabled")+">Einlösen</button>"
      + '<button class="linkbtn del" data-rw-del="'+r.id+'">×</button></div>';
  }).join("") : '<div class="empty"><span class="big">🎁</span>Lege Belohnungen an, die ihr euch verdienen könnt.</div>';

  document.getElementById("histList").innerHTML = S.history.length
    ? S.history.map(h=>{
        const d = new Date(h.ts);
        return "<li><span><b>"+esc(h.label)+"</b><br>"+pad(d.getDate())+"."+pad(d.getMonth()+1)+"., "
             + pad(d.getHours())+":"+pad(d.getMinutes())+"</span>"
             + '<span class="'+(h.pts>=0?"pos":"neg")+'">'+(h.pts>=0?"+":"")+h.pts+"</span></li>";
      }).join("")
    : '<li style="border:0;color:var(--muted)">Noch keine Einträge.</li>';
}
var __el=document.getElementById("view-points"); if(__el)__el.addEventListener("click", e=>{
  const u = e.target.closest("[data-rw-use]");
  if(u){
    const r = S.rewards.find(x=>x.id===u.dataset.rwUse);
    if(r && S.points>=r.cost){
      S.points -= r.cost;
      S.history.unshift({id:uid(), label:"Eingelöst: "+r.title, pts:-r.cost, ts:Date.now()});
      save(); renderPoints(); toast("Belohnung eingelöst!");
    }
    return;
  }
  const d = e.target.closest("[data-rw-del]");
  if(d){
    S.rewards = S.rewards.filter(x=>x.id!==d.dataset.rwDel);
    save(); renderPoints();
  }
});
document.getElementById("btnNewReward").onclick = ()=>{
  document.getElementById("rwModalTitle").textContent = "Neue Belohnung";
  document.getElementById("rwTitle").value = "";
  document.getElementById("rwCost").value = 10;
  editingReward = null;
  document.getElementById("rwDelete").style.display = "none";
  openModal("rwModal"); document.getElementById("rwTitle").focus();
};
let editingReward = null;
document.getElementById("rwSave").onclick = ()=>{
  const t = document.getElementById("rwTitle").value.trim();
  const c = parseInt(document.getElementById("rwCost").value||"0",10);
  if(!t || c<1){ toast("Titel und Kosten angeben."); return; }
  if(editingReward) Object.assign(editingReward, {title:t, cost:c});
  else S.rewards.push({id:uid(), title:t, cost:c});
  save(); closeModals(); renderPoints(); toast("Belohnung gespeichert.");
};
document.getElementById("rwDelete").onclick = ()=>{
  if(!editingReward) return;
  S.rewards = S.rewards.filter(r=>r.id!==editingReward.id);
  save(); closeModals(); renderPoints();
};
document.getElementById("btnResetPoints").onclick = ()=>{
  if(!confirm("Verlauf und Punktestand zurücksetzen?")) return;
  S.points = 0; S.history = []; save(); renderPoints(); toast("Punkte zurückgesetzt.");
};

/* =========================================================
   Einstellungen
   ========================================================= */
function renderSettings(){
  document.getElementById("catList").innerHTML = S.categories.map((c,i)=>
    '<div class="cat-row">'
    + '<input type="color" value="'+c.color+'" data-cat-color="'+c.id+'" title="Farbe ändern">'
    + '<input type="text" class="grow" value="'+esc(c.name)+'" data-cat-name="'+c.id+'" placeholder="Name">'
    + '<button class="btn sm" data-cat-up="'+c.id+'" '+(i===0?"disabled":"")+">↑</button>"
    + '<button class="btn sm" data-cat-down="'+c.id+'" '+(i===S.categories.length-1?"disabled":"")+">↓</button>"
    + '<button class="btn sm danger" data-cat-del="'+c.id+'">×</button></div>'
  ).join("");
  document.getElementById("weekStart").value = String(S.settings.weekStart ?? 1);
  var pb=document.getElementById("paidBreakfastMin"); if(pb) pb.value = (S.settings && S.settings.paidBreakfastMin) || 0;
  var at=document.getElementById("appTitle");
  if(at) at.value = (S.settings && S.settings.appTitle) || "Familienkalender";
  var sm=document.getElementById("showMoon"); if(sm) sm.checked = !!(S.settings && S.settings.showMoon);
  var sz=document.getElementById("showZodiac"); if(sz) sz.checked = !!(S.settings && S.settings.showZodiac);
  if(S.settings && S.settings.appTitle){
    var t=(S.settings.appTitle||"").trim();
    document.title = t + " – Ordnung im Alltag ohne Abo";
    var bt=document.getElementById("brandTitle"); if(bt) bt.textContent=t;
  }
  save();
}
var __el=document.getElementById("view-settings"); if(__el)__el.addEventListener("change", e=>{
  const c = e.target.dataset.catColor;
  if(c){ cat(c).color = e.target.value; save(); renderSettings(); return; }
  const n = e.target.dataset.catName;
  if(n){ cat(n).name = e.target.value.trim() || "Ohne Name"; save(); renderSettings(); return; }
  if(e.target.id==="weekStart"){ S.settings.weekStart = Number(e.target.value); save(); renderSettings(); }
  if(e.target.id==="appTitle"){ if(!S.settings) S.settings={}; S.settings.appTitle = e.target.value.trim()||"Familienkalender"; save(); renderSettings(); }
  if(e.target.id==="paidBreakfastMin"){ if(!S.settings) S.settings={}; var v=parseInt(e.target.value)||0; if(v<0) v=0; S.settings.paidBreakfastMin=v; save(); renderSettings(); }
  if(e.target.id==="showMoon"){ if(!S.settings) S.settings={}; S.settings.showMoon=e.target.checked; save(); renderSettings(); renderCalendar(); }
  if(e.target.id==="showZodiac"){ if(!S.settings) S.settings={}; S.settings.showZodiac=e.target.checked; save(); renderSettings(); renderCalendar(); }
});
var __el=document.getElementById("view-settings"); if(__el)__el.addEventListener("click", e=>{
  const del = e.target.closest("[data-cat-del]");
  if(del){
    if(S.categories.length<=1){ toast("Mindestens ein Bereich nötig."); return; }
    if(!confirm("Bereich löschen? Termininhalte bleiben bestehen, ohne Farbe zugeteilt.")) return;
    S.categories = S.categories.filter(c=>c.id!==del.dataset.catDel);
    save(); renderSettings(); return;
  }
  const up = e.target.closest("[data-cat-up]");
  const down = e.target.closest("[data-cat-down]");
  if(up || down){
    const id = (up||down).dataset.catUp || (up||down).dataset.catDown;
    const i = S.categories.findIndex(c=>c.id===id);
    const j = up ? i-1 : i+1;
    if(j<0 || j>=S.categories.length) return;
    const tmp = S.categories[i]; S.categories[i]=S.categories[j]; S.categories[j]=tmp;
    save(); renderSettings();
  }
});
document.getElementById("catAdd").onclick = ()=>{
  const n = document.getElementById("catName").value.trim();
  if(!n){ toast("Bitte einen Namen eingeben."); return; }
  S.categories.push({id:uid(), name:n, color:document.getElementById("catColor").value});
  document.getElementById("catName").value = "";
  save(); renderSettings(); toast("Bereich hinzugefügt.");
};

/* Export / Import / Wipe */
function download(name, text, type){
  const blob = new Blob([text], {type: type||"application/json;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
}
document.getElementById("btnExportJson").onclick = ()=>{
  download("familienkalender-"+iso(today())+".json", JSON.stringify(S,null,2));
  toast("JSON-Backup erstellt.");
};
document.getElementById("btnExportCsv").onclick = ()=>{
  const head = ["Datum","Enddatum","Von","Bis","Ganztägig","Titel","Bereich","Notiz"];
  const rows = S.events.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(e=>[
    e.date, e.endDate||"", e.start||"", e.end||"", e.allDay?"ja":"nein", e.title, cat(e.cat).name, e.note||""
  ]);
  const csv = [head, ...rows].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(";")).join("\r\n");
  download("termine-"+iso(today())+".csv", "﻿"+csv, "text/csv;charset=utf-8");
  toast("CSV exportiert (Semikolon, für Excel).");
};
document.getElementById("btnImport").onclick = ()=>document.getElementById("fileImport").click();
document.getElementById("fileImport").onchange = e=>{
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const data = JSON.parse(r.result);
      if(!data || typeof data!=="object" || !Array.isArray(data.categories)) throw new Error("format");
      S = Object.assign(defaults(), data);
      if(!S.lists || !S.lists.length) S.lists = [{id:uid(), name:"Einkaufsliste", items:[]}];
      save(); curList = null; render(); toast("Backup importiert.");
    }catch(err){ toast("Import fehlgeschlagen – ungültige JSON-Datei."); }
  };
  r.readAsText(f);
  e.target.value = "";
};
document.getElementById("btnWipe").onclick = ()=>{
  if(!confirm("Wirklich alle Daten löschen? Das lässt sich nicht rückgängig machen.")) return;
  localStorage.removeItem(KEY);
  S = defaults();
  S.lists = [{id:uid(), name:"Einkaufsliste", items:[]}];
  save(); curList=null; calMonth=clone(today()); selDate=clone(today());
  render(); toast("Alle Daten gelöscht.");
};

/* =========================================================
   Modal-Verwaltung & Tastatur
   ========================================================= */
function openModal(id){ document.getElementById(id).classList.add("open"); }
function closeModals(){ document.querySelectorAll(".overlay").forEach(o=>o.classList.remove("open")); }
document.querySelectorAll(".overlay").forEach(o=>{
  o.addEventListener("click", e=>{
    if(e.target===o || e.target.closest("[data-close]")) closeModals();
  });
});
document.addEventListener("keydown", e=>{
  if(e.key==="Escape"){ if(copyEvId){ setCopyEv(null); return; } closeModals(); return; }
  const inInput = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if(inInput) return;
  if(curView==="cal"){
    if(e.key==="ArrowLeft"){
      if(calMode==="day"){ selDate=addDays(selDate,-1); calMonth=new Date(selDate.getFullYear(),selDate.getMonth(),1); }
      else { calMonth.setMonth(calMonth.getMonth()-1); }
      renderCalendar();
    }
    if(e.key==="ArrowRight"){
      if(calMode==="day"){ selDate=addDays(selDate,1); calMonth=new Date(selDate.getFullYear(),selDate.getMonth(),1); }
      else { calMonth.setMonth(calMonth.getMonth()+1); }
      renderCalendar();
    }
    if(e.key.toLowerCase()==="t"){ calMonth=clone(today()); selDate=clone(today()); renderCalendar(); }
    if(e.key.toLowerCase()==="n"){ openEvent(null, iso(selDate)); }
  }
});

/* =========================================================
   Uhr, Mond, Sternzeichen
   ========================================================= */
/* WORK */
function wkPad(n){return String(n).padStart(2,"0");}
function wkIsoKey(d){return d.getFullYear()+"-"+wkPad(d.getMonth()+1)+"-"+wkPad(d.getDate());}
function wkTodayKey(){return wkIsoKey(new Date());}
function workArr(k){if(typeof S==="undefined")window.S={work:{}};if(!S.work)S.work={};if(!S.work[k])S.work[k]=[];return S.work[k];}
function dayMarkerType(x){ if(!x) return ""; if(x.free===true || x.type==="free") return "free"; if(x.type==="vacation") return "vacation"; if(x.type==="sick") return "sick"; return ""; }
function dayTypeLabel(t){ return t==="free" ? "Freizeittag" : t==="vacation" ? "Urlaubstag" : t==="sick" ? "Krankheitstag" : ""; }
function workDayType(k){ var a=(S&&S.work&&S.work[k])||[]; return (a.length===1) ? dayMarkerType(a[0]) : ""; }
function workOpenInterval(k){var a=(S&&S.work&&S.work[k])||[];for(var i=a.length-1;i>=0;i--){if(a[i]&&!dayMarkerType(a[i])&&a[i].s&&!a[i].e)return a[i];}return null;}
function workRunningToday(){return !!workOpenInterval(wkTodayKey());}
function hmToMin(hm){if(!hm)return 0;var p=hm.split(":");return parseInt(p[0])*60+parseInt(p[1]);}
function minToHM(min){var s=min<0?"-":"";var m=Math.abs(min);var h=Math.floor(m/60),mm=m%60;return s+h+":"+String(mm).padStart(2,"0");}
function minToDec(min){return (Math.round((min/60)*100)/100).toFixed(2);}
function workCalcDay(k,ref){if(typeof S==="undefined")window.S={work:{}};if(!S.work)S.work={};var a=S.work[k]||[];var __dt=workDayType(k);if(__dt){if(__dt==="free")return {anwesMin:0,pauseMinBooked:0,arbeitsMin:0,sollMin:456,saldoMin:-456,free:true,dayType:"free"};return {anwesMin:0,pauseMinBooked:0,arbeitsMin:0,sollMin:0,saldoMin:0,dayType:__dt};}var now=ref||new Date();var nk=wkTodayKey();var paidB=0;try{if(S.settings && S.settings.paidBreakfastMin) paidB=parseInt(S.settings.paidBreakfastMin)||0;}catch(e){}
  // build pairs
  var pairs=[];for(var i=0;i<a.length;i++){var it=a[i];if(!it||!it.s)continue;var sm=hmToMin(it.s),em;if(it.e)em=hmToMin(it.e);else em=(k===nk)?(now.getHours()*60+now.getMinutes()):(23*60+59);if(em>=sm)pairs.push({s:sm,e:em});}pairs.sort(function(x,y){return x.s-y.s});
  // Arbeitszeit netto = sum of intervals
  var arbNetto=0;for(var i=0;i<pairs.length;i++) arbNetto+=pairs[i].e-pairs[i].s;
  // Anwesenheit (presence) = last Geht - first Kommt (over all intervals)
  var anwesPres=0;if(pairs.length){var first=pairs[0].s,last=pairs[pairs.length-1].e;if(last<first)last+=24*60;anwesPres=last-first;}
  // Pausen = gaps between intervals
  var pauseGebucht=0;for(var i=1;i<pairs.length;i++){var g=pairs[i].s-pairs[i-1].e;if(g>0)pauseGebucht+=g;}
  var pauseAbzug = 0;
  if(pairs.length==1){
    var worked = anwesPres - pauseGebucht;
    if(worked>360 && worked<=540){
      pauseAbzug = 30;
    } else if(worked>540){
      pauseAbzug = Math.max(0, 45 - paidB);
    } else {
      pauseAbzug = 0;
    }
  } else {
    var minPause2=0;if(anwesPres>360 && anwesPres<=540){minPause2=30;}if(anwesPres>540){minPause2=45;}
    var erforderlichePause2 = Math.max(0, minPause2 - paidB);
    pauseAbzug = Math.max(pauseGebucht, erforderlichePause2);
  }
  var arbeitsZeit = anwesPres - pauseAbzug;
  if(arbeitsZeit < 0) arbeitsZeit = 0;
  // Saldo based on effective Arbeitszeit vs Soll
  return {anwesMin:anwesPres,pauseMinBooked:pauseAbzug,arbeitsMin:arbeitsZeit,sollMin:456,saldoMin:arbeitsZeit-456};}
function fmtSecHMS(sec){var s=Math.max(0,Math.floor(sec||0));var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return wkPad(h)+":"+wkPad(m)+":"+wkPad(ss);}
function fmtHHMM(h,m){return wkPad(h)+":"+wkPad(m);}
function workToggle(){var nk=wkTodayKey();var a=workArr(nk);var o=workOpenInterval(nk);var now=new Date();var ts=wkPad(now.getHours())+":"+wkPad(now.getMinutes());if(o){o.e=ts;}else{for(var i=a.length-1;i>=0;i--){if(a[i]&&dayMarkerType(a[i]))a.splice(i,1);}a.push({s:ts,e:null});}try{save();renderWork();updateWorkLive();render();}catch(e){}}
function workSet(id,val){var el=document.getElementById(id); if(el) el.textContent=val;}
function workRunningSec(){
  var c=workCalcDay(wkTodayKey()), o=workOpenInterval(wkTodayKey());
  return c.arbeitsMin*60 + (o ? new Date().getSeconds() : 0);
}
function renderWorkHead(){
  if(typeof S==="undefined") window.S={work:{}};
  if(!S.work) S.work={};
  var nk=wkTodayKey(), c=workCalcDay(nk), o=workOpenInterval(nk);
  workSet("workNow", fmtSecHMS(o ? workRunningSec() : c.arbeitsMin*60));
  workSet("workState", o ? "Läuft seit "+o.s : "Nicht gestartet");
  var wsEl=document.getElementById("workState");
  if(wsEl) wsEl.classList.toggle("live", !!o);
  var wt=document.getElementById("workToggle");
  if(wt){ wt.textContent = o ? "Stopp" : "Start"; wt.onclick = workToggle; }
  workSet("workStatAnw", minToHM(c.anwesMin));
  workSet("workStatPause", minToHM(c.pauseMinBooked));
  workSet("workStatArb", minToHM(c.arbeitsMin));
  workSet("workStatSoll", minToHM(c.sollMin));
  workSet("workStatSaldo", (c.saldoMin>0?"+":"")+minToHM(c.saldoMin));
  var sd=document.getElementById("workStatSaldo");
  if(sd){ sd.classList.toggle("pos", c.saldoMin>0); sd.classList.toggle("neg", c.saldoMin<0); }
  var chip=document.getElementById("workChip");
  if(chip){
    chip.innerHTML = "⏱️ <b>"+minToHM(c.arbeitsMin)+"</b>";
    chip.title = "Arbeitszeit heute – netto "+minToHM(c.arbeitsMin)+(o?" (laufend)":"");
  }
  var wl=document.getElementById("calWorkLive");
  if(wl){
    wl.style.display = o ? "inline-flex" : "none";
    if(o){
      workSet("calWorkLiveTime", fmtSecHMS(workRunningSec()));
      wl.title = "Arbeitszeit läuft seit "+o.s+" – öffnen";
    }
  }
  var ws=document.getElementById("calWorkSaldo");
  var wsv=document.getElementById("calWorkSaldoVal");
  if(ws && wsv){
    var wday=new Date().getDay();
    var isWeekend=(wday===0 || wday===6);
    var saldo=c.saldoMin;
    wsv.textContent = (saldo>=0?"+":"") + minToHM(saldo);
    ws.style.display = isWeekend ? "none" : "inline-flex";
    ws.classList.toggle("neg", saldo<0);
    ws.classList.toggle("pos", saldo>0);
    wsv.style.color = saldo<0 ? "#fca5a5" : saldo>0 ? "#86efac" : "#e2e8f0";
  }
}
var __wlBtn=document.getElementById("calWorkLive");
if(__wlBtn) __wlBtn.onclick=function(){ setView("work"); };
function updateWorkLive(){ renderWorkHead(); }
function renderWork(){
  if(typeof S==="undefined") window.S={work:{}};
  if(!S.work) S.work={};
  var nk=wkTodayKey();
  renderWorkHead();
  var box=document.getElementById("workTodayList");
  if(box){
    var arr=S.work[nk]||[];
    if(!arr.length){
      box.innerHTML='<div class="empty"><span class="big">⏱️</span>Keine Einträge heute.</div>';
    }else{
      var rev=arr.map(function(it,idx){return {it:it,idx:idx};}).reverse();
      box.innerHTML=rev.map(function(x){
        var dm=dayMarkerType(x.it);
        if(dm){
          return '<div class="item">'
            +'<div><div class="it-title">'+esc(dayTypeLabel(dm))+'</div>'
            +'<div class="it-sub">'+(dm==="free"?"−7:36 · Saldo":"ausgeglichen · Saldo 0:00")+'</div></div>'
            +'<div class="it-actions">'
            +'<button type="button" class="menu-toggle" title="Aktionen" aria-label="Aktionen">'+ICON_MORE+'</button>'
            +'<button type="button" class="btn sm act" data-wk-edit="'+x.idx+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
            +'<button type="button" class="btn sm act" data-wk-del="'+x.idx+'" title="Löschen">'+ICON_TRASH+'</button></div>'
            +'</div>';
        }
        var dur=x.it.e ? 'Dauer '+minToHM(hmToMin(x.it.e)-hmToMin(x.it.s))+' · Ind. '+minToDec(hmToMin(x.it.e)-hmToMin(x.it.s)) : 'Läuft …';
        return '<div class="item">'
          +'<div><div class="it-title">Komm '+esc(x.it.s)+(x.it.e?' · Geht '+esc(x.it.e):' · offen')+'</div>'
          +'<div class="it-sub">'+dur+'</div></div>'
          +'<div class="it-actions">'
          +'<button type="button" class="menu-toggle" title="Aktionen" aria-label="Aktionen">'+ICON_MORE+'</button>'
          +'<button type="button" class="btn sm act" data-wk-edit="'+x.idx+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
          +'<button type="button" class="btn sm act" data-wk-del="'+x.idx+'" title="Löschen">'+ICON_TRASH+'</button></div>'
          +'</div>';
      }).join('');
    }
  }
  var hist=document.getElementById("workHistory");
  if(hist){
var mEl=document.getElementById("workHistMonth");
if(mEl){
  if(!mEl.value){
    var t=today();
    mEl.value = String(t.getFullYear())+"-"+pad(t.getMonth()+1);
  }
  if(!mEl.dataset.init) mEl.dataset.init="1";
}
var period=parseHistMonth((mEl&&mEl.value)||"");
    var mInfo=document.getElementById("workHistMonthInfo");
    if(mInfo){
      if(period===null) mInfo.textContent="Ungültig – bitte MM.JJ (z. B. 09.26)";
      else if(period==="") mInfo.textContent="";
      else mInfo.textContent=MONTHS[parseInt(period.slice(5,7),10)-1]+" '"+period.slice(2,4);
    }
    if(period===null){
      hist.innerHTML='<div class="empty">Ungültiger Zeitraum. Bitte Format MM.JJ (z. B. 09.26).</div>';
    }else{
    var keys=Object.keys(S.work).sort().reverse();
    if(period) keys=keys.filter(function(k){ return k.slice(0,7)===period; });
    var qEl=document.getElementById("workHistSearch");
    var q=((qEl&&qEl.value)||"").toString().trim().toLowerCase();
    if(!keys.length){
      hist.innerHTML='<div class="empty">'+(period?'Keine Einträge im '+MONTHS[parseInt(period.slice(5,7),10)-1]+" '"+period.slice(2,4)+'.':'Keine Einträge.')+'</div>';
    }else{
      var items=keys.map(function(k){
        var c2=workCalcDay(k,new Date(k+"T23:59:59"));
        var saldo=(c2.saldoMin>0?"+":"")+minToHM(c2.saldoMin);
        var sub = c2.dayType
          ? esc(dayTypeLabel(c2.dayType))+' · '+(c2.dayType==="free"?'Saldo <b class="neg">'+saldo+'</b>':'ausgeglichen · Saldo 0:00')
          : 'Anw. '+minToHM(c2.anwesMin)+' · Pause '+minToHM(c2.pauseMinBooked)
            +' · Arb. '+minToHM(c2.arbeitsMin)+' · Ind. '+minToDec(c2.arbeitsMin)
            +' · Saldo <b class="'+(c2.saldoMin<0?"neg":"pos")+'">'+saldo+'</b>';
        var dmy=k.split("-").reverse().join(".");
        var dmLabel=dayTypeLabel(c2.dayType)||"Arbeitstag";
        var hay=(dmy+" "+k+" "+dmLabel+" "+sub).toLowerCase();
        return {k:k,sub:sub,dmy:dmy,hay:hay};
      });
      if(q) items=items.filter(function(it){ return it.hay.indexOf(q)!==-1; });
      if(!items.length){
        hist.innerHTML='<div class="empty">Keine Treffer'+(q?' für „'+esc(q)+'“':'')+'.</div>';
      }else{
        hist.innerHTML=items.map(function(it){
          return '<div class="item">'
            +'<div><div class="it-title">'+esc(it.dmy)+'</div>'
            +'<div class="it-sub">'+it.sub+'</div></div>'
            +'<div class="it-actions">'
            +'<button type="button" class="menu-toggle" title="Aktionen" aria-label="Aktionen">'+ICON_MORE+'</button>'
            +'<button type="button" class="btn sm act" data-wk-editday="'+esc(it.k)+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
            +'<button type="button" class="btn sm act del" data-wk-delall="'+esc(it.k)+'" title="Löschen">'+ICON_TRASH+'</button></div>'
            +'</div>';
        }).join('');
      }
    }
    }
  }
}
/* ---- Arbeitstag bearbeiten (Komm/Geht) ---- */
function parseHistMonth(str){
  if(str==null) return "";
  var s=String(str).trim();
  if(!s) return "";
  var m=s.match(/^(\d{4})-(\d{1,2})$/);
  if(m){
    var mm2=parseInt(m[2],10);
    if(mm2<1||mm2>12) return null;
    return m[1]+"-"+pad(mm2);
  }
  m=s.match(/^(\d{1,2})[.\/\-](\d{2}|\d{4})$/);
  if(m){
    var mm=parseInt(m[1],10);
    if(mm<1||mm>12) return null;
    var yy=m[2].length===2 ? "20"+m[2] : m[2];
    return yy+"-"+pad(mm);
  }
  m=s.match(/^(\d{4})[.\/\-](\d{1,2})$/);
  if(m){
    var mm2=parseInt(m[2],10);
    if(mm2<1||mm2>12) return null;
    return m[1]+"-"+pad(mm2);
  }
  return null;
}
let wkEditKey = null;
let wkDraft = [];
function syncWkDraft(){
  var rows=document.querySelectorAll("#wkRows .wk-row");
  for(var i=0;i<rows.length && i<wkDraft.length;i++){
    var s=rows[i].querySelector(".wk-s"), e=rows[i].querySelector(".wk-e");
    if(s) wkDraft[i].s=s.value;
    if(e) wkDraft[i].e=e.value;
  }
}
function renderWkRows(){
  var box=document.getElementById("wkRows"); if(!box) return;
  box.innerHTML=wkDraft.map(function(r,i){
    return '<div class="wk-row">'
      +'<div class="field"><label class="fl">Komm</label><div class="time-wrap">'
      +'<input type="time" class="wk-s" id="wkS'+i+'" value="'+esc(r.s||"")+'">'
      +'<button type="button" class="time-pick" data-timefor="wkS'+i+'" title="Uhrzeit wählen">🕒</button></div></div>'
      +'<div class="field"><label class="fl">Geht</label><div class="time-wrap">'
      +'<input type="time" class="wk-e" id="wkE'+i+'" value="'+esc(r.e||"")+'">'
      +'<button type="button" class="time-pick" data-timefor="wkE'+i+'" title="Uhrzeit wählen">🕒</button></div></div>'
      +'<button type="button" class="btn sm del wk-rowdel" data-wk-rowdel="'+i+'" title="Zeitraum entfernen">'+ICON_TRASH+'</button>'
      +'</div>';
  }).join("");
}
function wkDayTypeSelected(){
  var r=document.querySelector('input[name="wkDayType"]:checked');
  return r ? r.value : "normal";
}
function setWkDayType(t){
  var r=document.querySelector('input[name="wkDayType"][value="'+(t||"normal")+'"]');
  if(r) r.checked = true;
}
function updateWkFreeUI(){ var w=document.getElementById("wkTimeWrap"); if(w) w.style.display = (wkDayTypeSelected()!=="normal") ? "none" : ""; }
function openWorkDay(k){
  wkEditKey = k;
  var arr0 = workArr(k)||[];
  wkDraft = arr0.filter(function(x){ return !dayMarkerType(x); }).map(function(x){ return {s:x.s||"", e:x.e||""}; });
  if(!wkDraft.length) wkDraft=[{s:"",e:""}];
  renderWkRows();
  setWkDayType(workDayType(k) || "normal");
  updateWkFreeUI();
  document.getElementById("wkModalTitle").textContent = "Arbeitstag "+k.split("-").reverse().join(".")+(k===wkTodayKey()?" (heute)":"");
  openModal("wkModal");
}
document.querySelectorAll('input[name="wkDayType"]').forEach(function(r){ r.onchange = updateWkFreeUI; });
document.getElementById("wkAdd").onclick = function(){
  syncWkDraft();
  wkDraft.push({s:"",e:""});
  renderWkRows();
  var rows=document.querySelectorAll("#wkRows .wk-s");
  if(rows.length) rows[rows.length-1].focus();
};
document.getElementById("wkSave").onclick = function(){
  var dtype=wkDayTypeSelected();
  if(dtype!=="normal"){
    var arr=workArr(wkEditKey); arr.length=0; arr.push({type:dtype});
    save(); closeModals(); renderWork(); render();
    toast(dayTypeLabel(dtype)+" gespeichert"+(dtype==="free"?" (−7:36).":" (ausgeglichen)."));
    return;
  }
  syncWkDraft();
  var rows=wkDraft.filter(function(r){ return r.s; });
  if(!rows.length){ toast("Bitte eine Komm-Zeit eintragen."); return; }
  for(var i=0;i<rows.length;i++){
    if(rows[i].e && hmToMin(rows[i].e)<=hmToMin(rows[i].s)){
      toast("„Geht“ muss nach „Komm“ liegen."); return;
    }
  }
  var openRows=rows.filter(function(r){ return !r.e; });
  if(openRows.length>1){ toast("Nur ein offener Zeitraum ist erlaubt."); return; }
  if(openRows.length && wkEditKey!==wkTodayKey()){
    toast("Ein offener Zeitraum kann nur für heute angelegt werden."); return;
  }
  workArr(wkEditKey).length = 0;
  rows.forEach(function(r){ workArr(wkEditKey).push({s:r.s, e:r.e||null}); });
  save(); closeModals(); renderWork(); render();
  toast("Arbeitszeit neu berechnet.");
};
/* WORK-END */

/* ---- Fälligkeits-Erinnerungen ---- */
var REMIND_GRACE_MIN = 30;
var REMIND_ALLDAY_TIME = "08:00";
var lastRemindCheck = null;
var lastRemindPrune = 0;
function remindMoment(dateStr, timeStr){
  if(!dateStr) return null;
  var d = parseISO(dateStr);
  var p = (timeStr || REMIND_ALLDAY_TIME).split(":");
  d.setHours(parseInt(p[0],10)||0, parseInt(p[1],10)||0, 0, 0);
  return d;
}
function eventRemindMoment(e){
  if(!e || !e.date || e.done) return null;
  return remindMoment(e.date, e.allDay ? REMIND_ALLDAY_TIME : (e.start || REMIND_ALLDAY_TIME));
}
function taskRemindMoment(t){
  if(!t || taskIsDone(t)) return null;
  var d = taskDate(t); if(!d) return null;
  return remindMoment(d, t.allDay ? REMIND_ALLDAY_TIME : (t.startTime || REMIND_ALLDAY_TIME));
}
function pruneReminded(now){
  if(now.getTime() - lastRemindPrune < 6*3600000) return;
  lastRemindPrune = now.getTime();
  var c = new Date(now.getTime()); c.setDate(c.getDate()-3);
  var cutoff = c.getFullYear()+"-"+pad(c.getMonth()+1)+"-"+pad(c.getDate());
  Object.keys(S.reminded).forEach(function(k){ var d=(k.split("@")[1]||"").slice(0,10); if(d && d < cutoff) delete S.reminded[k]; });
}
function checkReminders(){
  if(typeof S==="undefined" || !S) return;
  if(!S.reminded) S.reminded = {};
  var now = new Date();
  pruneReminded(now);
  var low = lastRemindCheck || new Date(now.getTime() - REMIND_GRACE_MIN*60000);
  var due = [];
  function consider(kind, id, title, moment, when){
    if(!moment) return;
    if(moment > low && moment <= now){
      var key = id + "@" + iso(moment) + "T" + pad(moment.getHours()) + ":" + pad(moment.getMinutes());
      if(!S.reminded[key]){
        S.reminded[key] = 1;
        due.push({kind:kind, uid:id, title:title, moment:moment, when:when});
      }
    }
  }
  (S.events||[]).forEach(function(e){
    if(!inProfile(e.cat)) return;
    consider("Termin", "ev:"+e.id, e.title||"", eventRemindMoment(e), (e.allDay ? "ganztägig" : (e.start||"")));
  });
  (S.todos||[]).forEach(function(t){
    if(!inProfile(t.cat)) return;
    consider("Aufgabe", "td:"+t.id, t.title||"", taskRemindMoment(t), (t.allDay ? "ganztägig" : (t.startTime||"")));
  });
  lastRemindCheck = now;
  if(due.length){ try{ save(); }catch(e){} showReminder(due); }
}
function toggleEventDone(id, done){
  var e = S.events.find(function(x){ return x.id===id; });
  if(!e) return;
  if(done) e.done = true; else delete e.done;
  try{ save(); }catch(err){}
  try{ render(); }catch(err){}
}
function showReminder(items){
  var body = document.getElementById("remindBody");
  if(!body) return;
  body.innerHTML = items.map(function(it){
    var ico = it.kind==="Termin" ? "📅" : "✅";
    var when = it.when==="ganztägig" ? "ganztägig"
      : pad(it.moment.getHours())+":"+pad(it.moment.getMinutes());
    var head = '<label class="rm-chk"><input type="checkbox" data-rem-done="'+esc(it.uid)+'">'
      + '<span>'+ico+' <b>'+esc(it.title)+'</b> <span class="muted">· '+it.kind+' · '+when+'</span></span></label>';
    var extra = "";
    var ev = it.kind==="Termin" ? S.events.find(function(x){ return "ev:"+x.id===it.uid; }) : null;
    if(ev){
      var dt = ev.date+"T"+(ev.allDay?REMIND_ALLDAY_TIME:(ev.start||REMIND_ALLDAY_TIME));
      extra = '<div class="rm-when"><span class="rm-lbl">Neue Startzeit</span>'
        + '<input type="datetime-local" data-rem-dt="'+esc(it.uid)+'" value="'+esc(dt)+'">'
        + '<button type="button" class="btn sm" data-rem-move="'+esc(it.uid)+'">Verschieben</button>'
        + '<button type="button" class="btn sm ghost" data-rem-today="'+esc(it.uid)+'">+1 Std</button></div>';
    }
    return '<div class="rm-item">'+head+extra+'</div>';
  }).join("");
  openModal("remindModal");
}
function localDT(d){
  return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+"T"+pad(d.getHours())+":"+pad(d.getMinutes());
}
var __remindBody=document.getElementById("remindBody");
if(__remindBody){
  __remindBody.addEventListener("change", function(ev){
    var c=ev.target.closest && ev.target.closest("[data-rem-done]");
    if(!c) return;
    var uid=c.getAttribute("data-rem-done"), on=!!c.checked;
    if(uid.indexOf("ev:")===0) toggleEventDone(uid.slice(3), on);
    else if(uid.indexOf("td:")===0){ var t=S.todos.find(function(x){ return x.id===uid.slice(3); }); if(t){ setTaskDone(t, on); try{save();}catch(err){} try{render();}catch(err){} } }
    var item=c.closest(".rm-item"); if(item) item.classList.toggle("done", on);
  });
  __remindBody.addEventListener("click", function(ev){
    var td=ev.target.closest && ev.target.closest("[data-rem-today]");
    if(td){
      var inp=__remindBody.querySelector('[data-rem-dt="'+td.getAttribute("data-rem-today")+'"]');
      if(inp) inp.value = localDT(new Date(Date.now()+3600000));
      return;
    }
    var mv=ev.target.closest && ev.target.closest("[data-rem-move]");
    if(!mv) return;
    var uid=mv.getAttribute("data-rem-move");
    var dtEl=__remindBody.querySelector('[data-rem-dt="'+uid+'"]');
    var e=S.events.find(function(x){ return "ev:"+x.id===uid; });
    if(!e || !dtEl || !dtEl.value) return;
    var m=dtEl.value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if(!m){ toast("Bitte eine gültige Startzeit wählen."); return; }
    var nd=new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5], 0, 0);
    if(nd.getTime() <= Date.now()){ toast("Bitte eine Zeit in der Zukunft wählen."); return; }
    var newDate=m[1]+"-"+m[2]+"-"+m[3], newTime=m[4]+":"+m[5];
    if(e.endDate){
      var delta=Math.round((parseISO(newDate)-parseISO(e.date))/86400000);
      e.endDate=iso(addDays(parseISO(e.endDate), delta));
    }
    e.date=newDate;
    if(!e.allDay) e.start=newTime;
    Object.keys(S.reminded).forEach(function(k){ if(k.indexOf("ev:"+e.id+"@")===0) delete S.reminded[k]; });
    try{ save(); }catch(err){}
    try{ render(); }catch(err){}
    var item=mv.closest(".rm-item"); if(item) item.classList.add("done");
    toast(e.allDay ? "Termin auf "+newDate.split("-").reverse().join(".")+" verschoben."
                   : "Termin auf "+newTime+" verschoben.");
  });
}
var __remindOk=document.getElementById("remindOk");
if(__remindOk) __remindOk.onclick = function(){ var m=document.getElementById("remindModal"); if(m) m.classList.remove("open"); };
function tick(){
  const now = new Date();
  document.getElementById("clockChip").innerHTML =
    "<b>"+pad(now.getHours())+":"+pad(now.getMinutes())+":"+pad(now.getSeconds())+"</b>&nbsp; "
    + DOW_FULL[now.getDay()].slice(0,2) + ". " + now.getDate() + ". " + MONTHS[now.getMonth()].slice(0,3);
  try{ if(typeof updateWorkLive==="function") updateWorkLive(); }catch(e){}
  try{ checkReminders(); }catch(e){}
}
setInterval(tick, 1000); tick();

/* Init */
render();


function taskIsDone(t){
  if(!t.repeat || t.repeat==="none") return !!t.done;
  if(!t.lastDone) return false;
  const d = parseISO(t.lastDone);
  const n = today();
  if(t.repeat==="daily") return sameDay(d,n);
  if(t.repeat==="weekly") return d >= startOfWeek(n) && d <= addDays(startOfWeek(n),6);
  if(t.repeat==="monthly") return d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear();
  if(t.repeat==="quarterly") return Math.floor(d.getMonth()/3)===Math.floor(n.getMonth()/3) && d.getFullYear()===n.getFullYear();
  if(t.repeat==="yearly") return d.getFullYear()===n.getFullYear();
  return !!t.lastDone;
}
function routineIsDone(r){
  if(!r) return false;
  return taskIsDone(Object.assign({}, r, {repeat: r.freq || r.repeat || "none"}));
}
function repLabel(r){
  return r==="daily"?"Täglich":r==="weekly"?"Wöchentlich":r==="monthly"?"Monatlich":r==="quarterly"?"Vierteljährlich":r==="yearly"?"Jährlich":"";
}
function nextDue(t){
  if(!t.repeat||t.repeat==="none") return null;
  var base=t.lastDone?parseISO(t.lastDone):(taskDate(t)?parseISO(taskDate(t)):today());
  var d=clone(base);
  if(t.repeat==="daily") d=addDays(d,1);
  else if(t.repeat==="weekly") d=addDays(d,7);
  else if(t.repeat==="monthly") d=new Date(d.getFullYear(),d.getMonth()+1,d.getDate());
  else if(t.repeat==="quarterly") d=new Date(d.getFullYear(),d.getMonth()+3,d.getDate());
  else if(t.repeat==="yearly") d=new Date(d.getFullYear()+1,d.getMonth(),d.getDate());
  return d;
}
function fmtDate(d){ return pad(d.getDate())+"."+pad(d.getMonth()+1)+"."; }
function fmtCompletedAt(s){
  if(!s) return "";
  var d=new Date(s);
  if(isNaN(d.getTime())) return "";
  return "✓ "+pad(d.getDate())+"."+pad(d.getMonth()+1)+"."+String(d.getFullYear()).slice(-2)+" "+pad(d.getHours())+":"+pad(d.getMinutes());
}
function dueDateTime(t){
  var date = (t && (t.endDate || t.startDate || t.due)) ? (t.endDate || t.startDate || t.due) : "";
  if(!date) return null;
  var d=parseISO(date);
  var tim = (t && !t.allDay) ? (t.endTime || t.startTime || t.dueTime || "") : "";
  if(tim){
    var p=String(tim).split(":");
    d.setHours(parseInt(p[0],10)||0, parseInt(p[1],10)||0, 0, 0);
  } else {
    d.setHours(23,59,59,999);
  }
  return d;
}
function isTaskOverdue(t){
  if(!t||!(t.startDate||t.endDate||t.due)) return false;
  if(typeof taskIsDone==="function" && taskIsDone(t)) return false;
  var dt=dueDateTime(t);
  return dt ? dt < new Date() : false;
}
function spanTxt(t){
  if(!t || !t.startDate) return "";
  var a=t.startDate.split("-").reverse().join(".");
  var out = (t.endDate && t.endDate > t.startDate) ? a+" – "+t.endDate.split("-").reverse().join(".") : a;
  if(t.startTime || t.endTime) out += " "+(t.startTime||"")+(t.endTime?"–"+t.endTime:"");
  return out;
}
function fmtDue(t,done){
  if(!t || !taskDate(t)) return "";
  var od = !done && isTaskOverdue(t);
  var col = od ? "#f87171" : "#cbd5e1";
  var prefix = od ? "überfällig " : "";
  return '<span style="color:'+col+'">🗓 '+esc(prefix+spanTxt(t))+"</span>";
}
function updateTaskBadge(){ try{ var b=document.getElementById('todoBadge'); if(!b) return; var n=0; if(typeof S!=="undefined"&&S&&Array.isArray(S.todos)) n=S.todos.filter(function(t){return inProfile(t.cat) && !taskIsDone(t)}).length; b.textContent=n; b.style.display=n?"grid":"none"; }catch(e){} }
function renderTasks(){
  try{
    if(typeof S==="undefined"||!S) S=defaults();
    if(!Array.isArray(S.todos)) S.todos=[];
    var list=document.getElementById('tasksList'); if(!list) return;
    var search=((document.getElementById('taskSearch')||{}).value||"").trim().toLowerCase();
    var filter="all"; var seg=document.getElementById("taskSeg"); if(seg){ var ab=seg.querySelector(".segbtn.active"); if(ab) filter=ab.dataset.seg||"all"; } else { var f=(document.getElementById("taskFilter")||{}).value||"all"; filter=f; }
    var items=S.todos.filter(function(t){
      if(!inProfile(t.cat)) return false;
      var done=taskIsDone(t);
      if(filter==="open" && done) return false;
      if(filter==="done" && !done) return false;
      if(search && String(t.title||t.text||"").toLowerCase().indexOf(search)<0) return false;
      return true;
    });
    items.sort(function(a,b){
      var da=taskDate(a)?parseISO(taskDate(a)).getTime():Number.POSITIVE_INFINITY;
      var db=taskDate(b)?parseISO(taskDate(b)).getTime():Number.POSITIVE_INFINITY;
      if(da!==db) return da-db;
      var tma=taskStartTime(a)||"99:99", tmb=taskStartTime(b)||"99:99";
      if(tma!==tmb) return tma<tmb?-1:1;
      var ta=a.title||""; var tb=b.title||""; if(ta<tb) return -1; if(ta>tb) return 1; return 0;
    });
    if(!items.length){ list.innerHTML='<div class="empty"><span class="big">🗒️</span>Keine Aufgaben vorhanden.</div>'; }
    else {
      var groups={ueberfaellig:[],heute:[],demnaechst:[],ohne:[],erledigt:[]};
      var td=today();
      items.forEach(function(t){
        var done=taskIsDone(t);
        if(done){ groups.erledigt.push(t); return; }
        var tdat=taskDate(t);
        if(!tdat){ groups.ohne.push(t); return; }
        if(isTaskOverdue(t)){ groups.ueberfaellig.push(t); return; }
        var d=parseISO(tdat);
        if(sameDay(d,td)){ groups.heute.push(t); return; }
        groups.demnaechst.push(t);
      });
      var html="";
      function renderGroup(title,arr){
        if(!arr.length) return "";
        var out='<div class="tgroup">'+esc(title)+" ("+arr.length+")</div>";
        out+=arr.map(function(t){
          var idx=S.todos.indexOf(t);
          var done=taskIsDone(t);
          var c=(typeof cat==="function")?cat(t.cat):{name:"",color:"#64748b"};
          var rep=repLabel(t.repeat);
          return '<div class="item'+(done?" done":"")+'">'
            + '<button class="check'+(done?" on":"")+'" data-task-toggle="'+idx+'">✓</button>'
            + '<div><div class="it-title">'+esc(t.title||t.text||"")+'</div>'
            + '<div class="it-sub"><span class="pill" style="background:'+c.color+'">'+esc(c.name)+'</span>'
            + (rep?'<span>↻ '+esc(rep)+'</span>':'')
            + fmtDue(t,done)
            + (t.completedAt?'<span>'+esc(fmtCompletedAt(t.completedAt))+'</span>':'')
            + (done&&t.repeat&&t.repeat!=="none"&&nextDue(t)?'<span style="color:#7dd3fc">↻ Nächste: '+esc(fmtDate(nextDue(t)))+'</span>':'')
            + (t.note?'<span> '+esc(t.note)+'</span>':'')+'</div></div>'
            + '<div class="it-actions"><button type="button" class="menu-toggle" title="Aktionen" aria-label="Aktionen">'+ICON_MORE+'</button>'
            + '<button type="button" class="btn sm act" data-task-edit="'+idx+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
            + '<button type="button" class="btn sm act del" data-task-del="'+idx+'" title="Löschen">'+ICON_TRASH+'</button></div>'
            + '</div>';
        }).join("");
        return out;
      }
      html += renderGroup("Überfällig", groups.ueberfaellig);
      html += renderGroup("Heute", groups.heute);
      html += renderGroup("Demnächst", groups.demnaechst);
      html += renderGroup("Ohne Datum", groups.ohne);
      html += renderGroup("Erledigt", groups.erledigt);
      list.innerHTML=html;
    }
    updateTaskBadge();
    try{ if(typeof renderCalSide==="function") renderCalSide(); }catch(e){}
  }catch(e){}
}
function renderRoutines(){
  try{
    if(typeof S==="undefined"||!S) S=defaults();
    if(!Array.isArray(S.routines)) S.routines=[];
    try{ if(typeof renderCalSide==="function") renderCalSide(); }catch(e){}
    var list=document.getElementById('routinesList'); if(!list) return;
    var search=((document.getElementById('routineSearch')||{}).value||"").trim().toLowerCase();
    var rfilter="all"; var rseg=document.getElementById("routineSeg"); if(rseg){ var rab=rseg.querySelector(".segbtn.active"); if(rab) rfilter=rab.dataset.seg||"all"; }
    var items=S.routines.filter(function(r){
      if(!inProfile(r.cat)) return false;
      var rdone=routineIsDone(r);
      if(rfilter==="open" && rdone) return false;
      if(rfilter==="done" && !rdone) return false;
      if(search && String(r.name||r.title||"").toLowerCase().indexOf(search)<0) return false;
      return true;
    });
    if(!items.length){ list.innerHTML='<div class="empty"><span class="big">🗓️</span>Keine Routinen vorhanden.</div>'; }
    else {
      items.sort(function(a,b){
        var ad=routineIsDone(a), bd=routineIsDone(b);
        if(ad!==bd) return ad?1:-1;
        var ta=a.name||"", tb=b.name||""; if(ta<tb) return -1; if(ta>tb) return 1; return 0;
      });
      list.innerHTML=items.map(function(r){
        var i=S.routines.indexOf(r);
        var c=(typeof cat==="function")?cat(r.cat):null;
        var rep=repLabel(r.freq);
        var done=routineIsDone(r);
        return '<div class="item'+(done?' done':'')+'">'
          +'<button type="button" class="check'+(done?' on':'')+'" data-routine-toggle="'+i+'" title="Erledigt abhaken">✓</button>'
          +'<div><div class="it-title">'+esc(r.name||'')+'</div><div class="it-sub">'
          +(c?'<span class="pill" style="background:'+c.color+'">'+esc(c.name)+'</span>':'')
          +(rep?'<span>↻ '+esc(rep)+'</span>':'')
          +(r.time&&r.time!=="any"?'<span>🕒 '+esc(r.time)+'</span>':'')
          +(done&&r.freq&&r.freq!=="none"&&nextDue(Object.assign({},r,{repeat:r.freq}))?'<span style="color:#7dd3fc">↻ Nächste: '+esc(fmtDate(nextDue(Object.assign({},r,{repeat:r.freq}))))+'</span>':'')
          +(done&&r.completedAt?'<span>'+esc(fmtCompletedAt(r.completedAt))+'</span>':'')
          +(r.note?'<span> '+esc(r.note)+'</span>':'')
          +'</div></div><div class="it-actions">'
          +'<button type="button" class="menu-toggle" title="Aktionen" aria-label="Aktionen">'+ICON_MORE+'</button>'
          +'<button type="button" class="btn sm act" data-routine-edit="'+i+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
          +'<button type="button" class="btn sm act del" data-routine-del="'+i+'" title="Löschen">'+ICON_TRASH+'</button></div></div>';
      }).join('');
    }
  }catch(e){}
  try{ updateBadges(); }catch(e){}
}
(function(){
  document.addEventListener('click', function(e){
    var t=e.target;
    if(t.closest&&t.closest('.menu-toggle')){
      var item=t.closest('.item');
      if(item){
        var was=item.classList.contains('menuopen');
        var all=document.querySelectorAll('.item.menuopen');
        for(var i2=0;i2<all.length;i2++) all[i2].classList.remove('menuopen');
        if(!was) item.classList.add('menuopen');
      }
      return;
    }
    if(t.closest&&t.closest('[data-task-edit]')){
      var idx=parseInt(t.closest('[data-task-edit]').getAttribute('data-task-edit'));
      if(!isNaN(idx)&&Array.isArray(S.todos)&&S.todos[idx]) openTodo(S.todos[idx].id, "task");
      return;
    }
    if(t.closest&&t.closest('[data-task-del]')){
      var idx=parseInt(t.closest('[data-task-del]').getAttribute('data-task-del'));
      if(!isNaN(idx)&&Array.isArray(S.todos)&&idx>=0&&idx<S.todos.length){
        var removed=S.todos.splice(idx,1)[0];
        save();
        showUndo('Aufgabe gelöscht', function(){
          var ri=Math.min(idx, S.todos.length);
          S.todos.splice(ri,0,removed);
          save(); renderTasks(); updateBadges();
          try{ if(typeof renderCalSide==="function") renderCalSide(); }catch(e){}
          try{ if(typeof renderCalendar==="function") renderCalendar(); }catch(e){}
        });
        renderTasks(); updateBadges();
        try{ if(typeof renderCalSide==="function") renderCalSide(); }catch(e){}
        try{ if(typeof renderCalendar==="function") renderCalendar(); }catch(e){}
      }
      return;
    }
    if(t.closest&&t.closest('[data-task-toggle]')){
      var ti=parseInt(t.closest('[data-task-toggle]').getAttribute('data-task-toggle'));
      if(!isNaN(ti)&&Array.isArray(S.todos)&&S.todos[ti]){
        var tk=S.todos[ti];
        if(tk.repeat&&tk.repeat!=="none"){
          var was=taskIsDone(tk);
          if(was){
            tk.lastDone=null;
            delete tk.completedAt;
            removePoints(tk.points||1, tk.title);
          } else {
            tk.lastDone=iso(today());
            var nowd=new Date(); tk.completedAt=nowd.toISOString();
            addPoints(tk.points||1, tk.title);
          }
        }
        else {
          var wasd=tk.done; tk.done=!tk.done;
          if(!wasd){
            var nowd2=new Date(); tk.completedAt=nowd2.toISOString();
            addPoints(tk.points||1, tk.title);
          } else {
            delete tk.completedAt;
            removePoints(tk.points||1, tk.title);
          }
        }
        save(); renderTasks(); updateBadges();
        try{ if(typeof renderCalendar==="function") renderCalendar(); }catch(e){}
      }
      return;
    }
    if(t.closest&&t.closest('[data-routine-edit]')){
      var ridx=parseInt(t.closest('[data-routine-edit]').getAttribute('data-routine-edit'));
      if(!isNaN(ridx)&&Array.isArray(S.routines)&&S.routines[ridx]) openTodo(ridx, "routine");
      return;
    }
    if(t.closest&&t.closest('[data-routine-toggle]')){
      var rti=parseInt(t.closest('[data-routine-toggle]').getAttribute('data-routine-toggle'));
      if(!isNaN(rti)&&Array.isArray(S.routines)&&S.routines[rti]){
        var rk=S.routines[rti];
        var rwas=routineIsDone(rk);
        if(!rk.freq || rk.freq==="none"){
          rk.done = !rk.done;
          if(rk.done){ rk.completedAt=new Date().toISOString(); addPoints(rk.points||1, rk.name||rk.title||""); }
          else { delete rk.completedAt; removePoints(rk.points||1, rk.name||rk.title||""); }
        } else if(rwas){
          rk.lastDone=null;
          delete rk.completedAt;
          removePoints(rk.points||1, rk.name||rk.title||"");
        } else {
          rk.lastDone=iso(today());
          rk.completedAt=new Date().toISOString();
          addPoints(rk.points||1, rk.name||rk.title||"");
        }
        save(); renderRoutines(); updateBadges();
        try{ if(typeof renderCalSide==="function") renderCalSide(); }catch(e){}
      }
      return;
    }
    if(t.closest&&t.closest('[data-routine-del]')){
      var ridx=parseInt(t.closest('[data-routine-del]').getAttribute('data-routine-del'));
      if(!isNaN(ridx)&&Array.isArray(S.routines)&&ridx>=0&&ridx<S.routines.length){
        var rremoved=S.routines.splice(ridx,1)[0];
        save();
        showUndo('Routine gelöscht', function(){
          var ri2=Math.min(ridx, S.routines.length);
          S.routines.splice(ri2,0,rremoved);
          save(); renderRoutines();
          try{ if(typeof renderCalSide==="function") renderCalSide(); }catch(e){}
        });
        renderRoutines();
        try{ if(typeof renderCalSide==="function") renderCalSide(); }catch(e){}
      }
      return;
    }
  });
  document.addEventListener('input', function(e){
    if(e.target&&e.target.id==='taskSearch') renderTasks();
    if(e.target&&e.target.id==='routineSearch') renderRoutines();
  });
  document.addEventListener('change', function(e){

  });
})();
(function(){
  document.addEventListener('click', function(e){
    var t=e.target;
    if(t.closest&&t.closest('#workClearDay')){ if(confirm('Tag wirklich leeren?')){ var k=wkTodayKey(); if(typeof S!=="undefined") delete S.work[k]; try{save();if(typeof renderWork==="function")renderWork();if(typeof updateWorkLive==="function")updateWorkLive();}catch(ex){} return; }
    }
    if(t.closest&&t.closest('[data-wk-edit]')){ openWorkDay(wkTodayKey()); return; }
    if(t.closest&&t.closest('[data-wk-editday]')){ openWorkDay(t.closest('[data-wk-editday]').getAttribute('data-wk-editday')); return; }
    if(t.closest&&t.closest('[data-wk-rowdel]')){
      syncWkDraft();
      var ri=parseInt(t.closest('[data-wk-rowdel]').getAttribute('data-wk-rowdel'));
      if(!isNaN(ri)&&wkDraft.length>1){ wkDraft.splice(ri,1); renderWkRows(); }
      else { wkDraft=[{s:"",e:""}]; renderWkRows(); }
      return;
    }
    if(t.closest&&t.closest('[data-wk-del]')){
      var idx=parseInt(t.closest('[data-wk-del]').getAttribute('data-wk-del'));
      var k=wkTodayKey(); var a=S.work[k];
      if(!isNaN(idx)&&a&&a[idx]){
        var wemit=a.splice(idx,1)[0];
        if(!a.length) delete S.work[k];
        try{save();if(typeof renderWork==="function")renderWork();}catch(ex){}
        showUndo('Eintrag gelöscht', function(){
          var arr=workArr(k);
          var ai=Math.min(idx, arr.length);
          arr.splice(ai,0,wemit);
          try{save();if(typeof renderWork==="function")renderWork();}catch(ex){}
        });
        return;
      }
    }
    if(t.closest&&t.closest('[data-wk-delall]')){
      var kk=t.closest('[data-wk-delall]').getAttribute('data-wk-delall');
      if(typeof S!=="undefined"&&S.work&&S.work[kk]){
        var wdremoved=S.work[kk];
        delete S.work[kk];
        try{save();if(typeof renderWork==="function")renderWork();}catch(ex){}
        showUndo('Eintrag gelöscht', function(){
          S.work[kk]=wdremoved;
          try{save();if(typeof renderWork==="function")renderWork();}catch(ex){}
        });
        return;
      }
    }
  });
})();
function renderCalSide(){
  try{
    if(typeof S==="undefined"||!S) return;
    var tBox=document.getElementById('calTasksList');
    if(tBox){
      var ctFilter='all'; var cs=document.getElementById('calTaskSeg');
      if(cs){ var cb=cs.querySelector('.segbtn.active'); if(cb) ctFilter=cb.dataset.seg||'all'; }
      var todos=(Array.isArray(S.todos)?S.todos:[]).filter(function(t){
        if(!inProfile(t.cat)) return false;
        var cdone=taskIsDone(t);
        if(ctFilter==='open' && cdone) return false;
        if(ctFilter==='done' && !cdone) return false;
        return true;
      });
      todos.sort(function(a,b){
        var da=taskDate(a)?parseISO(taskDate(a)).getTime():Number.POSITIVE_INFINITY;
        var db=taskDate(b)?parseISO(taskDate(b)).getTime():Number.POSITIVE_INFINITY;
        var da2=isNaN(da)?Number.POSITIVE_INFINITY:da;
        var db2=isNaN(db)?Number.POSITIVE_INFINITY:db;
        if(da2!==db2) return da2-db2;
        var tma=taskStartTime(a)||"99:99", tmb=taskStartTime(b)||"99:99";
        if(tma!==tmb) return tma<tmb?-1:1;
        var ta=a.title||""; var tb=b.title||""; if(ta<tb) return -1; if(ta>tb) return 1; return 0;
      });
      // move done to bottom
      todos.sort(function(a,b){
        var ad=taskIsDone(a), bd=taskIsDone(b);
        if(ad!==bd) return ad?1:-1;
        return 0;
      });
      if(!todos.length){
        tBox.innerHTML='<div class="empty"><span class="big">🎉</span>Noch keine Aufgaben.</div>';
      }else{
        tBox.innerHTML=todos.map(function(t){
          var idx=S.todos.indexOf(t);
          var done=taskIsDone(t);
          var c=(typeof cat==='function')?cat(t.cat):{name:'',color:'#64748b'};
          return '<div class="item'+(done?' done':'')+'">'
            +'<button class="check'+(done?' on':'')+'" data-task-toggle="'+idx+'">✓</button>'
            +'<div><div class="it-title">'+esc(t.title||t.text||'')+'</div>'
            +'<div class="it-sub"><span class="pill" style="background:'+c.color+'">'+esc(c.name)+'</span>'
            +(t.repeat&&t.repeat!=='none'?'<span>↻ '+esc(repLabel(t.repeat))+'</span>':'')
            + fmtDue(t,done)+'</div></div>'
            +'<div class="it-actions"><button type="button" class="menu-toggle" title="Aktionen" aria-label="Aktionen">'+ICON_MORE+'</button>'
            +'<button type="button" class="btn sm act" data-task-edit="'+idx+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
            +'<button type="button" class="btn sm act del" data-task-del="'+idx+'" title="Löschen">'+ICON_TRASH+'</button></div>'
            +'</div>';
        }).join('');
      }
      var cnt=document.getElementById('calTaskCount');
      if(cnt){
        cnt.textContent=todos.length;
      }
    }
    var rBox=document.getElementById('calRoutinesList');
    if(rBox){
      var crFilter='all'; var crs=document.getElementById('calRoutineSeg');
      if(crs){ var crb=crs.querySelector('.segbtn.active'); if(crb) crFilter=crb.dataset.seg||'all'; }
      var routines=(Array.isArray(S.routines)?S.routines:[]).filter(function(r){
        if(!inProfile(r.cat)) return false;
        var rd=routineIsDone(r);
        if(crFilter==='open' && rd) return false;
        if(crFilter==='done' && !rd) return false;
        return true;
      });
      routines.sort(function(a,b){
        var ta=a.name||"", tb=b.name||""; if(ta<tb) return -1; if(ta>tb) return 1; return 0;
      });
      routines.sort(function(a,b){
        var ad=routineIsDone(a), bd=routineIsDone(b);
        if(ad!==bd) return ad?1:-1;
        return 0;
      });
      if(!routines.length){
        rBox.innerHTML='<div class="empty"><span class="big">🗓️</span>Noch keine Routinen.</div>';
      }else{
        rBox.innerHTML=routines.map(function(r){
          var i=S.routines.indexOf(r);
          var rdone=routineIsDone(r);
          return '<div class="item'+(rdone?' done':'')+'">'
            +'<button type="button" class="check'+(rdone?' on':'')+'" data-routine-toggle="'+i+'" title="Erledigt abhaken">✓</button>'
            +'<div><div class="it-title">'+esc(r.name||'')+'</div>'
            +'<div class="it-sub"><span>↻ '+esc(repLabel(r.freq))+'</span>'
            +(r.time&&r.time!=="any"?'<span>🕒 '+esc(r.time)+'</span>':'')
            +(rdone&&r.completedAt?'<span>'+esc(fmtCompletedAt(r.completedAt))+'</span>':'')
            +(r.note?' · '+esc(r.note):'')+'</div></div>'
            +'<div class="it-actions"><button type="button" class="menu-toggle" title="Aktionen" aria-label="Aktionen">'+ICON_MORE+'</button>'
            +'<button type="button" class="btn sm act" data-routine-edit="'+i+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
            +'<button type="button" class="btn sm act del" data-routine-del="'+i+'" title="Löschen">'+ICON_TRASH+'</button></div></div>';
        }).join('');
      }
      var rcnt=document.getElementById('calRoutineCount');
      if(rcnt) rcnt.textContent=routines.length;
    }
  }catch(e){}
  try{ updateBadges(); }catch(e){}
}

var __whs=document.getElementById("workHistSearch");
if(__whs) __whs.oninput = function(){ try{ renderWork(); }catch(e){} };
var __whm=document.getElementById("workHistMonth");
if(__whm){
  if(!__whm.value){ var t=today(); __whm.value = String(t.getFullYear())+"-"+pad(t.getMonth()+1); }
  __whm.oninput = function(){ try{ renderWork(); }catch(e){} };
}
var __whmAll=document.getElementById("btnHistMonthAll");
if(__whmAll) __whmAll.onclick = function(){
  var i=document.getElementById("workHistMonth");
  if(i){
    var t=today();
    i.value = String(t.getFullYear())+"-"+pad(t.getMonth()+1);
    try{ i.dataset.init="1"; }catch(e){}
  }
  try{ renderWork(); }catch(e){}
};
var __addWd=document.getElementById("btnAddWorkDay");
if(__addWd) __addWd.onclick=function(){
  var tk=wkTodayKey();
  var def=tk.split("-").reverse().join(".");
  var k=prompt("Tag im Format TT.MM.JJJJ (leer = heute)", def);
  if(k===null) return;
  k=(k||"").trim();
  var m=k.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if(m){
    var dd=m[1].padStart(2,"0"), mm=m[2].padStart(2,"0"), yy=m[3];
    k=yy+"-"+mm+"-"+dd;
  }else{
    if(!/\d{4}-\d{2}-\d{2}/.test(k)) k=tk;
  }
  if(typeof S==="undefined") window.S={work:{}};
  if(!S.work) S.work={};
  if(!S.work[k]) S.work[k]=[];
  try{save();}catch(e){}
  openWorkDay(k);
};

(function(){
  var seg=document.getElementById("taskSeg");
  if(seg){
    seg.addEventListener("click", function(e){
      var b=e.target.closest(".segbtn"); if(!b) return;
      seg.querySelectorAll(".segbtn").forEach(function(x){x.classList.toggle("active", x===b);});
      rememberSeg("segTask", b.dataset.seg||"open");
      if(typeof renderTasks==="function") renderTasks();
    });
  }
})();
(function(){
  var seg=document.getElementById("routineSeg");
  if(seg){
    seg.addEventListener("click", function(e){
      var b=e.target.closest(".segbtn"); if(!b) return;
      seg.querySelectorAll(".segbtn").forEach(function(x){x.classList.toggle("active", x===b);});
      rememberSeg("segRoutine", b.dataset.seg||"open");
      if(typeof renderRoutines==="function") renderRoutines();
    });
  }
})();
(function(){
  function segClick(id,key){
    var seg=document.getElementById(id);
    if(!seg) return;
    seg.addEventListener("click", function(e){
      var b=e.target.closest(".segbtn"); if(!b) return;
      seg.querySelectorAll(".segbtn").forEach(function(x){x.classList.toggle("active", x===b);});
      rememberSeg(key, b.dataset.seg||"all");
      if(typeof renderCalSide==="function") renderCalSide();
    });
  }
  segClick("calTaskSeg","segCalTask");
  segClick("calRoutineSeg","segCalRoutine");
  document.querySelectorAll(".panel-title[data-goto]").forEach(function(el){
    el.addEventListener("click", function(){ if(typeof setView==="function") setView(el.dataset.goto); });
    el.addEventListener("keydown", function(e){
      if(e.key==="Enter" || e.key===" "){ e.preventDefault(); if(typeof setView==="function") setView(el.dataset.goto); }
    });
  });
})();
