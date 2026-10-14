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
    events:[], todos:[],tasks:[],routines:[], birthdays:[], meals:{}, lists:null, rewards:[], points:0, history:[],
    settings:{ weekStart:1, showDone:false, appTitle:"Familienkalender", paidBreakfastMin:0, showMoon:false, showZodiac:false, dayStart:0, dayEnd:24, segTask:"open", segRoutine:"open", segCalTask:"all", segCalRoutine:"all" }
  };
}

let S;
let activeProfile = null;
let calMode = "month";
let dvFullDay = false; // Tagesansicht: ganzen Tag (0–24) statt eingestelltem Zeitraum zeigen
function inProfile(catId){ return !activeProfile || !catId || catId === activeProfile; }
function renderProfiles(){
  try{
    const box = document.getElementById('profiles');
    if(!box) return;
    const selAll = !activeProfile;
    let html = '<button class="avatar all'+(selAll?' active':'')+'" data-profile="" title="Alle" aria-pressed="'+selAll+'" aria-label="Alle Profile anzeigen">★</button>';
    html += S.categories.map(c=>{
      const ini = (c.name||'?').trim().charAt(0).toUpperCase();
      const active = activeProfile===c.id;
      return '<button class="avatar av-cat'+(active?' active':'')+'" data-profile="'+c.id+'" style="--avc:'+c.color+'" title="'+esc(c.name)+'" aria-pressed="'+active+'" aria-label="Nur '+esc(c.name)+' anzeigen'+(active?' (aktiv)':'')+'">'+esc(ini)+'</button>';
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
  if(!Array.isArray(S.birthdays)) S.birthdays = [];
  /* Robustheit: Tag/Monat (und Jahr) immer als Zahl. Sonst scheitert der strikte
     Vergleich in birthdaysOn()/checkBirthdayWarnings() und im Kalender erschiene kein
     Geburtstags-Chip, obwohl die Geburtstagsliste den Termin korrekt anzeigt. */
  else S.birthdays.forEach(function(b){
    if(!b) return;
    var dd=Number(b.day), mm=Number(b.month);
    if(isFinite(dd) && dd>0) b.day=dd;
    if(isFinite(mm) && mm>0) b.month=mm;
    if(b.year!=null && b.year!==""){ var yy=Number(b.year); if(isFinite(yy)) b.year=yy; }
  });
  migrateCategoryColors();
}
function migrateCategoryColors(){
  try{
    if(!S || !Array.isArray(S.categories)) return;
    // „Arbeit“ bleibt orange (#f5a524), nur „urlaub“ bekommt eine feste Farbe.
    const map = { "urlaub":"#84cc16" };
    S.categories.forEach(function(c){
      const k = String(c.name||"").trim().toLowerCase();
      if(map[k] && String(c.color||"").toLowerCase()==="#f5a524") c.color = map[k];
    });
  }catch(e){}
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

try{
  // Robustheit: Termine ohne gültiges Datum (z. B. aus einer früheren Version)
  // dürfen den Kalender nicht mehr zum Absturz bringen.
  if(S && Array.isArray(S.events)){
    var __emig=false;
    S.events.forEach(function(e){
      if(!e) return;
      if(typeof e.date!=="string" || !e.date){
        if(e.startDate){ e.date=e.startDate; __emig=true; }
        else if(e.repeat && e.repeat!=="none"){ e.repeat="none"; __emig=true; }
      }
      if(e.endDate==null) e.endDate="";
    });
    if(__emig) save();
  }
}catch(e){}


/* =========================================================
   Datum / Helfer
   ========================================================= */
const pad = n => String(n).padStart(2,"0");
const iso = d => d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
const parseISO = s => {
  if(typeof s!=="string" || !s) return new Date(NaN);
  const [y,m,d] = s.slice(0,10).split("-").map(Number);
  if(!y || !m || !d) return new Date(NaN);
  return new Date(y,m-1,d);
};
const today = () => { const d=new Date(); d.setHours(0,0,0,0); return d; };
const clone = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d,n) => { const c=clone(d); c.setDate(c.getDate()+n); return c; };
const sameDay = (a,b) => iso(a)===iso(b);

const ICON_EDIT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
const ICON_TRASH = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';
const ICON_MORE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>';
const ICON_CAL = '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="2"/><path d="M1.5 6.5h13M5 1v2.6M11 1v2.6"/></svg>';
const ICON_TIME = '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6.25"/><path d="M8 4.5V8l2.5 1.8"/></svg>';
const ICON_TIMER = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="10" y1="2" x2="14" y2="2"/><line x1="12" y1="14" x2="15" y2="11"/><circle cx="12" cy="14" r="8"/></svg>';
const ICON_STAR = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
const ICON_TASK = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/></svg>';
const ICON_RESCHED = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 8 16 8"/><path d="M12 7.5V12l3 1.8"/></svg>';

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
const MONTHS_SHORT = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
const DOW_FULL = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];

function weekStartDay(){ return Number(S.settings.weekStart ?? 1); }
function dayRangeStart(){ var v=Number(S.settings && S.settings.dayStart); if(!isFinite(v)) v=0; return Math.max(0,Math.min(23,Math.round(v))); }
function dayRangeEnd(){ var s=dayRangeStart(); var v=Number(S.settings && S.settings.dayEnd); if(!isFinite(v)) v=24; v=Math.max(1,Math.min(24,Math.round(v))); return v<=s?s+1:v; }
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
    let n = 0, nOver = 0;
    if(S && Array.isArray(S.todos)) S.todos.forEach(t=>{ if(inProfile(t.cat) && !isDone(t)){ n++; if(isTaskOverdue(t)) nOver++; } });
    const b = document.getElementById("todoBadge");
    if(b){
      if(nOver>0){
        b.textContent = nOver; b.classList.add("overdue");
        b.title = nOver+" überfällig · "+n+" offen";
      }else{
        b.textContent = n; b.classList.remove("overdue");
        b.title = n===1 ? "1 offene Aufgabe" : n+" offene Aufgaben";
      }
      b.style.display = n ? "grid" : "none";
    }
    let rn = 0, rOver = 0;
    if(S && Array.isArray(S.routines)) S.routines.forEach(r=>{ if(inProfile(r.cat) && !routineIsDone(r)){ rn++; if(isRoutineOverdue(r)) rOver++; } });
    const rb = document.getElementById("routineBadge");
    if(rb){
      if(rOver>0){
        rb.textContent = rOver; rb.classList.add("overdue");
        rb.title = rOver+" überfällig · "+rn+" offen";
      }else{
        rb.textContent = rn; rb.classList.remove("overdue");
        rb.title = rn===1 ? "1 offene Routine" : rn+" offene Routinen";
      }
      rb.style.display = rn ? "grid" : "none";
    }
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
let calSearchQuery = "";

function reportRenderError(e){
  try{ if(window.console && console.error) console.error(e); }catch(_){}
  try{
    if(typeof curView!=="undefined" && curView==="cal"){
      const ad = document.getElementById("agendaDate");
      const ag = document.getElementById("agenda");
      if(ad) ad.textContent = "⚠ Anzeige-Fehler";
      if(ag) ag.innerHTML = '<div class="empty"><span class="big">⚠️</span>'
        + 'Ein Eintrag konnte nicht angezeigt werden.'
        + '<br><span class="muted">'+esc(e && e.message ? e.message : e)+'</span></div>';
    }
  }catch(_){}
}
function renderCalendar(){
  try{
  updateCalModeUI();
  const lg0 = document.getElementById("legend"); if(lg0) lg0.hidden = false;
  if(calMode==="day"){ renderDayView(); try{ renderAgenda(); }catch(e){} refreshCalSearch(); return; }
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
    const bds = birthdaysOn(key);
    let chips = "";
    let cellItems = bds.map(function(b){ return bdChipHTML(b,key); })
                         .concat(evs.map(chipHTML)).concat(tks.map(taskChipHTML));
    /* Geburtstag morgen → heute eine dezente Vorwarnung (analog zum Warn-Dialog) */
    if(sameDay(d,today())){
      const tom=addDays(today(),1);
      const eve=birthdaysOn(iso(tom)).map(function(b){ return bdEveChipHTML(b, tom.getFullYear()); });
      if(eve.length) cellItems=eve.concat(cellItems);
    }
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
  refreshCalSearch();
  }catch(e){ reportRenderError(e); }
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
    const dfb=document.getElementById("dayFullBtn");
    if(dfb){
      dfb.style.display = calMode==="day" ? "" : "none";
      dfb.classList.toggle("active", !!dvFullDay);
      dfb.setAttribute("aria-pressed", dvFullDay ? "true" : "false");
      dfb.title = dvFullDay
        ? "Zeigt den ganzen Tag (0–24 Uhr) – klicken für Zeitraum "+dayRangeStart()+":00–"+dayRangeEnd()+":00"
        : "Ganzen Tag anzeigen (0–24 Uhr), um frühere/spätere Einträge zu sehen";
    }
  }catch(e){}
}
function evResultHTML(ev){
  const c = cat(ev.cat);
  const when = ev.allDay ? "ganztägig" : esc((ev.start||"—")+(ev.end?"–"+ev.end:""));
  const dshort = ev.date ? esc(ev.date.split("-").reverse().join(".")) : "";
  const dspan = (evDays(ev)>1 && ev.endDate)
    ? dshort+"–"+esc(ev.endDate.split("-").reverse().join("."))
    : dshort;
  const repL = eventRepLabel(ev);
  return '<div class="ag-item'+(eventIsDone(ev)?" done":"")+'" data-ev="'+ev.id+'" style="--c:'+c.color+'">'
    + '<div class="when">'+when+'</div>'
    + '<div><div class="ttl">'+esc(ev.title)+'</div>'
    + '<div class="sub"><span class="pill" style="background:'+c.color+'">'+esc(c.name)+'</span>'
    + (dspan ? ' · '+ICON_CAL+' '+dspan : '')
    + (repL ? ' · 🔁 '+esc(repL) : '')
    + (ev.note ? ' · '+esc(ev.note) : '')+'</div></div>'
    + '<div class="ag-actions"><button type="button" class="linkbtn act" data-ev-edit="'+ev.id+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
    + '<button type="button" class="linkbtn act" data-copy="'+ev.id+'">⧉ Kopieren</button>'
    + '<button type="button" class="linkbtn act del" data-evdel="'+ev.id+'" title="Löschen">'+ICON_TRASH+'</button></div>'
    + '</div>';
}
function taskResultHTML(t){
  const c = cat(t.cat);
  const when = taskIsAllDay(t) ? "ganztägig" : esc((taskStartTime(t)||"—")+(taskEndTime(t)?"–"+esc(taskEndTime(t)):""));
  const d = taskDate(t);
  const dshort = d ? esc(d.split("-").reverse().join(".")) : "";
  const dspan = (d && t.endDate && t.endDate>d) ? dshort+"–"+esc(t.endDate.split("-").reverse().join(".")) : dshort;
  let meta = dspan ? " · "+ICON_CAL+" "+dspan : "";
  if(repLabel(t.repeat)) meta += " · 🔁 "+esc(repLabel(t.repeat));
  if(t.points) meta += " · "+t.points+" "+ICON_STAR;
  if(t.note) meta += " · "+esc(t.note);
  return '<div class="ag-item task'+(taskIsDone(t)?" done":"")+'" style="--c:'+c.color+'">'
    + '<div class="when">'+when+'</div>'
    + '<div class="tclick" data-info-open="task" data-info-id="'+t.id+'"><div class="ttl">'+esc(t.title||t.text||"")+'</div>'
    + '<div class="sub"><span class="pill" style="background:'+c.color+'">'+esc(c.name)+'</span>'+meta+'</div></div>'
    + '</div>';
}
function routineResultHTML(r){
  const c = cat(r.cat);
  const when = (r.time && r.time!=="any") ? esc(r.time) : "Flexibel";
  let meta = "";
  if(repLabel(r.freq)) meta += " · 🔁 "+esc(repLabel(r.freq));
  if(r.points) meta += " · "+r.points+" "+ICON_STAR;
  if(r.note) meta += " · "+esc(r.note);
  return '<div class="ag-item'+(routineIsDone(r)?" done":"")+'" style="--c:'+c.color+';cursor:pointer" data-info-open="routine" data-info-id="'+r.id+'">'
    + '<div class="when">'+when+'</div>'
    + '<div><div class="ttl">'+esc(r.name||"")+'</div>'
    + '<div class="sub"><span class="pill" style="background:'+c.color+'">'+esc(c.name)+'</span>'+meta+'</div></div>'
    + '</div>';
}
function hideCalSearchDrop(){ const w=document.getElementById("calSearchWrap"); if(w) w.hidden = true; }
function isCalSearchOpen(){ const b=document.getElementById("calSearchBox"); return !!(b && b.classList.contains("active")); }
function refreshCalSearch(){
  if(!isCalSearchOpen()){ hideCalSearchDrop(); return; }
  sizeCalSearchField();
  if(calSearchQuery.trim()) renderCalSearch(); else hideCalSearchDrop();
}
function calSearchTabsEnd(){
  const nav=document.getElementById("tabs");
  if(!nav) return null;
  let right=-1;
  nav.querySelectorAll(".tab").forEach(function(t){ right=Math.max(right, t.getBoundingClientRect().right); });
  if(right<0) return null;
  return right + 16;
}
let calSearchPanelCache = 0;
function calSearchPanelWidth(){
  const el=document.getElementById("calTasksList");
  if(!el) return calSearchPanelCache;
  const card=el.closest(".card") || el;
  const r=card.getBoundingClientRect();
  if(r.width>=180){ calSearchPanelCache=r.width; return r.width; }
  return calSearchPanelCache;
}
function calSearchFieldWidth(){
  const panelW=calSearchPanelWidth();
  if(panelW>=180) return panelW;
  const box=document.getElementById("calSearchBox"); if(!box) return 320;
  const br=box.getBoundingClientRect();
  const ref=calSearchTabsEnd();
  let w = 320;
  if(ref!=null) w = br.right - ref;
  if(!isFinite(w) || w<220) w=220;
  return w;
}
function sizeCalSearchField(){
  const box=document.getElementById("calSearchBox"); if(!box) return;
  box.style.setProperty("--cal-w", calSearchFieldWidth()+"px");
}
function openCalSearch(){
  const box=document.getElementById("calSearchBox"); if(!box) return;
  sizeCalSearchField();
  box.classList.add("active");
  const inp=document.getElementById("calSearchInput");
  if(inp) setTimeout(function(){ try{ inp.focus(); inp.select(); }catch(e){} }, 40);
  if(calSearchQuery.trim()) renderCalSearch();
}
function closeCalSearch(){
  const box=document.getElementById("calSearchBox"); if(box) box.classList.remove("active");
  hideCalSearchDrop();
  const clr=document.getElementById("calSearchClear"); if(clr) clr.style.display = "none";
  const inp=document.getElementById("calSearchInput"); if(inp) inp.value = "";
  calSearchQuery = "";
}
function srchTermsMatch(hay, terms){
  for(let i=0;i<terms.length;i++){ if(hay.indexOf(terms[i])<0) return false; }
  return true;
}
function renderCalSearch(){
  const wrap = document.getElementById("calSearchWrap");
  const clr = document.getElementById("calSearchClear");
  const q = calSearchQuery.trim().toLowerCase();
  if(clr) clr.style.display = q ? "" : "none";
  if(!q){ if(wrap) wrap.hidden = true; return; }
  const terms = q.split(/\s+/).filter(Boolean);
  const items = [];
  (Array.isArray(S.events)?S.events:[]).forEach(function(ev){
    if(!inProfile(ev.cat)) return;
    const c = cat(ev.cat);
    const dshort = ev.date ? ev.date.split("-").reverse().join(".") : "";
    const hay = [
      ev.title, ev.note, c.name, "termin",
      ev.date, dshort, ev.endDate || "",
      ev.allDay ? "ganztägig" : ((ev.start||"")+" "+(ev.end||"")),
      eventIsDone(ev) ? "erledigt" : "offen"
    ].join(" ").toLowerCase();
    if(!srchTermsMatch(hay, terms)) return;
    items.push({ kind:"ev", date:ev.date||"", start:ev.allDay?"":ev.start||"", html:evResultHTML(ev) });
  });
  (Array.isArray(S.todos)?S.todos:[]).forEach(function(t){
    if(!inProfile(t.cat)) return;
    const c = cat(t.cat);
    const d = taskDate(t);
    const dshort = d ? d.split("-").reverse().join(".") : "";
    const hay = [
      t.title||t.text||"", t.note, c.name, "aufgabe",
      d, dshort, t.endDate || "",
      repLabel(t.repeat)||"",
      t.points ? ("punkte "+t.points) : "",
      taskIsAllDay(t) ? "ganztägig" : ((taskStartTime(t)||"")+" "+(taskEndTime(t)||"")),
      taskIsDone(t) ? "erledigt" : "offen"
    ].join(" ").toLowerCase();
    if(!srchTermsMatch(hay, terms)) return;
    items.push({ kind:"task", date:d||"", start:taskIsAllDay(t)?"":taskStartTime(t)||"", html:taskResultHTML(t) });
  });
  (Array.isArray(S.routines)?S.routines:[]).forEach(function(r){
    if(!inProfile(r.cat)) return;
    const c = cat(r.cat);
    const hay = [
      r.name||"", r.note, c.name, "routine",
      repLabel(r.freq)||"", r.time==="any"?"flexibel":(r.time||""),
      r.points ? ("punkte "+r.points) : "",
      routineIsDone(r) ? "erledigt" : "offen"
    ].join(" ").toLowerCase();
    if(!srchTermsMatch(hay, terms)) return;
    items.push({ kind:"routine", date:"", start:"", html:routineResultHTML(r) });
  });
  items.sort(function(a,b){
    if(!!a.date!==!!b.date) return a.date ? -1 : 1;
    if(a.date!==b.date) return a.date<b.date?-1:1;
    if(a.start!==b.start) return a.start<b.start?-1:1;
    return 0;
  });
  const info = document.getElementById("calSearchInfo");
  if(info){
    let nE=0,nT=0,nR=0;
    items.forEach(function(it){ if(it.kind==="ev") nE++; else if(it.kind==="task") nT++; else nR++; });
    let label;
    if(items.length===0) label = "Keine Treffer";
    else {
      const parts=[];
      if(nE) parts.push(nE+(nE===1?" Termin":" Termine"));
      if(nT) parts.push(nT+(nT===1?" Aufgabe":" Aufgaben"));
      if(nR) parts.push(nR+(nR===1?" Routine":" Routinen"));
      label = items.length+" Treffer ("+parts.join(" · ")+")";
    }
    info.textContent = label;
  }
  const list = document.getElementById("calSearchList");
  if(list){
    list.innerHTML = items.length
      ? items.map(function(it){ return it.html; }).join("")
      : '<div class="empty"><span class="big">🔍</span>Keine Treffer gefunden.</div>';
  }
  if(wrap) wrap.hidden = false;
}
var __calSearchBtn=document.getElementById("calSearchBtn");
if(__calSearchBtn) __calSearchBtn.addEventListener("click", function(e){ e.stopPropagation(); openCalSearch(); });
var __calSearchInput=document.getElementById("calSearchInput");
if(__calSearchInput){
  __calSearchInput.addEventListener("input", function(){ calSearchQuery = this.value; renderCalSearch(); });
  __calSearchInput.addEventListener("keydown", function(e){ if(e.key==="Escape"){ e.stopPropagation(); closeCalSearch(); } });
}
var __calSearchClear=document.getElementById("calSearchClear");
if(__calSearchClear) __calSearchClear.onclick = function(e){
  if(e) e.stopPropagation();
  var inp=document.getElementById("calSearchInput"); if(inp){ inp.value=""; inp.focus(); }
  calSearchQuery=""; renderCalSearch();
};
document.addEventListener("mousedown", function(e){
  var box=document.getElementById("calSearchBox");
  if(!box || !box.classList.contains("active")) return;
  if(box.contains(e.target)) return;
  closeCalSearch();
});
document.addEventListener("keydown", function(e){
  if((e.ctrlKey||e.metaKey) && (e.key==="k"||e.key==="K")){
    e.preventDefault();
    if(isCalSearchOpen()) closeCalSearch(); else openCalSearch();
  }
});
window.addEventListener("resize", function(){ if(isCalSearchOpen()) sizeCalSearchField(); });
var __calSearchList=document.getElementById("calSearchList");
if(__calSearchList) __calSearchList.addEventListener("click", function(e){
  const ed = e.target.closest("[data-ev-edit]");
  if(ed){ closeCalSearch(); openEvent(ed.dataset.evEdit); return; }
  const del = e.target.closest("[data-evdel]");
  if(del){ if(copyEvId && e.target.closest("[data-copy]")) return; deleteEvent(del.dataset.evdel); return; }
  const cp = e.target.closest("[data-copy]");
  if(cp){ setCopyEv(cp.dataset.copy); closeCalSearch(); return; }
  const ev = e.target.closest("[data-ev]");
  if(ev){ closeCalSearch(); openInfo("ev", ev.dataset.ev); return; }
  const io = e.target.closest("[data-info-open]");
  if(io){ closeCalSearch(); }
});
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
  document.getElementById("calTitle").innerHTML = esc(DOW_FULL[selDate.getDay()].slice(0,2) + ", " + fmtDate(selDate)) + "<span>Tagesansicht</span>";
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

  const PXH=64, PXM=PXH/60;
  const BOTTOM_PAD=24; // Puffer unten, damit letzte Linie/Label nicht am Rahmen klebt
  const cfgDs=dayRangeStart(), cfgDe=dayRangeEnd();
  const ds=dvFullDay?0:cfgDs, de=dvFullDay?24:cfgDe;
  const baseMin=ds*60, totalH=(de-ds)*PXH;
  const isToday=sameDay(selDate,today());
  const nowDate=new Date();
  const nowMin=isToday ? (nowDate.getHours()*60+nowDate.getMinutes()) : -1;
  const nowY = isToday ? (nowMin-baseMin)*PXM : -1;
  const nowShown = nowY >= 0 && nowY <= totalH;
  let grid='<div class="dv-grid" data-date="'+key+'" data-base="'+baseMin+'" style="height:'+(totalH+BOTTOM_PAD)+'px">';
  for(let h=ds;h<de;h++){
    const hideLbl = nowShown && Math.abs(nowMin - h*60) <= 15;
    grid+='<div class="dv-hour" style="top:'+((h-ds)*PXH)+'px"><span'+(hideLbl?' style="visibility:hidden"':'')+'>'+pad(h)+":00</span></div>";
  }
  grid+='<div class="dv-end" style="top:'+totalH+'px"></div>';
  if(nowShown){
    if(nowY>0) grid+='<div class="dv-past" style="height:'+Math.min(nowY,totalH)+'px"></div>';
    grid+='<div class="dv-now" style="top:'+nowY+'px" title="Jetzt"><span class="dv-now-lbl">'+pad(nowDate.getHours())+":"+pad(nowDate.getMinutes())+'</span></div>';
  }
  items.forEach(function(it){
    const top=(it.start-baseMin)*PXM;
    const hgt=Math.max((it.end-it.start)*PXM,26);
    const short=hgt<40;
    const past=(isToday && it.end<=nowMin) ? " past" : "";
    const w=100/(it.lanes||1);
    const left=it.lane*w;
    const style="top:"+top+"px;height:"+hgt+"px;left:calc("+left+"% + 4px);width:calc("+w+"% - 6px)";
    if(it.kind==="ev"){
      const c=cat(it.ev.cat);
      const tRange=(it.ev.start||"")+(it.ev.end?"–"+it.ev.end:"");
      const repL=eventRepLabel(it.ev);
      grid+='<div class="dv-ev dv-ev-term'+(eventIsDone(it.ev)?" done":"")+(short?" dv-ev-short":"")+past+'" data-ev="'+it.ev.id+'" style="'+style+';--c:'+c.color+'" title="'+esc((tRange?tRange+" · ":"")+it.ev.title+(repL?" · "+repL:""))+'">'
          + '<div class="dv-ev-t">'+esc(it.ev.start||"")+(it.ev.end?"–"+esc(it.ev.end):"")+"</div>"
          + '<div class="dv-ev-n">'+(repL?'<span class="rep">↻</span>':"")+esc(it.ev.title)+"</div>"
          + '<div class="dv-ev-resize" style="position:absolute;left:0;right:0;bottom:0;height:6px;cursor:ns-resize"></div>'
          + '</div>';
    } else {
      const c=cat(it.task.cat);
      const tStart=taskStartTime(it.task), tEnd=taskEndTime(it.task);
      const tRange=(tStart?tStart+(tEnd?"–"+tEnd:""):"");
      const tDone=taskIsDone(it.task);
      const tOver=!tDone && isTaskOverdue(it.task);
      grid+='<div class="dv-ev dv-task'+(tDone?" done":"")+(tOver?" overdue":"")+(short?" dv-ev-short":"")+past+'" data-task-open="'+it.task.id+'" style="'+style+';--c:'+c.color+'" title="'+esc("Aufgabe: "+(tRange?tRange+" · ":"")+it.task.title+(tDone?" · erledigt":(tOver?" · überfällig":"")))+'">'
          + '<button type="button" class="task-toggle task-check'+(tDone?" on":"")+'" data-task-toggle-id="'+it.task.id+'" title="'+(tDone?"Wieder öffnen":"Erledigt abhaken")+'">'+(tDone?"✓":"")+'</button>'
          + '<span class="dv-ev-t">'+esc(tStart)+(tEnd?"–"+esc(tEnd):"")+'</span>'
          + '<span class="dv-ev-n">'+esc(it.task.title)+"</span>"
          + '<div class="dv-ev-resize" style="position:absolute;left:0;right:0;bottom:0;height:6px;cursor:ns-resize"></div>'
          + '</div>';
    }
  });
  grid+="</div>";

  const bannerEvHtml = banner.map(function(e){
    const c=cat(e.cat);
    const repL=eventRepLabel(e);
    return '<div class="dv-ad'+(eventIsDone(e)?" done":"")+'" data-ev="'+e.id+'" style="background:'+c.color+'" title="'+esc(e.title+(repL?" · "+repL:""))+'">'
         + (evDays(e)>1?"⇥ ":"")+(repL?'<span class="rep">↻</span>':"")+esc(e.title)
         + (!eventIsDone(e) ? '<span class="dv-ad-resize" title="Dauer ändern"></span>' : "")
         + "</div>";
  });
  const bannerTaskHtml = tksBanner.map(function(t){
    const c=cat(t.cat);
    const tDone=taskIsDone(t);
    return '<div class="dv-ad dv-ad-task'+(tDone?" done":"")+'" data-task-open="'+t.id+'" style="background:'+c.color+'" title="'+esc(t.title+(tDone?" · erledigt":" · offen"))+'">'
         + (tDone?'<span class="mark">✓</span>':'')+esc(t.title)
         + (!tDone ? '<span class="dv-ad-resize" title="Dauer ändern"></span>' : "")
         + "</div>";
  });
  const bds=birthdaysOn(key);
  /* Geburtstag morgen → heute auch in der Ganztägig-Zeile eine dezente Vorwarnung */
  let eveBanner=[];
  if(isToday){
    const tom=addDays(today(),1);
    eveBanner=birthdaysOn(iso(tom)).map(function(b){ return bdEveBannerHTML(b, tom.getFullYear()); });
  }
  const bannerAll = eveBanner.concat(bds.map(function(b){ return bdBannerHTML(b, selDate.getFullYear()); })).concat(bannerEvHtml).concat(bannerTaskHtml);
  const bannerHtml = bannerAll.length ? bannerAll.join("") : '<span class="dv-ad-empty">—</span>';

  document.getElementById("dayView").innerHTML =
      '<div class="dv-allday"><div class="dv-allday-lbl">Ganztägig</div><div class="dv-allday-items">'+bannerHtml+"</div></div>"
    + '<div class="dv-scroll">'+grid+"</div>";

  renderLegend();
  try{ if(typeof renderCalSide==="function") renderCalSide(); }catch(e){}
  try{ if(typeof updateWorkLive==="function") updateWorkLive(); }catch(e){}
  try{ if(typeof refreshDayDrag==="function") refreshDayDrag(); }catch(e){}
  const sc=document.querySelector("#dayView .dv-scroll");
  if(sc){
    const maxScroll = (sc.scrollHeight||0) - (sc.clientHeight||0);
    if(isToday){
      const nowTop=(nowMin-baseMin)*PXM;
      const third=(sc.clientHeight||560)/3;
      sc.scrollTop=Math.max(0, Math.min(nowTop-third, maxScroll));
    } else {
      /* Nicht heute: an den ersten Eintrag des Tages scrollen (Termin/Aufgabe mit Uhrzeit).
         Gibt es keinen Eintrag, wird die 6:00-Uhr-Zeile als erstes sichtbar (oben). */
      let firstMin=null;
      items.forEach(function(it){ if(firstMin===null || it.start<firstMin) firstMin=it.start; });
      const TOP_GAP=16; /* etwas Luft, damit der erste Eintrag nicht am oberen Rand klebt */
      const targetY=(firstMin===null) ? (6*60-baseMin)*PXM : (firstMin-baseMin)*PXM-TOP_GAP;
      sc.scrollTop=Math.max(0, Math.min(targetY, maxScroll));
    }
  }
}
/* =========================================================
   Drag & Resize (Termine + Aufgaben)
   Modi:
     move-time   : Tagesansicht – Uhrzeit verschieben (auch über Tagesgrenze)
     resize-end  : Tagesansicht – Ende skalieren
     move-day    : Monatsraster / Ganztägig-Banner – auf anderen Tag ziehen
     resize-span : Monatsraster / Banner – Dauer (Tage) skalieren
   Erledigte Einträge sind gesperrt.
   ========================================================= */
var DV_PXM = 64/60;   /* Pixel pro Minute (muss zu PXH in renderDayView passen) */
var DV_SNAP = 5;      /* Raster für Verschieben und Skalieren in Minuten */
var dvDragState = null;

function dvRoundMin(m){
  return Math.max(0, Math.min(1440, Math.round(m/DV_SNAP)*DV_SNAP));
}
function dvTimeLabel(start, end){
  const s = dvHM(start);
  return (end == null) ? s : s + "–" + dvHM(end >= 1440 ? 1439 : end);
}
function dvShortDate(key){ return key ? key.split("-").reverse().join(".") : ""; }
function dvDragItem(el){
  const ev = el.dataset.ev ? S.events.find(function(e){ return e.id === el.dataset.ev; }) : null;
  const t = el.dataset.taskOpen
    ? (Array.isArray(S.todos) ? S.todos.find(function(x){ return x.id === el.dataset.taskOpen; }) : null)
    : null;
  if(ev) return {kind:"ev", obj:ev};
  if(t) return {kind:"task", obj:t};
  return null;
}
function makeGhost(text, color){
  const g = document.createElement("div");
  g.className = "drag-ghost";
  g.textContent = text;
  if(color) g.style.background = color;
  document.body.appendChild(g);
  return g;
}
function clearDropTarget(){
  document.querySelectorAll(".day.drop-target").forEach(function(x){ x.classList.remove("drop-target"); });
}
function positionGhost(d, e){
  if(d.ghost){
    d.ghost.style.left = (e.clientX + 12) + "px";
    d.ghost.style.top = (e.clientY + 10) + "px";
  }
}
function updateGhostText(d){
  if(!d.ghost) return;
  if(d.mode==="move-day"){
    let key;
    if(d.el.closest("#calGrid")){ key = d.dropKey || d.origKey; }
    else { key = iso(addDays(parseISO(d.origKey), d.dayShift)); }
    d.ghost.textContent = d.origTitle + " → " + dvShortDate(key);
  }
}
function dropDayAt(x, y){
  const el = document.elementFromPoint(x, y);
  if(!el) return null;
  const day = el.closest(".day[data-date]");
  if(!day) return null;
  const grid = document.getElementById("calGrid");
  return (grid && grid.contains(day)) ? day : null;
}
function dvAutoScroll(sc, clientY){
  if(!sc) return;
  const r = sc.getBoundingClientRect();
  if(clientY < r.top + 26) sc.scrollTop -= 16;
  else if(clientY > r.bottom - 26) sc.scrollTop += 16;
}
function updateGridLabel(d){
  if(!d.label) return;
  let txt = dvTimeLabel(d.curStart, (d.mode==="resize-end" || d.hadEnd) ? d.curEnd : null);
  if(d.dayShift){
    txt += "  → " + dvShortDate(iso(addDays(parseISO(d.baseKey), d.dayShift)));
  }
  d.label.textContent = txt;
  try{ if(d.el.title) d.el.title = (d.obj.title||"") + " · " + txt; }catch(err){}
}
function taskSpanDays(t){
  const s = taskDate(t);
  if(!s) return 1;
  if(t.endDate && t.endDate > s) return Math.round((parseISO(t.endDate) - parseISO(s)) / 86400000) + 1;
  return 1;
}
function setEventDate(ev, newDate){
  const span = evDays(ev);
  ev.date = newDate;
  ev.endDate = span > 1 ? iso(addDays(parseISO(newDate), span - 1)) : "";
}
function setTaskDate(t, newDate){
  const span = taskSpanDays(t);
  t.startDate = newDate;
  t.endDate = span > 1 ? iso(addDays(parseISO(newDate), span - 1)) : "";
}
function commitTime(d){
  const startStr = dvHM(d.curStart);
  const endStr = dvHM(d.curEnd >= 1440 ? 1439 : d.curEnd);
  if(d.kind==="ev"){
    d.obj.start = startStr;
    if(d.mode==="resize-end" || d.hadEnd) d.obj.end = endStr;
  } else {
    d.obj.startTime = startStr;
    d.obj.allDay = false;
    if(d.mode==="resize-end" || d.hadEnd) d.obj.endTime = endStr;
  }
  if(d.dayShift && d.baseKey){
    const nd = iso(addDays(parseISO(d.baseKey), d.dayShift));
    if(d.kind==="ev") d.obj.date = nd;
    else d.obj.startDate = nd;
  }
}
function commitMoveDay(d){
  if(d.kind==="ev") setEventDate(d.obj, d.dropKey);
  else setTaskDate(d.obj, d.dropKey);
}
function commitSpan(d){
  const endDate = d.curSpan <= 1 ? "" : iso(addDays(parseISO(d.origKey), d.curSpan - 1));
  d.obj.endDate = endDate;
}
function refreshDayDrag(){ dvInitDrag(); }
function dvInitDrag(){
  const dv = document.getElementById("dayView");
  if(dv && !dv.dataset.dragBound){
    dv.dataset.dragBound = "1";
    dv.addEventListener("pointerdown", function(e){ dayViewDragStart(e); });
  }
  const cg = document.getElementById("calGrid");
  if(cg && !cg.dataset.dragBound){
    cg.dataset.dragBound = "1";
    cg.addEventListener("pointerdown", function(e){ monthViewDragStart(e); });
  }
}
function dayViewDragStart(e){
  if(e.button != null && e.button !== 0) return;
  if(e.target.closest(".task-toggle")) return;
  const grid = e.target.closest(".dv-ev");
  const banner = e.target.closest(".dv-ad");
  if(!grid && !banner) return;
  const item = dvDragItem(grid || banner);
  if(!item || !item.obj) return;
  if(item.kind==="ev" && eventIsDone(item.obj)) return;
  if(item.kind==="task" && taskIsDone(item.obj)) return;
  const spanResizing = !!(banner && e.target.closest(".dv-ad-resize"));
  const timeResizing = !!(grid && e.target.closest(".dv-ev-resize"));
  const mode = spanResizing ? "resize-span" : (grid ? (timeResizing ? "resize-end" : "move-time") : "move-day");
  const state = {
    kind: item.kind, obj: item.obj,
    el: grid || banner,
    mode: mode,
    origTitle: (item.kind==="ev" ? item.obj.title : (item.obj.title || item.obj.text || "")),
    startX: e.clientX, startY: e.clientY,
    moved: false, ghost: null
  };
  if(mode==="move-time" || mode==="resize-end"){
    const g = e.target.closest(".dv-grid");
    if(!g) return;
    const startMin = (item.kind==="ev")
      ? (item.obj.start ? hmToMin(item.obj.start) : 540)
      : (item.obj.startTime ? hmToMin(item.obj.startTime) : 540);
    let endMin;
    if(item.kind==="ev") endMin = item.obj.end ? hmToMin(item.obj.end) : startMin + 60;
    else endMin = item.obj.endTime ? hmToMin(item.obj.endTime) : startMin + 30;
    if(endMin <= startMin) endMin = startMin + (item.kind==="ev" ? 60 : 30);
    state.grid = g;
    state.scroll = g.closest(".dv-scroll");
    state.baseMin = Number(g.dataset.base) || 0;
    state.label = grid ? grid.querySelector(".dv-ev-t") : null;
    state.hadEnd = (item.kind==="ev") ? !!item.obj.end : !!item.obj.endTime;
    state.baseKey = g.dataset.date;
    state.origStart = startMin; state.origEnd = endMin;
    state.curStart = startMin; state.curEnd = endMin;
    state.dayShift = 0;
  } else {
    const span = (item.kind==="ev") ? evDays(item.obj) : taskSpanDays(item.obj);
    state.origSpan = span; state.origKey = (item.kind==="ev") ? item.obj.date : taskDate(item.obj);
    state.curSpan = span; state.dayShift = 0; state.dropKey = state.origKey;
    state.pxDay = 72;
    state.ghost = makeGhost(state.origTitle + " → " + dvShortDate(state.origKey), cat(item.obj.cat).color);
  }
  state.el.classList.add("dragging");
  if(state.el.setPointerCapture){ try{ state.el.setPointerCapture(e.pointerId); }catch(err){} }
  e.preventDefault();
  dvDragState = state;
}
function monthViewDragStart(e){
  if(e.button != null && e.button !== 0) return;
  if(copyEvId) return;
  const chip = e.target.closest(".ev[data-ev]") || e.target.closest(".task-chip[data-task-open]");
  if(!chip) return;
  if(e.target.closest(".ev-copy")) return;
  const item = dvDragItem(chip);
  if(!item || !item.obj) return;
  if(item.kind==="ev" && eventIsDone(item.obj)) return;
  if(item.kind==="task" && taskIsDone(item.obj)) return;
  const grid = document.getElementById("calGrid");
  const cellW = (grid && grid.clientWidth > 0) ? grid.clientWidth / 7 : 96;
  const resizing = !!e.target.closest(".chip-resize");
  const span = (item.kind==="ev") ? evDays(item.obj) : taskSpanDays(item.obj);
  if(resizing){
    const canSpan = (item.kind==="ev") ? (item.obj.allDay || span > 1) : (taskIsAllDay(item.obj) || span > 1);
    if(!canSpan) return;
  }
  const mode = resizing ? "resize-span" : "move-day";
  const state = {
    kind: item.kind, obj: item.obj, el: chip, mode: mode,
    origTitle: (item.kind==="ev" ? item.obj.title : (item.obj.title || item.obj.text || "")),
    origSpan: span, origKey: (item.kind==="ev") ? item.obj.date : taskDate(item.obj),
    curSpan: span, pxDay: cellW,
    startX: e.clientX, startY: e.clientY,
    moved: false, ghost: null
  };
  if(mode==="move-day"){
    state.dropKey = state.origKey;
    state.ghost = makeGhost(state.origTitle + " → " + dvShortDate(state.origKey), cat(item.obj.cat).color);
  } else {
    state.ghost = makeGhost(span + " Tage", cat(item.obj.cat).color);
  }
  chip.classList.add("dragging");
  if(chip.setPointerCapture){ try{ chip.setPointerCapture(e.pointerId); }catch(err){} }
  e.preventDefault();
  dvDragState = state;
}
window.addEventListener("pointermove", function(e){
  const d = dvDragState;
  if(!d) return;
  const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
  if(!d.moved){
    if(Math.abs(dx) <= 3 && Math.abs(dy) <= 3) return;
    d.moved = true;
  }
  if(d.mode==="move-time"){
    const dm = dy / DV_PXM;
    const dur = d.origEnd - d.origStart;
    let raw = d.origStart + dm;
    let dayShift = Math.floor(raw / 1440);
    let s = raw - dayShift * 1440;
    if(s < 0){ dayShift -= 1; s += 1440; }
    s = dvRoundMin(s);
    if(s + dur > 1440) s = 1440 - dur;
    d.dayShift = dayShift; d.curStart = s; d.curEnd = s + dur;
    d.el.style.top = ((s - (d.baseMin||0)) * DV_PXM) + "px";
    if(d.scroll) dvAutoScroll(d.scroll, e.clientY);
    updateGridLabel(d);
  } else if(d.mode==="resize-end"){
    const dm = dy / DV_PXM;
    let ende = dvRoundMin(d.origEnd + dm);
    if(ende < d.origStart + DV_SNAP) ende = d.origStart + DV_SNAP;
    if(ende > 1440) ende = 1440;
    d.curEnd = ende;
    d.el.style.height = Math.max((ende - d.curStart) * DV_PXM, 20) + "px";
    updateGridLabel(d);
  } else if(d.mode==="move-day"){
    positionGhost(d, e);
    if(d.el.closest("#calGrid")){
      clearDropTarget();
      const day = dropDayAt(e.clientX, e.clientY);
      d.dropKey = day ? day.dataset.date : d.origKey;
      if(day) day.classList.add("drop-target");
    } else {
      d.dayShift = Math.round(dx / d.pxDay);
    }
    updateGhostText(d);
  } else if(d.mode==="resize-span"){
    d.curSpan = Math.max(1, d.origSpan + Math.round(dx / d.pxDay));
    positionGhost(d, e);
    if(d.ghost) d.ghost.textContent = d.curSpan + (d.curSpan===1 ? " Tag" : " Tage");
  }
  e.preventDefault();
});
window.addEventListener("pointerup", function(){
  const d = dvDragState;
  if(!d) return;
  dvDragState = null;
  if(d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
  clearDropTarget();
  d.el.classList.remove("dragging");
  if(!d.moved) return;
  let changed = true;
  if(d.mode==="move-time" || d.mode==="resize-end") commitTime(d);
  else if(d.mode==="move-day"){
    const key = d.el.closest("#calGrid") ? d.dropKey : iso(addDays(parseISO(d.origKey), d.dayShift));
    changed = !!key && key !== d.origKey;
    if(changed){ d.dropKey = key; commitMoveDay(d); }
  } else if(d.mode==="resize-span"){
    changed = d.curSpan !== d.origSpan;
    if(changed) commitSpan(d);
  } else { changed = false; }
  if(!changed) return;
  window.__dvDrag = true;
  setTimeout(function(){ window.__dvDrag = false; }, 80);
  save();
  render();
  if(d.mode==="move-day" && d.dropKey && d.dropKey !== d.origKey){
    toast("Verschoben nach " + dvShortDate(d.dropKey));
  }
});

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
/* Wiederholende Termine */
function eventIsDone(e){
  if(!e || !e.repeat || e.repeat==="none") return !!e.done;
  return taskIsDone(Object.assign({}, e));
}
function recurrenceStart(ev, key){
  if(!ev.repeat || ev.repeat==="none") return "";
  const start = parseISO(ev.date);
  const k = parseISO(key);
  if(k < start) return "";
  if(ev.repeat==="daily" || ev.repeat==="weekly"){
    const step = ev.repeat==="daily" ? 1 : 7;
    const diff = Math.round((k - start) / 86400000);
    return iso(addDays(start, Math.floor(diff/step)*step));
  }
  const stepM = ev.repeat==="monthly" ? 1 : ev.repeat==="quarterly" ? 3 : 12;
  const sm = start.getFullYear()*12 + start.getMonth();
  const km = k.getFullYear()*12 + k.getMonth();
  return iso(new Date(start.getFullYear(), start.getMonth() + Math.floor((km-sm)/stepM)*stepM, start.getDate()));
}
function eventOccursOn(ev, key){
  const occ = recurrenceStart(ev, key);
  if(!occ) return false;
  const span = Math.max(1, evDays(ev));
  return key >= occ && key <= iso(addDays(parseISO(occ), span-1));
}
function eventCovers(ev, key){
  if(!ev || typeof ev.date!=="string" || !ev.date) return false;
  if(ev.repeat && ev.repeat!=="none") return eventOccursOn(ev, key);
  return key >= ev.date && key <= evEndKey(ev);
}
function eventRepLabel(ev){
  return (ev && ev.repeat && ev.repeat!=="none") ? repLabel(ev.repeat) : "";
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
  S.events.push(Object.assign({}, src, {id:uid(), done:false, lastDone:null, date:key,
    endDate: span>1 ? iso(addDays(parseISO(key), span-1)) : ""}));
  save(); renderCalendar();
  toast("Kopiert nach "+key.split("-").reverse().join("."));
}
function eventsOn(key){
  return S.events.filter(e=>inProfile(e.cat) && eventCovers(e, key))
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
  const repL = eventRepLabel(ev);
  const rep = repL ? '<span class="rep" title="Wiederholt sich: '+esc(repL)+'">↻</span>' : "";
  const tip = esc(ev.title) + (n>1 ? " ("+evSpanLabel(ev)+")" : "") + (repL ? " · "+esc(repL) : "");
  const canResize = !eventIsDone(ev) && (ev.allDay || n>1);
  return '<div class="ev'+(ev.id===copyEvId?" copysrc":"")+(eventIsDone(ev)?" done":"")+'" data-ev="'+ev.id+'" style="background:'+c.color+'" title="'+tip+'">'
       + '<button class="ev-copy" data-copy="'+ev.id+'" title="Termin kopieren">⧉</button>'
       + t + marker + rep + "<span>" + esc(ev.title) + "</span>"
       + (canResize ? '<span class="chip-resize" title="Dauer ändern"></span>' : "")
       + "</div>";
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
  var canResize = !taskIsDone(t) && (taskIsAllDay(t) || taskSpanDays(t)>1);
  return '<div class="task-chip'+(taskIsDone(t)?" done":"")+(isTaskOverdue(t)?" overdue":"")+'" data-task-open="'+t.id+'" style="--tc:'+c.color+'" title="'+tip+'">'
       + (st ? '<span class="t">'+esc(st)+'</span>' : '')
       + '<span class="mark" aria-hidden="true">✓</span>'
       + '<span>'+esc(t.title)+'</span>'
       + (canResize ? '<span class="chip-resize" title="Dauer ändern"></span>' : "")
       + '</div>';
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
    const repL = eventRepLabel(ev);
    return '<div class="ag-item'+(eventIsDone(ev)?" done":"")+'" data-ev="'+ev.id+'" style="--c:'+c.color+'">'
      + '<div class="when">'+(ev.allDay?"ganztägig":esc((ev.start||"—")+"–"+(ev.end||"")))+"</div>"
      + "<div><div class=\"ttl\">"+esc(ev.title)+"</div>"
      + '<div class="sub"><span class="pill" style="background:'+c.color+'">'+esc(c.name)+"</span>"
      + (evDays(ev)>1 ? " · "+ICON_CAL+" "+esc(ev.date.split("-").reverse().join("."))+"–"+esc(evEndKey(ev).split("-").reverse().join(".")) : "")
      + (repL ? " · 🔁 "+esc(repL) : "")
      + (ev.note ? " · "+esc(ev.note) : "") + "</div></div>"
      + '<div class="ag-actions"><button type="button" class="linkbtn act" data-ev-edit="'+ev.id+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
      + '<button type="button" class="linkbtn act" data-copy="'+ev.id+'">⧉ Kopieren</button>'
      + '<button type="button" class="linkbtn act del" data-evdel="'+ev.id+'" title="Löschen">'+ICON_TRASH+'</button></div>'
      + "</div>";
  }).join("");
  const tkHtml = tks.map(t=>{
    const c = cat(t.cat);
    const idx = S.todos.indexOf(t);
    const tDone = taskIsDone(t);
    const tOver = !tDone && isTaskOverdue(t);
    return '<div class="ag-item task'+(tDone?" done":"")+(tOver?" overdue":"")+'" style="--c:'+c.color+'">'
      + '<button type="button" class="task-check'+(tDone?" on":"")+'" data-task-toggle="'+idx+'" title="'+(tDone?"Wieder öffnen":"Erledigt abhaken")+'">'+(tDone?"✓":"")+'</button>'
      + '<div class="when">'+(taskIsAllDay(t)?"ganztägig":esc(taskStartTime(t))+(taskEndTime(t)?"–"+esc(taskEndTime(t)):""))+'</div>'
      + '<div class="tclick" data-task-open="'+t.id+'"><div class="ttl">'+esc(t.title)+'</div>'
      + '<div class="sub"><span class="pill" style="background:'+c.color+'">'+esc(c.name)+'</span>'
      + (tOver ? " "+overdueBadge(t,false) : "")
      + (!tOver && spanTxt(t) ? " · "+ICON_CAL+" "+esc(spanTxt(t)) : "")
      + (t.note ? " · "+esc(t.note) : "") + "</div></div>"
      + '<div class="ag-actions"><button type="button" class="linkbtn act" data-task-edit="'+idx+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
      + '<button type="button" class="linkbtn act del" data-task-del="'+idx+'" title="Löschen">'+ICON_TRASH+'</button></div>'
      + "</div>";
  }).join("");
  box.innerHTML = evHtml + tkHtml;
  clampTitles(box);
}

var __el=document.getElementById("calGrid"); if(__el)__el.addEventListener("click", e=>{
  if(window.__dvDrag) return;
  const tOpen = e.target.closest("[data-task-open]");
  if(tOpen){ openInfo("task", tOpen.dataset.taskOpen); return; }
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
  if(evBtn){ openInfo("ev", evBtn.dataset.ev); return; }
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
  const ed = e.target.closest("[data-ev-edit]");
  if(ed){ openEvent(ed.dataset.evEdit); return; }
  const del = e.target.closest("[data-evdel]");
  if(del){ 
    if(copyEvId && e.target.closest("[data-copy]")) return;
    deleteEvent(del.dataset.evdel); return; 
  }
  const cp = e.target.closest("[data-copy]");
  if(cp){ setCopyEv(cp.dataset.copy); return; }
  const tOpen = e.target.closest("[data-task-open]");
  if(tOpen){ openInfo("task", tOpen.dataset.taskOpen); return; }
  const ev = e.target.closest("[data-ev]");
  if(ev){ openInfo("ev", ev.dataset.ev); }
});
var __el=document.getElementById("calGrid"); if(__el)__el.addEventListener("dblclick", e=>{
  const tev=e.target.closest("[data-ev]");
  if(tev){ closeModals(); openEvent(tev.dataset.ev); return; }
  const tto=e.target.closest("[data-task-open]");
  if(tto){ closeModals(); const tt=S.todos.find(x=>x.id===tto.dataset.taskOpen); if(tt) openTodo(tt.id,"task"); return; }
  if(e.target.closest("[data-new],[data-copy]")) return;
  const day=e.target.closest(".day");
  if(day){ selDate=parseISO(day.dataset.date); setCalMode("day"); }
});
var __cms=document.getElementById("calModeSeg"); if(__cms)__cms.addEventListener("click", e=>{
  const b=e.target.closest("[data-calmode]");
  if(b) setCalMode(b.dataset.calmode);
});
var __dfb=document.getElementById("dayFullBtn"); if(__dfb)__dfb.addEventListener("click", ()=>{
  dvFullDay=!dvFullDay; renderDayView(); updateCalModeUI();
});
var __dv=document.getElementById("dayView"); if(__dv){
  __dv.addEventListener("dblclick", function(e){
    const tev=e.target.closest("[data-ev]");
    if(tev){ closeModals(); openEvent(tev.dataset.ev); return; }
    const tto=e.target.closest("[data-task-open]");
    if(tto){ closeModals(); const tt=S.todos.find(x=>x.id===tto.dataset.taskOpen); if(tt) openTodo(tt.id,"task"); return; }
  }, true);
  __dv.addEventListener("click", function(e){
    if(window.__dvDrag) return;
    const tchk=e.target.closest(".task-toggle");
    if(tchk){
      const id=tchk.getAttribute("data-task-toggle-id") || (tchk.closest("[data-task-open]") && tchk.closest("[data-task-open]").dataset.taskOpen);
      if(id){
        var idx=S.todos.findIndex(function(x){return x&&x.id===id;});
        if(idx>=0){
          var tk=S.todos[idx];
          setTaskDone(tk, !taskIsDone(tk));
          e.stopPropagation();
          save(); renderCalendar(); renderTasks(); updateBadges();
          return;
        }
      }
    }
    const tto=e.target.closest("[data-task-open]");
    if(tto){ openInfo("task", tto.dataset.taskOpen); return; }
    const tev=e.target.closest("[data-ev]");
    if(tev){ openInfo("ev", tev.dataset.ev); return; }
    const grid=e.target.closest(".dv-grid");
    if(grid){
      const rect=grid.getBoundingClientRect();
      const baseMin=Number(grid.dataset.base)||0;
      let min=Math.round((((e.clientY-rect.top)/DV_PXM)+baseMin)/30)*30;
      if(isNaN(min)) return;
      min=Math.max(0,Math.min(min,1440-30));
      openEvent(null, grid.dataset.date, dvHM(min));
    }
  }, true);
}
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
document.addEventListener("click", function(e){
  var t = e.target;
  if(window.__dvDrag) return;
  if(t.closest&&t.closest('[data-task-toggle]')){
    var elT=t.closest('[data-task-toggle]');
    var tid=elT.getAttribute('data-task-toggle-id');
    var ti=parseInt(elT.getAttribute('data-task-toggle'));
    if(isNaN(ti)&&tid){ ti = S.todos.findIndex(function(x){return x&&x.id===tid}); }
    if(ti<0 && tid && t.closest&&t.closest('[data-task-open]')){
      var to=t.closest('[data-task-open]');
      ti = S.todos.findIndex(function(x){return x&&x.id===to.dataset.taskOpen});
    }
    if(ti>=0&&Array.isArray(S.todos)&&S.todos[ti]){
      var tk=S.todos[ti];
      var newDone = !taskIsDone(tk);
      setTaskDone(tk, newDone);
      e.stopPropagation();
      save(); renderCalendar(); renderTasks(); updateBadges();
      return;
    }
  }
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
  document.getElementById("evAllDay").checked = e ? !!e.allDay : false;
  document.getElementById("evStart").value = e && e.start ? e.start : (start || "09:00");
  document.getElementById("evEnd").value = e && e.end ? e.end
    : (start ? dvHM(Math.min(hmToMin(start)+30, 1439)) : "09:30");
  document.getElementById("evDur").value = "";
  document.getElementById("evDurUnit").value = "60";
  if(e && !e.allDay && e.start && e.end) evSetDurFromTimes();
  document.getElementById("evNote").value = e ? (e.note||"") : "";
  document.getElementById("evDelete").style.display = e ? "" : "none";
  document.getElementById("evResched").style.display = e ? "" : "none";
  document.getElementById("evDoneField").style.display = e ? "" : "none";
  document.getElementById("evDone").checked = e ? eventIsDone(e) : false;
  const evRep = document.getElementById("evRepeat");
  if(evRep) evRep.value = e ? (e.repeat || "none") : "none";
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
  const repeat = document.getElementById("evRepeat").value;
  const done = document.getElementById("evDone").checked;
  const data = {
    title, date, endDate,
    cat: document.getElementById("evCat").value,
    allDay,
    start: allDay ? "" : document.getElementById("evStart").value,
    end: allDay ? "" : document.getElementById("evEnd").value,
    note: document.getElementById("evNote").value.trim(),
    repeat, done
  };
  if(editingEvent) Object.assign(editingEvent, data);
  else S.events.push(Object.assign({id:uid()}, data));
  const saved = editingEvent || S.events[S.events.length-1];
  if(repeat && repeat!=="none"){
    if(done){ saved.lastDone = iso(today()); saved.completedAt = new Date().toISOString(); delete saved.done; }
    else { saved.lastDone = null; delete saved.completedAt; }
  } else {
    delete saved.lastDone; delete saved.completedAt;
  }
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
   Neu planen – Schnellverschieben (Bearbeiten- & Anzeige-Dialog)
   ========================================================= */
var reschedTarget = null; // "ev" (Termin) | "td" (Aufgabe) – Bearbeiten-Dialog: Felder füllen
var reschedCommit = null; // {kind:"ev"|"task", id} – Anzeige-Dialog: direkt setzen und speichern

function reschedDow(d){ return DOW_FULL[d.getDay()].slice(0,2); }
/* Nächster Montag (ist heute Montag, dann +7 Tage). */
function nextMonday(){
  var d = today(), dow = d.getDay();
  var add = (dow === 1) ? 7 : ((8 - dow) % 7 || 7);
  return addDays(d, add);
}
/* Ende = Start + Dauer, auf 23:59 begrenzt (kein Sprung auf 00:00). */
function reschedEndHM(startHM, durMin){
  var m = hmToMin(startHM) + (durMin || 60);
  if(m > 1439) m = 1439;
  return dvHM(m);
}
/* Vorhandene Dauer (Minuten) aus Von/Bis übernehmen, sonst 60. */
function reschedKeepDur(s, e){
  if(s && e){ var d = hmToMin(e) - hmToMin(s); if(d <= 0) d += 1440; if(d > 0 && d <= 1440) return d; }
  return 60;
}
function applyResched(dateIso, timeStr){
  /* timeStr === "keep": Datum ändern, aber Von/Bis-Zeit beibehalten. */
  var keep = (timeStr === "keep");
  if(reschedTarget === "ev"){
    var allDay = keep ? document.getElementById("evAllDay").checked : !timeStr;
    document.getElementById("evDate").value = dateIso;
    document.getElementById("evEndDate").value = "";
    var daysEl = document.getElementById("evDays"); if(daysEl) daysEl.value = 1;
    document.getElementById("evAllDay").checked = allDay;
    if(!keep){
      if(allDay){
        document.getElementById("evStart").value = "";
        document.getElementById("evEnd").value = "";
      }else{
        var st = document.getElementById("evStart").value;
        var en = document.getElementById("evEnd").value;
        document.getElementById("evStart").value = timeStr;
        document.getElementById("evEnd").value = reschedEndHM(timeStr, reschedKeepDur(st, en));
      }
    }
    document.getElementById("evDur").value = "";
    toggleTimeFields();
    updateSpan();
  }else if(reschedTarget === "td"){
    var allDay2 = keep ? document.getElementById("tdAllDay").checked : !timeStr;
    document.getElementById("tdStart").value = dateIso;
    document.getElementById("tdEnd").value = "";
    document.getElementById("tdAllDay").checked = allDay2;
    if(!keep){
      if(allDay2){
        document.getElementById("tdStartTime").value = "";
        document.getElementById("tdEndTime").value = "";
      }else{
        var st2 = document.getElementById("tdStartTime").value;
        var en2 = document.getElementById("tdEndTime").value;
        document.getElementById("tdStartTime").value = timeStr;
        document.getElementById("tdEndTime").value = reschedEndHM(timeStr, reschedKeepDur(st2, en2));
      }
    }
    document.getElementById("tdDur").value = "";
    toggleTdTimeFields();
    updateTdSpan();
  }
}
function buildReschedList(){
  var t = today(), tm = addDays(t, 1), nm = nextMonday();
  var opts = [
    { k:"t-allday", label:"Heute im Laufe des Tages" },
    { k:"t-time",   label:"17:00" },
    { k:"m-allday", label:"Morgen" },
    { k:"m-time",   label:reschedDow(tm)+", 10:00" },
    { k:"w-allday", label:"Nächste Woche" },
    { k:"w-time",   label:reschedDow(nm)+", 10:00" },
    { k:"custom",   label:"Benutzerdefiniert", custom:true }
  ];
  document.getElementById("reschedList").innerHTML = opts.map(function(o){
    return '<button type="button" class="resched-opt'+(o.custom?" custom":"")+'" data-opt="'+o.k+'">'+esc(o.label)+"</button>";
  }).join("");
  document.getElementById("reschedCustom").hidden = true;
  document.getElementById("reschedDate").value = iso(t);
  document.getElementById("reschedTime").value = "";
}
function openResched(target){
  reschedTarget = target; reschedCommit = null;
  buildReschedList();
  openModal("reschedModal");
}
/* Aus dem Anzeige-Dialog: Datum/Uhrzeit sofort am Eintrag setzen und speichern. */
function openReschedInfo(kind, id){
  reschedTarget = null; reschedCommit = { kind:(kind==="ev"?"ev":"task"), id:id };
  buildReschedList();
  openModal("reschedModal");
}
function applyReschedInfo(dateIso, timeStr){
  var rc = reschedCommit; if(!rc) return;
  /* timeStr === "keep": Datum ändern, Von/Bis-Zeit (bzw. Ganztägig) beibehalten. */
  var keep = (timeStr === "keep");
  if(rc.kind === "ev"){
    var e = S.events.find(function(x){ return x.id===rc.id; }); if(!e) return;
    var dur = 60;
    if(!e.allDay && e.start && e.end){ var d=hmToMin(e.end)-hmToMin(e.start); if(d<=0) d+=1440; if(d>0&&d<=1440) dur=d; }
    e.date = dateIso; e.endDate = "";
    if(keep){ /* e.allDay / e.start / e.end unverändert */ }
    else if(timeStr){ e.allDay = false; e.start = timeStr; e.end = reschedEndHM(timeStr, dur); }
    else { e.allDay = true; e.start = ""; e.end = ""; }
  }else{
    var t = S.todos.find(function(x){ return x.id===rc.id; }); if(!t) return;
    var dur2 = 60;
    if(!t.allDay && t.startTime && t.endTime){ var d2=hmToMin(t.endTime)-hmToMin(t.startTime); if(d2<=0) d2+=1440; if(d2>0&&d2<=1440) dur2=d2; }
    t.startDate = dateIso; t.endDate = "";
    if(keep){ /* t.allDay / t.startTime / t.endTime unverändert */ }
    else if(timeStr){ t.allDay = false; t.startTime = timeStr; t.endTime = reschedEndHM(timeStr, dur2); }
    else { t.allDay = true; t.startTime = ""; t.endTime = ""; }
  }
  reschedCommit = null;
  save(); closeModals(); render();
  toast("Neu geplant.");
}
function commitResched(dateIso, timeStr){
  if(reschedCommit){ applyReschedInfo(dateIso, timeStr); return; }
  applyResched(dateIso, timeStr);
  closeResched();
  toast("Neu geplant – mit „Speichern“ übernehmen.");
}
function closeResched(){
  var m = document.getElementById("reschedModal"); if(m) m.classList.remove("open");
}
var __rl = document.getElementById("reschedList");
if(__rl) __rl.addEventListener("click", function(e){
  var b = e.target.closest("[data-opt]"); if(!b) return;
  var k = b.dataset.opt;
  if(k === "custom"){ document.getElementById("reschedCustom").hidden = false; return; }
  var t = today(), tm = addDays(t, 1), nm = nextMonday();
  var map = {
    "t-allday":[iso(t),""],  "t-time":[iso(t),"17:00"],
    "m-allday":[iso(tm),"keep"], "m-time":[iso(tm),"10:00"],
    "w-allday":[iso(nm),"keep"], "w-time":[iso(nm),"10:00"]
  };
  var v = map[k]; if(!v) return;
  commitResched(v[0], v[1]);
});
var __ra = document.getElementById("reschedApply");
if(__ra) __ra.addEventListener("click", function(){
  var d = document.getElementById("reschedDate").value;
  if(!d){ toast("Bitte ein Datum wählen."); return; }
  commitResched(d, document.getElementById("reschedTime").value || "");
});
var __er = document.getElementById("evResched");
if(__er) __er.addEventListener("click", function(){ openResched("ev"); });
var __tr = document.getElementById("tdResched");
if(__tr) __tr.addEventListener("click", function(){ openResched("td"); });
var __ib = document.getElementById("infoBody");
if(__ib) __ib.addEventListener("click", function(e){
  if(e.target.closest("[data-info-resched]")){ if(infoRef) openReschedInfo(infoRef.kind, infoRef.id); }
});

/* =========================================================
   Anzeige-Dialog (Info) – Einzelklick auf Termin/Aufgabe
   ========================================================= */
let infoRef = null;
function infoDateLong(dateIso){
  if(!dateIso) return "";
  const d = parseISO(dateIso);
  return DOW_FULL[d.getDay()] + ", " + d.getDate() + ". " + MONTHS[d.getMonth()] + " " + d.getFullYear();
}
function infoRow(label, value){
  if(value==null || value==="") return "";
  return '<div class="info-row"><span class="info-lbl">'+label+'</span><span class="info-val">'+value+'</span></div>';
}
function infoTimeRange(s, e){
  if(!s) return "";
  return esc(s) + (e ? " – "+esc(e) : "");
}
function infoNote(note){
  return note ? esc(note).replace(/\n/g,"<br>") : "";
}
/* Uhrzeit-Zeile; optional mit Symbol „Neu planen“ rechts. */
function infoTimeRow(value, withBtn){
  var btn = withBtn
    ? '<button type="button" class="icon-act icon-act-row" data-info-resched title="Neu planen" aria-label="Neu planen">'+ICON_RESCHED+'</button>'
    : "";
  return '<div class="info-row"><span class="info-lbl">Uhrzeit</span><span class="info-val info-val-act"><span>'+value+'</span>'+btn+'</span></div>';
}
function openInfo(kind, id){
  let obj;
  if(kind==="ev") obj = S.events.find(e=>e.id===id);
  else if(kind==="routine") obj = S.routines.find(r=>r.id===id) || S.routines[Number(id)];
  else obj = S.todos.find(t=>t.id===id);
  if(!obj) return;
  infoRef = {kind:kind, id:id, obj:obj};
  const c = cat(obj.cat);
  const catEl = document.getElementById("infoCat");
  catEl.textContent = c.name;
  catEl.style.background = c.color;
  document.getElementById("infoTitle").textContent = obj.title || obj.name || "(ohne Titel)";

  let body = "";
  if(kind==="ev"){
    if(evDays(obj) > 1){
      body += infoRow("Zeitraum", esc(infoDateLong(obj.date))+" – "+esc(infoDateLong(evEndKey(obj)))+" ("+evSpanLabel(obj)+")");
    } else {
      body += infoRow("Datum", esc(infoDateLong(obj.date)));
    }
    body += infoTimeRow(obj.allDay ? "Ganztägig" : infoTimeRange(obj.start, obj.end), true);
    body += infoRow("Wiederholung", repLabel(obj.repeat));
    body += infoRow("Bereich", esc(c.name));
    body += infoRow("Notiz", infoNote(obj.note));
  } else if(kind==="routine"){
    body += infoRow("Wiederholung", repLabel(obj.freq));
    body += infoRow("Uhrzeit", (obj.time && obj.time!=="any") ? esc(obj.time) : "Flexibel");
    body += infoRow("Bereich", esc(c.name));
    body += infoRow("Punkte", obj.points ? String(obj.points)+" "+ICON_STAR : "");
    body += infoRow("Notiz", infoNote(obj.note));
  } else {
    const s = taskDate(obj);
    const en = (obj.endDate && obj.endDate>s) ? obj.endDate : "";
    if(en) body += infoRow("Zeitraum", esc(infoDateLong(s))+" – "+esc(infoDateLong(en)));
    else if(s) body += infoRow("Datum", esc(infoDateLong(s)));
    body += infoTimeRow(taskIsAllDay(obj) ? "Ganztägig" : infoTimeRange(taskStartTime(obj), taskEndTime(obj)), true);
    body += infoRow("Bereich", esc(c.name));
    body += infoRow("Wiederholung", repLabel(obj.repeat));
    body += infoRow("Punkte", obj.points ? String(obj.points)+" "+ICON_STAR : "");
    body += infoRow("Notiz", infoNote(obj.note));
  }
  document.getElementById("infoBody").innerHTML = body;

  const doneNow = (kind==="ev") ? eventIsDone(obj) : (kind==="routine") ? routineIsDone(obj) : taskIsDone(obj);
  document.getElementById("infoDone").checked = doneNow;
  document.getElementById("infoDoneAt").textContent = (doneNow && obj.completedAt) ? fmtCompletedAt(obj.completedAt) : "";
  openModal("infoModal");
}
document.getElementById("infoDone").onchange = function(){
  if(!infoRef || !infoRef.obj) return;
  const on = this.checked;
  const ref = infoRef, obj = ref.obj;
  if(ref.kind==="ev"){
    toggleEventDone(ref.id, on);
  } else if(ref.kind==="routine"){
    setRoutineDone(obj, on);
    save(); render();
  } else {
    setTaskDone(obj, on);
    save(); render();
  }
  document.getElementById("infoDoneAt").textContent = (on && obj.completedAt) ? fmtCompletedAt(obj.completedAt) : "";
};
document.getElementById("infoEdit").onclick = function(){
  if(!infoRef || !infoRef.obj) return;
  const ref = infoRef;
  closeModals();
  if(ref.kind==="ev") openEvent(ref.id);
  else if(ref.kind==="routine") openTodo(S.routines.indexOf(ref.obj), "routine");
  else openTodo(ref.id, "task");
};
document.getElementById("infoDelete").onclick = function(){
  if(!infoRef || !infoRef.obj) return;
  const ref = infoRef, obj = ref.obj;
  infoRef = null;
  if(ref.kind==="ev"){
    deleteEvent(ref.id);
  } else if(ref.kind==="routine"){
    const idx = S.routines.indexOf(obj);
    if(idx>=0){
      const removed = S.routines.splice(idx,1)[0];
      save(); closeModals(); render();
      showUndo('Routine gelöscht', function(){ S.routines.splice(Math.min(idx,S.routines.length),0,removed); save(); render(); });
    }
  } else {
    S.todos = S.todos.filter(t=>t.id!==ref.id);
    save(); closeModals(); render(); toast("Aufgabe gelöscht.");
  }
};

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
    + (due ? "<span>"+ICON_CAL+" "+due+"</span>" : "")
    + (t.points ? '<span class="plus-points">+'+t.points+" "+ICON_STAR+'</span>' : "")
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
var __btnNewTaskCal=document.getElementById("btnNewTaskCal"); if(__btnNewTaskCal) __btnNewTaskCal.onclick = ()=>openTodo(null, "task");
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
  var doneAtEl=document.getElementById("tdDoneAt");
  if(doneAtEl) doneAtEl.textContent = (e && taskIsDone(e) && e.completedAt) ? fmtCompletedAt(e.completedAt) : "";
  document.getElementById("tdTime").value = (e && e.time && e.time!=="any") ? e.time : "";
  document.getElementById("tdStart").value = (e && e.startDate) ? e.startDate : "";
  document.getElementById("tdEnd").value = (e && e.endDate) ? e.endDate : "";
  const tdAllDay = e ? (e.allDay !== false) : false;
  document.getElementById("tdAllDay").checked = tdAllDay;
  const newTask = !e && !isR;
  document.getElementById("tdStartTime").value = (e && e.startTime) ? e.startTime : "";
  document.getElementById("tdEndTime").value = (e && e.endTime) ? e.endTime : "";
  document.getElementById("tdDur").value = newTask ? "30" : "";
  document.getElementById("tdDurUnit").value = newTask ? "1" : "60";
  if(!tdAllDay && e && e.startTime && e.endTime) setDurFromTimes();
  updateTdSpan();
  document.getElementById("tdRoutineTimeField").style.display = isR ? "" : "none";
  document.getElementById("tdSpanFields").style.display = isR ? "none" : "";
  document.getElementById("tdAllDayField").style.display = isR ? "none" : "";
  if(isR){ document.getElementById("tdTimeFields").style.display="none"; document.getElementById("tdDurFields").style.display="none"; }
  else { toggleTdTimeFields(); }
  document.getElementById("tdNote").value = (e && e.note) ? e.note : "";
  document.getElementById("tdDelete").style.display = e ? "" : "none";
  document.getElementById("tdResched").style.display = editingTodo ? "" : "none";
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
    else {
      if(Array.isArray(S.routines) && S.routines.some(function(r){ return routineIdentity(r)===routineIdentity(data); })){
        toast("Diese Routine gibt es schon."); return;
      }
      S.routines.push(Object.assign({id:uid(), done:false, lastDone:null, completedAt:null}, data));
    }
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
function activeList(){ var ls=Array.isArray(S.lists)?S.lists:[]; return ls.find(l=>l.id===curList) || ls[0]; }
function renderLists(){
  if(!Array.isArray(S.lists)) S.lists = [];
  if(!activeList()) curList = S.lists[0] && S.lists[0].id;
  const act = activeList();
  document.getElementById("listTabs").innerHTML = S.lists.map(l=>
    '<span class="list-tab">'
    + '<button class="btn sm'+(act && l.id===act.id?" primary":"")+'" data-list="'+l.id+'">'+esc(l.name)+"</button>"
    + (act && l.id===act.id ? '<button type="button" class="list-tab-edit" data-list-edit="'+l.id+'" title="Liste umbenennen / löschen" aria-label="Liste bearbeiten">'+ICON_EDIT+"</button>" : "")
    + "</span>"
  ).join("");
  const L = act;
  if(!L){
    document.getElementById("shopProgress").textContent = "0%";
    document.getElementById("shopBar").style.width = "0%";
    document.getElementById("shopList").innerHTML = '<div class="empty"><span class="big">📝</span>Noch keine Liste – lege mit „+ Neue Liste“ eine an.</div>';
    try{ renderBirthdays(); }catch(e){}
    return;
  }
  if(!Array.isArray(L.items)) L.items = [];
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
  try{ renderBirthdays(); }catch(e){}
}
var __el=document.getElementById("view-lists"); if(__el)__el.addEventListener("click", e=>{
  const le = e.target.closest("[data-list-edit]");
  if(le){ openListEdit(le.dataset.listEdit); return; }
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
  const L = activeList();
  if(!L){ toast("Bitte zuerst eine Liste anlegen."); return; }
  if(!Array.isArray(L.items)) L.items = [];
  L.items.push({id:uid(), name, qty:q.value.trim(), done:false});
  inp.value=""; q.value=""; save(); renderLists(); inp.focus();
}
document.getElementById("shopAdd").onclick = addItem;
document.getElementById("btnNewShopItem").onclick = ()=>document.getElementById("shopInput").focus();
var __el=document.getElementById("shopInput"); if(__el)__el.addEventListener("keydown", e=>{ if(e.key==="Enter") addItem(); });
var __el=document.getElementById("shopQty"); if(__el)__el.addEventListener("keydown", e=>{ if(e.key==="Enter") addItem(); });
document.getElementById("btnClearDone").onclick = ()=>{
  const L = activeList(); if(!L) return;
  if(!Array.isArray(L.items)) L.items = [];
  L.items = L.items.filter(i=>!i.done); save(); renderLists();
};
/* Liste anlegen / umbenennen / löschen */
var editingList = null;
function openListEdit(id){
  const l = id ? (Array.isArray(S.lists)?S.lists:[]).find(x=>x.id===id) : null;
  editingList = l || null;
  const ttl = document.getElementById("listModalTitle");
  if(ttl) ttl.textContent = l ? "Liste bearbeiten" : "Neue Liste";
  document.getElementById("listName").value = l ? (l.name||"") : "";
  const del = document.getElementById("listDelete");
  if(del) del.style.display = l ? "" : "none";
  const sv = document.getElementById("listSave");
  if(sv) sv.textContent = l ? "Speichern" : "Anlegen";
  openModal("listModal");
  setTimeout(()=>{ try{ const f=document.getElementById("listName"); f.focus(); f.select(); }catch(e){} }, 30);
}
function deleteList(id){
  if(!Array.isArray(S.lists)) return;
  const idx = S.lists.findIndex(x=>x.id===id);
  if(idx<0) return;
  const removed = S.lists.splice(idx,1)[0];
  if(curList===id) curList = S.lists[0] ? S.lists[0].id : null;
  editingList = null;
  save(); closeModals(); renderLists();
  showUndo("Liste gelöscht", function(){
    S.lists.splice(Math.min(idx, S.lists.length), 0, removed);
    curList = removed.id;
    save(); renderLists();
  });
}
document.getElementById("btnNewList").onclick = ()=> openListEdit(null);
document.getElementById("listSave").onclick = ()=>{
  const n = document.getElementById("listName").value.trim();
  if(!n){ toast("Bitte einen Namen eingeben."); return; }
  if(editingList){
    editingList.name = n;
    editingList = null;
    save(); closeModals(); renderLists(); toast("Liste umbenannt.");
  }else{
    const l = {id:uid(), name:n, items:[]};
    S.lists.push(l); curList = l.id;
    save(); closeModals(); renderLists(); toast("Liste angelegt.");
  }
};
var __listDelBtn = document.getElementById("listDelete");
if(__listDelBtn) __listDelBtn.onclick = ()=>{ if(editingList) deleteList(editingList.id); };
var __listNameInp = document.getElementById("listName");
if(__listNameInp) __listNameInp.addEventListener("keydown", e=>{ if(e.key==="Enter") document.getElementById("listSave").click(); });

/* =========================================================
   Geburtstage (unter „Listen“)
   ========================================================= */
function birthdaySortKey(b){ return ((b&&b.month)||0)*100 + ((b&&b.day)||0); }
/* Anzeige-Sortierung: aufsteigend im Verlauf des Jahres (Januar → Dezember). */
function birthdaysSorted(){
  return (Array.isArray(S.birthdays)?S.birthdays:[]).slice().sort(function(a,b){
    var ka=birthdaySortKey(a), kb=birthdaySortKey(b);
    if(ka!==kb) return ka-kb;
    return String(a.name||"").localeCompare(String(b.name||""),"de");
  });
}
function bdDaysInMonth(month, year){ return new Date(year||2000, month, 0).getDate(); }
function nextBirthdayDate(b){
  if(!b || !b.day || !b.month) return null;
  var t=today();
  var d=new Date(t.getFullYear(), b.month-1, b.day);
  if(d.getTime() < t.getTime()) d=new Date(t.getFullYear()+1, b.month-1, b.day);
  return d;
}
function daysUntilBirthday(b){
  var d=nextBirthdayDate(b); if(!d) return null;
  return Math.round((d.getTime()-today().getTime())/86400000);
}
function birthdayPassedThisYear(b){
  if(!b || !b.day || !b.month) return false;
  var t=today(), d=new Date(t.getFullYear(), b.month-1, b.day);
  return d.getTime() < t.getTime();
}
function birthdayAgeThisYear(b){
  if(!b || !b.year) return null;
  return today().getFullYear() - Number(b.year);
}
function bdDateText(b){ return b.day+"."+(b.month<10?"0":"")+b.month+"."; }
function bdCountdownText(d){
  if(d==null) return "";
  if(d===0) return "heute 🎉";
  if(d===1) return "morgen";
  return "in "+d+" Tagen";
}
/* Geburtstage im Kalender (Monatsraster) und in der Tagesansicht */
function birthdaysOn(key){
  var m=parseInt(String(key).slice(5,7),10), d=parseInt(String(key).slice(8,10),10);
  return (Array.isArray(S.birthdays)?S.birthdays:[]).filter(function(b){
    return b && Number(b.month)===m && Number(b.day)===d;
  }).sort(function(a,b){ return String(a.name||"").localeCompare(String(b.name||""),"de"); });
}
function bdAgeAt(b, year){
  if(!b || !b.year || !year) return null;
  return year - Number(b.year);
}
function bdChipHTML(b, key){
  var age=bdAgeAt(b, parseInt(String(key).slice(0,4),10));
  var tip="Geburtstag: "+esc(b.name)+(age!=null?" · wird "+age:"");
  return '<div class="ev bd-cal" title="'+tip+'">'
    + '<span class="bd-ico" aria-hidden="true">🎂</span>'
    + "<span>"+esc(b.name)+"</span>"
    + (age!=null ? '<span class="bd-age">· '+age+'</span>' : '')
    + "</div>";
}
/* Vorwarnung am Tag vor dem Geburtstag – dezent, passend zum Warn-Dialog („Geburtstag morgen“) */
function bdEveChipHTML(b, year){
  var age=bdAgeAt(b, year);
  var tip="Geburtstag morgen: "+esc(b.name)+(age!=null?" · wird "+age:"");
  return '<div class="ev bd-cal bd-eve" title="'+tip+'">'
    + '<span class="bd-ico" aria-hidden="true">🎂</span>'
    + '<span>Morgen: '+esc(b.name)+(age!=null?" wird "+age:"")+'</span>'
    + "</div>";
}
function bdBannerHTML(b, year){
  var age=bdAgeAt(b, year);
  var tip="Geburtstag: "+esc(b.name)+(age!=null?" · wird "+age:"");
  return '<div class="dv-ad dv-ad-bd" title="'+tip+'">'
    + '<span class="bd-ico" aria-hidden="true">🎂</span>'
    + "<span>"+esc(b.name)+"</span>"
    + (age!=null ? '<span class="bd-age">wird '+age+'</span>' : '')
    + "</div>";
}
/* Vorwarnung am Tag vor dem Geburtstag – dezent, auch in der Ganztägig-Zeile der Tagesansicht */
function bdEveBannerHTML(b, year){
  var age=bdAgeAt(b, year);
  var tip="Geburtstag morgen: "+esc(b.name)+(age!=null?" · wird "+age:"");
  return '<div class="dv-ad dv-ad-bd dv-ad-eve" title="'+tip+'">'
    + '<span class="bd-ico" aria-hidden="true">🎂</span>'
    + "<span>Morgen: "+esc(b.name)+(age!=null?" wird "+age:"")+"</span>"
    + "</div>";
}
function bdRowHTML(b, isNext){
  var d=daysUntilBirthday(b), passed=birthdayPassedThisYear(b), age=birthdayAgeThisYear(b);
  var chip="";
  if(d!=null){
    if(d===0) chip='<span class="bd-chip hot">Heute 🎉</span>';
    else if(d===1) chip='<span class="bd-chip hot">Morgen</span>';
    else if(!passed) chip='<span class="bd-chip">in '+d+' Tagen</span>';
  }
  var sp=[];
  if(b.year) sp.push("Jg. "+esc(String(b.year)));
  if(age!=null) sp.push((passed?"wurde ":"wird ")+age);
  var sub=sp.length ? '<div class="it-sub">'+sp.join(" · ")+'</div>' : "";
  return '<div class="item bd-item'+(isNext?" next":"")+(passed?" past":"")+'">'
    + '<div class="bd-date"><b>'+b.day+'</b><span>'+esc(MONTHS_SHORT[b.month-1]||"")+'</span></div>'
    + '<div class="bd-main" data-bd-edit="'+b.id+'" role="button" tabindex="0" title="Bearbeiten">'
    +   '<div class="it-title">'+esc(b.name)+'</div>'+sub
    + '</div>'
    + chip
    + '<div class="it-actions">'
    +   '<button type="button" class="linkbtn act" data-bd-edit="'+b.id+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
    +   '<button type="button" class="linkbtn act del" data-bd-del="'+b.id+'" title="Löschen">'+ICON_TRASH+'</button>'
    + '</div>'
    + '</div>';
}
function renderBirthdays(){
  var box=document.getElementById("bdList"); if(!box) return;
  var list=birthdaysSorted();
  var cnt=document.getElementById("bdCount"); if(cnt) cnt.textContent=list.length;
  var sub=document.getElementById("bdNext");
  if(!list.length){
    box.innerHTML='<div class="empty"><span class="big">🎂</span>Noch keine Geburtstage erfasst.</div>';
    if(sub) sub.textContent="";
    return;
  }
  var next=null, nDays=null;
  list.forEach(function(b){ var d=daysUntilBirthday(b); if(d!=null && (nDays==null || d<nDays)){ next=b; nDays=d; } });
  if(sub){
    if(next) sub.innerHTML='Nächster: <b>'+esc(next.name)+'</b> · '+bdDateText(next)+' · '+bdCountdownText(nDays);
    else sub.textContent="";
  }
  box.innerHTML=list.map(function(b){ return bdRowHTML(b, next && b.id===next.id); }).join("");
  clampTitles(box);
}
var editingBirthday=null;
function openBirthday(id){
  var b = id ? (Array.isArray(S.birthdays)?S.birthdays:[]).find(function(x){ return x.id===id; }) : null;
  editingBirthday = b || null;
  var ttl=document.getElementById("bdModalTitle"); if(ttl) ttl.textContent = b ? "Geburtstag bearbeiten" : "Neuer Geburtstag";
  document.getElementById("bdName").value = b ? (b.name||"") : "";
  document.getElementById("bdDay").value = b && b.day ? b.day : "";
  document.getElementById("bdMonth").value = b && b.month ? b.month : 1;
  document.getElementById("bdYear").value = b && b.year ? b.year : "";
  var del=document.getElementById("bdDelete"); if(del) del.style.display = b ? "" : "none";
  openModal("bdModal");
  setTimeout(function(){ try{ document.getElementById("bdName").focus(); }catch(e){} },30);
}
function saveBirthday(){
  var name=document.getElementById("bdName").value.trim();
  var day=parseInt(document.getElementById("bdDay").value,10);
  var month=parseInt(document.getElementById("bdMonth").value,10);
  var yearRaw=document.getElementById("bdYear").value.trim();
  var year=yearRaw ? parseInt(yearRaw,10) : null;
  if(!name){ toast("Bitte einen Namen eingeben."); return; }
  if(!month || month<1 || month>12){ toast("Bitte einen Monat wählen."); return; }
  if(yearRaw!=="" && isNaN(year)){ toast("Bitte ein gültiges Jahr angeben."); return; }
  if(year!=null && (year<1900 || year>2100)){ toast("Bitte ein Jahr zwischen 1900 und 2100 angeben."); return; }
  if(!day || day<1 || day>bdDaysInMonth(month, year||2000)){ toast("Bitte einen gültigen Tag angeben."); return; }
  var wasEdit=!!editingBirthday;
  var data={name:name, day:day, month:month, year:year};
  if(wasEdit) Object.assign(editingBirthday, data);
  else { if(!Array.isArray(S.birthdays)) S.birthdays=[]; S.birthdays.push(Object.assign({id:uid()}, data)); }
  editingBirthday=null;
  save(); closeModals(); renderBirthdays(); try{ renderCalendar(); }catch(e){}
  toast(wasEdit ? "Geburtstag gespeichert." : "Geburtstag hinzugefügt.");
}
function deleteBirthday(id){
  if(!Array.isArray(S.birthdays)) return;
  var idx=S.birthdays.findIndex(function(x){ return x.id===id; });
  if(idx<0) return;
  var removed=S.birthdays.splice(idx,1)[0];
  editingBirthday=null;
  save(); closeModals(); renderBirthdays(); try{ renderCalendar(); }catch(e){}
  showUndo("Geburtstag gelöscht", function(){
    S.birthdays.splice(Math.min(idx,S.birthdays.length),0,removed);
    save(); renderBirthdays(); try{ renderCalendar(); }catch(e){}
  });
}
/* Warn-Dialog einen Tag vor dem Geburtstag (einmal pro Tag und Geburtstag). */
function checkBirthdayWarnings(){
  if(typeof S==="undefined" || !S) return;
  if(!Array.isArray(S.birthdays) || !S.birthdays.length) return;
  if(!S.settings) S.settings={};
  var t=today();
  var tm=new Date(t.getFullYear(), t.getMonth(), t.getDate()+1);
  var due=S.birthdays.filter(function(b){ return b && Number(b.month)===tm.getMonth()+1 && Number(b.day)===tm.getDate(); });
  if(!due.length) return;
  if(!S.settings.bdWarned || typeof S.settings.bdWarned!=="object") S.settings.bdWarned={};
  var warned=S.settings.bdWarned, tkey=iso(t);
  Object.keys(warned).forEach(function(k){ var dt=String(k).split("@")[1]; if(dt && dt<tkey) delete warned[k]; });
  var fresh=due.filter(function(b){ return !warned[b.id+"@"+tkey]; });
  if(!fresh.length) return;
  if(document.querySelector(".overlay.open")) return; /* nicht über einen offenen Dialog legen – nächster Tick */
  fresh.forEach(function(b){ warned[b.id+"@"+tkey]=1; });
  try{ save(); }catch(e){}
  var body=document.getElementById("bdWarnBody");
  if(body){
    body.innerHTML=fresh.map(function(b){
      var age=(b.year ? " · wird "+((tm.getFullYear())-Number(b.year)) : "");
      return '<div class="bd-warn-item"><span class="bd-warn-emoji">🎂</span><div>'
        + '<div class="bd-warn-name">'+esc(b.name)+'</div>'
        + '<div class="muted">Geburtstag morgen · '+bdDateText(b)+age+'</div></div></div>';
    }).join("");
  }
  openModal("bdWarnModal");
}
var __bdMonthSel=document.getElementById("bdMonth");
if(__bdMonthSel && !__bdMonthSel.options.length){
  __bdMonthSel.innerHTML = MONTHS.map(function(m,i){ return '<option value="'+(i+1)+'">'+esc(m)+"</option>"; }).join("");
  __bdMonthSel.value="1";
}
var __bdNew=document.getElementById("btnNewBirthday"); if(__bdNew) __bdNew.onclick=function(){ openBirthday(null); };
var __bdSave=document.getElementById("bdSave"); if(__bdSave) __bdSave.onclick=saveBirthday;
var __bdDel=document.getElementById("bdDelete"); if(__bdDel) __bdDel.onclick=function(){ if(editingBirthday) deleteBirthday(editingBirthday.id); };
var __bdNameInp=document.getElementById("bdName"); if(__bdNameInp) __bdNameInp.addEventListener("keydown", function(e){ if(e.key==="Enter") saveBirthday(); });
var __bdYearInp=document.getElementById("bdYear"); if(__bdYearInp) __bdYearInp.addEventListener("keydown", function(e){ if(e.key==="Enter") saveBirthday(); });
var __bdList=document.getElementById("view-lists");
if(__bdList) __bdList.addEventListener("click", function(e){
  var ed=e.target.closest("[data-bd-edit]");
  if(ed){ openBirthday(ed.getAttribute("data-bd-edit")); return; }
  var dl=e.target.closest("[data-bd-del]");
  if(dl){ deleteBirthday(dl.getAttribute("data-bd-del")); return; }
});

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
  var dsEl=document.getElementById("dayStart"), deEl=document.getElementById("dayEnd");
  if(dsEl && !dsEl.options.length){
    for(var hh=0;hh<=23;hh++){ var o=document.createElement("option"); o.value=String(hh); o.textContent=pad(hh)+":00"; dsEl.appendChild(o); }
  }
  if(deEl && !deEl.options.length){
    for(var he=1;he<=24;he++){ var oe=document.createElement("option"); oe.value=String(he); oe.textContent=pad(he)+":00"; deEl.appendChild(oe); }
  }
  if(dsEl) dsEl.value = String(dayRangeStart());
  if(deEl) deEl.value = String(dayRangeEnd());
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
  if(e.target.id==="dayStart" || e.target.id==="dayEnd"){
    if(!S.settings) S.settings={};
    var a=Number(document.getElementById("dayStart").value), b=Number(document.getElementById("dayEnd").value);
    if(isNaN(a)) a=0; if(isNaN(b)) b=24;
    if(b<=a) b=a+1;
    S.settings.dayStart=a; S.settings.dayEnd=b;
    save(); renderSettings(); renderCalendar();
  }
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
    if(e.target===o || e.target.closest("[data-close]")){
      if(o.id==="reschedModal"){ o.classList.remove("open"); return; }
      closeModals();
    }
  });
});
document.addEventListener("keydown", e=>{
  if(e.key==="Escape"){ if(isCalSearchOpen()){ closeCalSearch(); return; } if(copyEvId){ setCopyEv(null); return; } var rm=document.getElementById("reschedModal"); if(rm && rm.classList.contains("open")){ rm.classList.remove("open"); return; } closeModals(); return; }
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
var WORK_MAX_DAY_MIN = 600; // max. 10:00 stdl. Arbeitszeit
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
  if(arbeitsZeit > WORK_MAX_DAY_MIN) arbeitsZeit = WORK_MAX_DAY_MIN;
  // Saldo based on effective Arbeitszeit vs Soll
  return {anwesMin:anwesPres,pauseMinBooked:pauseAbzug,arbeitsMin:arbeitsZeit,sollMin:456,saldoMin:arbeitsZeit-456};}
function fmtSecHMS(sec){var s=Math.max(0,Math.floor(sec||0));var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return wkPad(h)+":"+wkPad(m)+":"+wkPad(ss);}
function fmtHHMM(h,m){return wkPad(h)+":"+wkPad(m);}
function workToggle(){var nk=wkTodayKey();var a=workArr(nk);var o=workOpenInterval(nk);var now=new Date();var ts=wkPad(now.getHours())+":"+wkPad(now.getMinutes());if(o){o.e=ts;}else{for(var i=a.length-1;i>=0;i--){if(a[i]&&dayMarkerType(a[i]))a.splice(i,1);}a.push({s:ts,e:null});}try{save();renderWork();updateWorkLive();render();}catch(e){}}
function workSet(id,val){var el=document.getElementById(id); if(el) el.textContent=val;}
function workRunningSec(){
  var c=workCalcDay(wkTodayKey()), o=workOpenInterval(wkTodayKey());
  var sec = c.arbeitsMin*60 + (o ? new Date().getSeconds() : 0);
  return Math.min(sec, WORK_MAX_DAY_MIN*60);
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
    chip.innerHTML = ICON_TIMER+" <b>"+minToHM(c.arbeitsMin)+"</b>";
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
    /* Saldo nur an normalen Arbeitstagen zeigen – nicht Sa/So, Urlaubs-, Freizeit- oder Krankheitstag */
    ws.style.display = (isWeekend || !!c.dayType) ? "none" : "inline-flex";
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
    if(mInfo && period){
      var totSaldo=0;
      for(var ti=0;ti<keys.length;ti++){ totSaldo+=workCalcDay(keys[ti],new Date(keys[ti]+"T23:59:59")).saldoMin; }
      mInfo.textContent += " (Monats-Saldo: "+(totSaldo>0?"+":"")+minToDec(totSaldo)+")";
    }
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
  if(!e || !e.date || eventIsDone(e)) return null;
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
  if(!e.repeat || e.repeat==="none"){
    if(done) e.done = true; else delete e.done;
  } else if(!done){
    e.lastDone = null; delete e.completedAt;
  } else {
    e.lastDone = iso(today()); e.completedAt = new Date().toISOString();
  }
  try{ save(); }catch(err){}
  try{ render(); }catch(err){}
}
function showReminder(items){
  var body = document.getElementById("remindBody");
  if(!body) return;
  body.innerHTML = items.map(function(it){
    var ico = it.kind==="Termin" ? ICON_CAL : ICON_TASK;
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
    "<b>"+pad(now.getHours())+":"+pad(now.getMinutes())+"</b>&nbsp; "
    + DOW_FULL[now.getDay()].slice(0,2) + ". " + now.getDate() + ". " + MONTHS[now.getMonth()].slice(0,3);
  var ld=document.getElementById("logoDay");
  if(ld){
    ld.textContent=now.getDate();
    ld.title="Heute: "+DOW_FULL[now.getDay()]+", "+now.getDate()+". "+MONTHS[now.getMonth()]+" "+now.getFullYear();
  }
  try{ if(typeof updateWorkLive==="function") updateWorkLive(); }catch(e){}
  try{ checkReminders(); }catch(e){}
  try{ checkBirthdayWarnings(); }catch(e){}
}
setInterval(tick, 1000); tick();

/* Init */
try{
  window.addEventListener("error", function(ev){
    try{
      if(window.__calShownErr) return;
      if(typeof curView==="undefined" || curView!=="cal") return;
      window.__calShownErr = true;
      reportRenderError(ev.error || ev.message || "Unbekannter Fehler");
    }catch(_){}
  });
}catch(_){}
/* Echte Doppel-Routinen aus alten Daten einmalig zusammenführen (läuft nach Init, damit alle Helfer bereit stehen). */
var __dupRoutines = dedupeRoutines();
if(__dupRoutines){
  try{ toast(__dupRoutines===1 ? "Doppelte Routine zusammengeführt." : __dupRoutines+" doppelte Routinen zusammengeführt."); }catch(e){}
}
render();
try{ checkBirthdayWarnings(); }catch(e){}


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
function setRoutineDone(r, done){
  if(!r) return;
  const pts = r.points || 1;
  const label = r.name || r.title || "";
  if(!r.freq || r.freq==="none"){
    r.done = !!done;
    if(done){ r.completedAt=new Date().toISOString(); addPoints(pts, label); }
    else { delete r.completedAt; removePoints(pts, label); }
  } else if(!done){
    r.lastDone=null; delete r.completedAt; removePoints(pts, label);
  } else {
    r.lastDone=iso(today()); r.completedAt=new Date().toISOString(); addPoints(pts, label);
  }
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
/* Routinen haben keinen Wochentag, nur eine Uhrzeit (r.time) – die fällige Zeit ist
   also heute um r.time. Überfällig = im laufenden Zeitraum noch offen und Uhrzeit vorbei. */
function routineDueAt(r){
  if(!r || !r.time || r.time==="any") return null;
  var p=String(r.time).split(":");
  var d=today();
  d.setHours(parseInt(p[0],10)||0, parseInt(p[1],10)||0, 0, 0);
  return d;
}
function isRoutineOverdue(r){
  if(!r || routineIsDone(r)) return false;
  var dt=routineDueAt(r);
  return dt ? dt < new Date() : false;
}
function routineOverdueBadge(r){
  if(!isRoutineOverdue(r)) return "";
  return '<span class="due-soft">Seit '+esc(r.time)+'</span>';
}
/* Identität einer Routine (ohne Zustand): gleicher Name + Plan + Kategorie = dieselbe Routine */
function routineIdentity(r){
  r=r||{};
  return [String(r.name||r.title||"").trim().toLowerCase(), (r.freq||r.repeat||"none"), r.time||"", r.cat||""].join("\u0001");
}
/* Führt echte Doppel-Einträge zusammen (Behalten: erster Eintrag, Erledigt-Status wird übernommen). Liefert die Anzahl entfernter Duplikate. */
function dedupeRoutines(){
  if(!S || !Array.isArray(S.routines) || S.routines.length<2) return 0;
  var seen={}, out=[], removed=0;
  S.routines.forEach(function(r){
    var k=routineIdentity(r), keep=seen[k];
    if(!keep){ seen[k]=r; out.push(r); return; }
    if(!keep.note && r.note) keep.note=r.note;
    if((keep.points===undefined||keep.points===null) && r.points!=null) keep.points=r.points;
    if(routineIsDone(r) && !routineIsDone(keep)){ keep.done=r.done; keep.lastDone=r.lastDone; keep.completedAt=r.completedAt; }
    removed++;
  });
  if(removed){ S.routines=out; save(); }
  return removed;
}
function spanTxt(t){
  if(!t || !t.startDate) return "";
  var a=t.startDate.split("-").reverse().join(".");
  var out = (t.endDate && t.endDate > t.startDate) ? a+" – "+t.endDate.split("-").reverse().join(".") : a;
  if(t.startTime || t.endTime) out += " "+(t.startTime||"")+(t.endTime?"–"+t.endTime:"");
  return out;
}
function relDayTxt(dateStr){
  if(!dateStr) return "";
  var d=parseISO(dateStr), td=today();
  if(sameDay(d,td)) return "Heute";
  var tm=new Date(td.getFullYear(),td.getMonth(),td.getDate()+1);
  if(sameDay(d,tm)) return "Morgen";
  var ye=new Date(td.getFullYear(),td.getMonth(),td.getDate()-1);
  if(sameDay(d,ye)) return "Gestern";
  var s=pad(d.getDate())+"."+pad(d.getMonth()+1)+".";
  if(d.getFullYear()!==td.getFullYear()) s+=" "+d.getFullYear();
  return s;
}
function overdueBadge(t, done){
  if(done || !t || !taskDate(t) || !isTaskOverdue(t)) return "";
  var en = taskEndTime(t) || taskStartTime(t) || "";
  var due = dueDateTime(t);
  if(en && due && (new Date() - due) < 86400000){
    // gleicher Tag, nur wenige Stunden überzogen → dezent, nur roter Text
    return '<span class="due-soft">Seit '+esc(en)+'</span>';
  }
  // mehrere Tage überfällig → roter Chip mit Tagesanzahl statt Datum
  var a=parseISO(taskDate(t)), b=today();
  var days=Math.round((new Date(b.getFullYear(),b.getMonth(),b.getDate())-new Date(a.getFullYear(),a.getMonth(),a.getDate()))/86400000);
  days=Math.max(1,days);
  return '<span class="due-chip due-overdue">'+(days===1?"1 Tag überfällig":days+" Tage überfällig")+'</span>';
}
function fmtDue(t,done){
  if(!t || !taskDate(t)) return "";
  var od = overdueBadge(t, done);
  if(od) return od; // Überfällig ersetzt das Datum → alles bleibt in einer Zeile
  var st = taskStartTime(t), en = taskEndTime(t);
  var time = st ? " "+esc(st)+(en?"–"+esc(en):"") : "";
  var tag=relDayTxt(taskDate(t));
  return '<span class="due-when">'+(tag==="Heute"?"":ICON_CAL+" ")+esc(tag)+time+"</span>";
}

/* ---------- Gemeinsame Zeilen-Bausteine (Panels + Aufgaben-/Routinen-Seiten) ----------
   Feste Meta-Regel: Kategorie · Zeit · Wiederholung · Status.
   Icons in der Meta-Zeile: „nirgends“ (kein Kalender-/Uhr-SVG) – nur der ↻-Glyph für Wiederholung.
   Kategorie: nur eine kleine Farbmarke vor dem Titel (kein Text-Pill). */
function catOf(x){ var c=(typeof cat==="function")?cat(x&&x.cat):null; return c||{name:"",color:"#64748b"}; }
function taskMetaHTML(t, done, opt){
  opt=opt||{};
  var out="";
  var st=taskStartTime(t), en=taskEndTime(t);
  var time=st?esc(st)+(en?"–"+esc(en):""):"";
  var od=overdueBadge(t,done);
  if(!od && taskDate(t)){
    if(opt.omitDay){ if(time) out+='<span class="due-when">'+time+'</span>'; }
    else{ var tag=relDayTxt(taskDate(t)); out+='<span class="due-when">'+esc(tag)+(time?" "+time:"")+'</span>'; }
  }else if(!od && time){
    out+='<span class="due-when">'+time+'</span>';
  }
  var rep=(t.repeat&&t.repeat!=="none")?repLabel(t.repeat):"";
  if(rep) out+='<span class="meta-rep">↻ '+esc(rep)+'</span>';
  if(od) out+=od;
  if(t.completedAt) out+='<span class="meta-done">'+esc(fmtCompletedAt(t.completedAt))+'</span>';
  if(done&&rep&&nextDue(t)) out+='<span class="meta-next">↻ Nächste: '+esc(fmtDate(nextDue(t)))+'</span>';
  return out;
}
/* Tooltip nur bei langen Texten – kurze Titel/Beschreibungen brauchen keinen */
function titleAttr(txt){
  txt=String(txt==null?"":txt);
  return txt.length>26 ? ' title="'+esc(txt)+'"' : "";
}
function taskRowHTML(t, opt){
  opt=opt||{};
  var idx=S.todos.indexOf(t);
  var done=taskIsDone(t);
  var c=catOf(t);
  var ttl=String(t.title||t.text||"");
  var meta=taskMetaHTML(t,done,opt);
  var note=(opt.showNote && t.note)?('<div class="it-note"'+titleAttr(t.note)+'>'+esc(t.note)+'</div>'):"";
  var noteTip=(t.note && opt.noteTooltip)?(' title="'+esc(t.note)+'"'):"";
  return '<div class="item'+(done?" done":"")+'">'
    +'<button type="button" class="check'+(done?" on":"")+'" data-task-toggle="'+idx+'" title="Erledigt abhaken">✓</button>'
    +'<div'+(opt.infoOpen?' data-info-open="task" data-info-id="'+esc(t.id)+'"':'')+noteTip+'>'
    +'<div class="it-title"'+titleAttr(ttl)+'><span class="cat-dot" style="background:'+c.color+'"></span>'+esc(ttl)+'</div>'
    +(meta?'<div class="it-sub meta">'+meta+'</div>':'')
    +note
    +'</div>'
    +'<div class="it-actions"><button type="button" class="menu-toggle" title="Aktionen" aria-label="Aktionen">'+ICON_MORE+'</button>'
    +'<button type="button" class="btn sm act" data-task-edit="'+idx+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
    +'<button type="button" class="btn sm act del" data-task-del="'+idx+'" title="Löschen">'+ICON_TRASH+'</button></div>'
    +'</div>';
}
function taskGroups(items){
  var g={ueberfaellig:[],heute:[],morgen:[],demnaechst:[],ohne:[],erledigt:[]};
  var td=today(), tm=new Date(td.getFullYear(),td.getMonth(),td.getDate()+1);
  (items||[]).forEach(function(t){
    if(taskIsDone(t)){ g.erledigt.push(t); return; }
    var td0=taskDate(t);
    if(!td0){ g.ohne.push(t); return; }
    if(isTaskOverdue(t)){ g.ueberfaellig.push(t); return; }
    var d=parseISO(td0);
    if(sameDay(d,td)){ g.heute.push(t); return; }
    if(sameDay(d,tm)){ g.morgen.push(t); return; }
    g.demnaechst.push(t);
  });
  return g;
}
function taskGroupsHTML(items, rowOpt){
  var g=taskGroups(items);
  function grp(title, arr, opt, cls){
    if(!arr.length) return "";
    var out='<div class="tgroup'+(cls?" "+cls:"")+'">'+esc(title)+" ("+arr.length+")</div>";
    out+=arr.map(function(t){
      return taskRowHTML(t, Object.assign({}, rowOpt, opt));
    }).join("");
    return out;
  }
  var html="";
  html+=grp("Überfällig", g.ueberfaellig, {}, "overdue");
  html+=grp("Heute", g.heute, {omitDay:true});
  html+=grp("Morgen", g.morgen, {omitDay:true});
  html+=grp("Demnächst", g.demnaechst, {});
  html+=grp("Ohne Datum", g.ohne, {});
  html+=grp("Erledigt", g.erledigt, {});
  return html;
}
function routineMetaHTML(r, done, opt){
  opt=opt||{};
  var out="";
  var od=routineOverdueBadge(r);
  if(!od && r.time&&r.time!=="any") out+='<span class="due-when">'+esc(r.time)+'</span>';
  var rep=(r.freq&&r.freq!=="none")?repLabel(r.freq):"";
  if(rep) out+='<span class="meta-rep">↻ '+esc(rep)+'</span>';
  if(od) out+=od;
  if(done&&rep){ var nd=nextDue(Object.assign({},r,{repeat:r.freq})); if(nd) out+='<span class="meta-next">↻ Nächste: '+esc(fmtDate(nd))+'</span>'; }
  if(done&&r.completedAt) out+='<span class="meta-done">'+esc(fmtCompletedAt(r.completedAt))+'</span>';
  return out;
}
function routineRowHTML(r, opt){
  opt=opt||{};
  var idx=S.routines.indexOf(r);
  var done=routineIsDone(r);
  var c=catOf(r);
  var rname=String(r.name||"");
  var meta=routineMetaHTML(r,done,opt);
  var noteLine=(r.note && !opt.noteTooltip)?('<div class="it-note"'+titleAttr(r.note)+'>'+esc(r.note)+'</div>'):"";
  var noteTip=(r.note && opt.noteTooltip)?(' title="'+esc(r.note)+'"'):"";
  return '<div class="item'+(done?" done":"")+'">'
    +'<button type="button" class="check'+(done?" on":"")+'" data-routine-toggle="'+idx+'" title="Erledigt abhaken">✓</button>'
    +'<div'+(opt.infoOpen?' data-info-open="routine" data-info-id="'+esc(r.id)+'"':'')+noteTip+'>'
    +'<div class="it-title"'+titleAttr(rname)+'><span class="cat-dot" style="background:'+c.color+'"></span>'+esc(rname)+'</div>'
    +(meta?'<div class="it-sub meta">'+meta+'</div>':'')
    +noteLine
    +'</div>'
    +'<div class="it-actions"><button type="button" class="menu-toggle" title="Aktionen" aria-label="Aktionen">'+ICON_MORE+'</button>'
    +'<button type="button" class="btn sm act" data-routine-edit="'+idx+'" title="Bearbeiten">'+ICON_EDIT+'</button>'
    +'<button type="button" class="btn sm act del" data-routine-del="'+idx+'" title="Löschen">'+ICON_TRASH+'</button></div>'
    +'</div>';
}
function updateTaskBadge(){ if(typeof updateBadges==="function"){ updateBadges(); return; } try{ var b=document.getElementById('todoBadge'); if(!b) return; var n=0,no=0; if(typeof S!=="undefined"&&S&&Array.isArray(S.todos)) S.todos.forEach(function(t){ if(inProfile(t.cat)&&!taskIsDone(t)){ n++; if(isTaskOverdue(t)) no++; } }); b.textContent=n; b.style.display=n?"grid":"none"; b.classList.toggle("overdue",no>0); }catch(e){} }
function clampTitles(root){
  if(!root || !root.querySelectorAll) return;
  var els=root.querySelectorAll(".it-title, .ag-item .ttl");
  for(var i=0;i<els.length;i++){
    var el=els[i];
    if(el.scrollHeight>el.clientHeight+1 && !el.hasAttribute("title")) el.title=el.textContent;
  }
}
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
      list.innerHTML=taskGroupsHTML(items, {showNote:true});
    }
    clampTitles(list);
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
      items.sort(function(a,b){
        var ao=isRoutineOverdue(a), bo=isRoutineOverdue(b);
        if(ao!==bo) return ao?-1:1;
        return 0;
      });
      list.innerHTML=items.map(function(r){ return routineRowHTML(r); }).join('');
    }
    clampTitles(list);
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
    if(t.closest&&t.closest('[data-info-open]')){
      var iel=t.closest('[data-info-open]');
      openInfo(iel.getAttribute('data-info-open'), iel.getAttribute('data-info-id'));
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
/* Blendet das Listenende sanft aus, solange darunter noch weitere Einträge folgen. */
function updateScrollHints(){
  try{
    var panels=document.querySelectorAll('.cal-side .side-panel');
    for(var i=0;i<panels.length;i++){
      var p=panels[i], l=p.querySelector('.list');
      if(!l) continue;
      var more=(l.scrollHeight - Math.round(l.scrollTop) - l.clientHeight) > 4;
      if(more) p.classList.add('scroll-more'); else p.classList.remove('scroll-more');
    }
  }catch(e){}
}
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
        tBox.innerHTML=taskGroupsHTML(todos, {infoOpen:true, noteTooltip:true});
      }
      clampTitles(tBox);
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
      routines.sort(function(a,b){
        var ao=isRoutineOverdue(a), bo=isRoutineOverdue(b);
        if(ao!==bo) return ao?-1:1;
        return 0;
      });
      if(!routines.length){
        rBox.innerHTML='<div class="empty"><span class="big">🗓️</span>Noch keine Routinen.</div>';
      }else{
        rBox.innerHTML=routines.map(function(r){ return routineRowHTML(r,{infoOpen:true, noteTooltip:true}); }).join('');
      }
      clampTitles(rBox);
      var rcnt=document.getElementById('calRoutineCount');
      if(rcnt) rcnt.textContent=routines.length;
    }
  }catch(e){}
  try{ updateBadges(); }catch(e){}
  try{ updateScrollHints(); }catch(e){}
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
/* Fade-Hinweis aktualisieren, wenn in einer Seiten-Liste gescrollt oder das Fenster geändert wird. */
document.addEventListener("scroll", function(e){
  var t=e.target;
  if(t && t.classList && t.classList.contains("list")) updateScrollHints();
}, true);
window.addEventListener("resize", function(){ updateScrollHints(); });
