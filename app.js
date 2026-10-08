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
    settings:{ weekStart:1, showDone:false }
  };
}

let S;
let activeProfile = null;
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
load(); save();

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
}
function updateBadges(){
  let n = 0;
  S.todos.forEach(t=>{ if(inProfile(t.cat) && !isDone(t)) n++; });
  const b = document.getElementById("todoBadge");
  b.textContent = n; b.style.display = n ? "grid" : "none";
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
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  document.getElementById("calTitle").innerHTML =
    MONTHS[m] + " " + y + '<span>' + (Object.keys(holidays(y)).length - 2) + " Feiertage</span>";

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
    let chips = "";
    evs.slice(0,3).forEach(ev=>{ chips += chipHTML(ev); });
    if(evs.length>3) chips += '<div class="more">+'+(evs.length-3)+" weitere</div>";
    const hol = (H[key] || Hnext[key] || Hprev[key]) || "";
    html += '<div class="day'+(out?" out":"")+(sameDay(d,today())?" today":"")+'" data-date="'+key+'">'
          +   '<div class="day-head">'
          +     '<div class="daynum">'+d.getDate()+"</div>"
          +     '<button class="plus" data-new="'+key+'" title="Termin anlegen">+</button>'
          +   "</div>"
          +   (hol ? '<div class="holiday">'+esc(hol)+"</div>" : "")
          +   chips
          + "</div>";
  }
  grid.innerHTML = html;
  grid.classList.toggle("copy-mode", !!copyEvId);
  renderLegend();
  renderAgenda(); try{if(typeof updateWorkLive==="function") updateWorkLive();}catch(e){}
  try{ if(typeof renderCalSide==="function") renderCalSide(); }catch(e){}
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
  S.events.push(Object.assign({}, src, {id:uid(), date:key,
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
  return '<div class="ev'+(ev.id===copyEvId?" copysrc":"")+'" data-ev="'+ev.id+'" style="background:'+c.color+'" title="'+tip+'">'
       + '<button class="ev-copy" data-copy="'+ev.id+'" title="Termin kopieren">⧉</button>'
       + t + marker + "<span>" + esc(ev.title) + "</span></div>";
}
function renderLegend(){
  document.getElementById("legend").innerHTML = S.categories.map(c=>
    '<span class="chip" style="background:'+hexA(c.color,.16)+';border-color:'+hexA(c.color,.45)+(activeProfile&&c.id!==activeProfile?";opacity:.4":"")+'">'
    + '<span style="width:10px;height:10px;border-radius:3px;background:'+c.color+';display:inline-block"></span>'
    + esc(c.name) + "</span>").join("");
}
function renderAgenda(){
  document.getElementById("agendaDate").textContent = fmtDate(selDate);
  const evs = eventsOn(iso(selDate));
  const hol = holidays(selDate.getFullYear())[iso(selDate)];
  document.getElementById("agendaSub").innerHTML =
    (hol ? '<span style="color:#fca5a5">🎉 '+esc(hol)+"</span> · " : "")
    + (sameDay(selDate,today()) ? "Heute" : "")
    + (evs.length ? evs.length+(evs.length===1?" Termin":" Termine") : "keine Termine");

  const box = document.getElementById("agenda");
  if(!evs.length){
    box.innerHTML = '<div class="empty"><span class="big">🗓️</span>Noch keine Termine an diesem Tag.<br>'
                  + 'Über „+ Termin“ oder das <b>+</b> in der Tageszelle anlegen.</div>';
    return;
  }
  box.innerHTML = evs.map(ev=>{
    const c = cat(ev.cat);
    return '<div class="ag-item" style="--c:'+c.color+'">'
      + '<div class="when">'+(ev.allDay?"ganztägig":esc((ev.start||"—")+"–"+(ev.end||"")))+"</div>"
      + "<div><div class=\"ttl\">"+esc(ev.title)+"</div>"
      + '<div class="sub"><span class="pill" style="background:'+c.color+'">'+esc(c.name)+"</span>"
      + (evDays(ev)>1 ? " · 📅 "+esc(ev.date.split("-").reverse().join("."))+"–"+esc(evEndKey(ev).split("-").reverse().join(".")) : "")
      + (ev.note ? " · "+esc(ev.note) : "") + "</div></div>"
      + '<div class="ag-actions"><button class="linkbtn" data-ev="'+ev.id+'" title="Bearbeiten">✎</button>'
      + '<button class="linkbtn" data-copy="'+ev.id+'">⧉ Kopieren</button>'
      + '<button class="linkbtn del" data-evdel="'+ev.id+'" title="Löschen">🗑</button></div>'
      + "</div>";
  }).join("");
}

var __el=document.getElementById("calGrid"); if(__el)__el.addEventListener("click", e=>{
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
  if(day){ selDate = parseISO(day.dataset.date); renderCalendar(); }
});
var __el=document.getElementById("agenda"); if(__el)__el.addEventListener("click", e=>{
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
document.getElementById("btnPrev").onclick = ()=>{ calMonth.setMonth(calMonth.getMonth()-1); renderCalendar(); };
document.getElementById("btnNext").onclick = ()=>{ calMonth.setMonth(calMonth.getMonth()+1); renderCalendar(); };
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
function openEvent(id, date){
  editingEvent = id ? S.events.find(e=>e.id===id) : null;
  const e = editingEvent;
  document.getElementById("evModalTitle").textContent = e ? "Termin bearbeiten" : "Neuer Termin";
  document.getElementById("evTitle").value = e ? e.title : "";
  document.getElementById("evDate").value = e ? e.date : (date || iso(selDate));
  document.getElementById("evEndDate").value = e && e.endDate ? e.endDate : "";
  fillCatSelect(document.getElementById("evCat"), e ? e.cat : (S.categories[0]||{}).id);
  document.getElementById("evAllDay").checked = e ? !!e.allDay : true;
  document.getElementById("evStart").value = e && e.start ? e.start : "09:00";
  document.getElementById("evEnd").value = e && e.end ? e.end : "10:00";
  document.getElementById("evNote").value = e ? (e.note||"") : "";
  document.getElementById("evDelete").style.display = e ? "" : "none";
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
  document.getElementById("evSpan").textContent = n===1 ? "1 Tag" : n+" Tage";
}
document.getElementById("evDate").onchange = ()=>{
  const s = document.getElementById("evDate").value;
  const e = document.getElementById("evEndDate");
  if(s && e.value && e.value < s) e.value = s;
  updateSpan();
};
document.getElementById("evEndDate").onchange = updateSpan;
function toggleTimeFields(){
  document.getElementById("evTimeFields").style.display =
    document.getElementById("evAllDay").checked ? "none" : "grid";
}
document.getElementById("evAllDay").onchange = toggleTimeFields;

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
    note: document.getElementById("evNote").value.trim()
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
      ? '<span style="color:#f87171">überfällig '+esc(t.due)+"</span>" : esc(t.due)) : "";
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
  document.getElementById("tdDue").value = (e && e.due) ? e.due : "";
  document.getElementById("tdNote").value = (e && e.note) ? e.note : "";
  document.getElementById("tdDelete").style.display = e ? "" : "none";
  openModal("tdModal");
  document.getElementById("tdTitle").focus();
}
document.getElementById("tdSave").onclick = ()=>{
  const title = document.getElementById("tdTitle").value.trim();
  if(!title){ toast("Bitte einen Titel eingeben."); return; }
  const cat = document.getElementById("tdCat").value;
  const repeat = document.getElementById("tdRepeat").value;
  const points = Math.max(0, parseInt(document.getElementById("tdPoints").value||"0",10));
  const due = document.getElementById("tdDue").value;
  const note = document.getElementById("tdNote").value.trim();
  if(tdMode==="routine"){
    const data = {name:title, freq:repeat, cat, note};
    if(editingRoutine) Object.assign(editingRoutine, data);
    else S.routines.push(Object.assign({id:uid(), time:"any"}, data));
  }else{
    const data = {title, cat, repeat, points, due, note};
    if(editingTodo) Object.assign(editingTodo, data);
    else S.todos.push(Object.assign({id:uid(), done:false, lastDone:null}, data));
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
      + '<div class="it-actions"><button class="linkbtn del" data-li-del="'+i.id+'">×</button></div>'
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
    L.items = L.items.filter(x=>x.id!==dl.dataset.liDel);
    save(); renderLists();
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
  save();
}
var __el=document.getElementById("view-settings"); if(__el)__el.addEventListener("change", e=>{
  const c = e.target.dataset.catColor;
  if(c){ cat(c).color = e.target.value; save(); renderSettings(); return; }
  const n = e.target.dataset.catName;
  if(n){ cat(n).name = e.target.value.trim() || "Ohne Name"; save(); renderSettings(); return; }
  if(e.target.id==="weekStart"){ S.settings.weekStart = Number(e.target.value); save(); renderSettings(); }
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
    if(e.key==="ArrowLeft"){ calMonth.setMonth(calMonth.getMonth()-1); renderCalendar(); }
    if(e.key==="ArrowRight"){ calMonth.setMonth(calMonth.getMonth()+1); renderCalendar(); }
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
function workOpenInterval(k){var a=workArr(k);for(var i=a.length-1;i>=0;i--){if(a[i]&&!a[i].e)return a[i];}return null;}
function workRunningToday(){return !!workOpenInterval(wkTodayKey());}
function hmToMin(hm){if(!hm)return 0;var p=hm.split(":");return parseInt(p[0])*60+parseInt(p[1]);}
function minToHM(min){var s=min<0?"-":"";var m=Math.abs(min);var h=Math.floor(m/60),mm=m%60;return s+h+":"+String(mm).padStart(2,"0");}
function minToDec(min){return (Math.round((min/60)*100)/100).toFixed(2);}
function workCalcDay(k,ref){if(typeof S==="undefined")window.S={work:{}};if(!S.work)S.work={};var a=S.work[k]||[];var now=ref||new Date();var nk=wkTodayKey();var anwes=0;for(var i=0;i<a.length;i++){var it=a[i];if(!it||!it.s)continue;var sm=hmToMin(it.s),em;if(it.e)em=hmToMin(it.e);else em=(k===nk)?(now.getHours()*60+now.getMinutes()):(23*60+59);if(em>sm)anwes+=em-sm;}var pairs=[];for(var i=0;i<a.length;i++){var it=a[i];if(!it||!it.s)continue;var sm=hmToMin(it.s),em;if(it.e)em=hmToMin(it.e);else em=(k===nk)?(now.getHours()*60+now.getMinutes()):(23*60+59);if(em>=sm)pairs.push({s:sm,e:em});}pairs.sort(function(x,y){return x.s-y.s});var pause=0;for(var i=1;i<pairs.length;i++){var g=pairs[i].s-pairs[i-1].e;if(g>0)pause+=g;}var arb=anwes-pause;if(arb<0)arb=0;
  // Mindestpausen nach ArbZG: >6h -> 30min, >9h -> 45min
  var reqPause=0;
  if(arb>360){reqPause=30;}
  if(arb>540){reqPause=45;}
  var pauseEff=Math.max(pause,reqPause);
  var arbEff=anwes-pauseEff;if(arbEff<0)arbEff=0;
  return {anwesMin:anwes,pauseMinBooked:pauseEff,arbeitsMin:arbEff,sollMin:456,saldoMin:arbEff-456};}
function fmtSecHMS(sec){var s=Math.max(0,Math.floor(sec||0));var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),ss=s%60;return wkPad(h)+":"+wkPad(m)+":"+wkPad(ss);}
function fmtHHMM(h,m){return wkPad(h)+":"+wkPad(m);}
function workToggle(){var nk=wkTodayKey();var a=workArr(nk);var o=workOpenInterval(nk);var now=new Date();var ts=wkPad(now.getHours())+":"+wkPad(now.getMinutes());if(o){o.e=ts;}else{a.push({s:ts,e:null});}try{save();renderWork();updateWorkLive();render();}catch(e){}}
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
}
var __wlBtn=document.getElementById("calWorkLive");
if(__wlBtn) __wlBtn.onclick=function(){ setView("work"); };
function updateWorkLive(){ renderWorkHead(); }
function renderWork(){
  if(typeof S==="undefined") window.S={work:{}};
  if(!S.work) S.work={};
  var nk=wkTodayKey();
  if(!S.work[nk]) S.work[nk]=[];
  renderWorkHead();
  var box=document.getElementById("workTodayList");
  if(box){
    var arr=S.work[nk];
    if(!arr.length){
      box.innerHTML='<div class="empty"><span class="big">⏱️</span>Keine Einträge heute.</div>';
    }else{
      var rev=arr.map(function(it,idx){return {it:it,idx:idx};}).reverse();
      box.innerHTML=rev.map(function(x){
        var dur=x.it.e ? 'Dauer '+minToHM(hmToMin(x.it.e)-hmToMin(x.it.s))+' · Ind. '+minToDec(hmToMin(x.it.e)-hmToMin(x.it.s)) : 'Läuft …';
        return '<div class="item">'
          +'<div><div class="it-title">Komm '+esc(x.it.s)+(x.it.e?' · Geht '+esc(x.it.e):' · offen')+'</div>'
          +'<div class="it-sub">'+dur+'</div></div>'
          +'<div class="it-actions">'
          +'<button class="btn sm" data-wk-edit="'+x.idx+'" title="Bearbeiten">✎</button>'
          +'<button class="btn sm" data-wk-del="'+x.idx+'">Löschen</button></div>'
          +'</div>';
      }).join('');
    }
  }
  var hist=document.getElementById("workHistory");
  if(hist){
    var keys=Object.keys(S.work).sort().reverse();
    if(!keys.length){
      hist.innerHTML='<div class="empty">Keine Einträge.</div>';
    }else{
      hist.innerHTML=keys.map(function(k){
        var c2=workCalcDay(k,new Date(k+"T23:59:59"));
        var saldo=(c2.saldoMin>0?"+":"")+minToHM(c2.saldoMin);
        return '<div class="item">'
          +'<div><div class="it-title">'+esc(k.split("-").reverse().join("."))+'</div>'
          +'<div class="it-sub">Anw. '+minToHM(c2.anwesMin)+' · Pause '+minToHM(c2.pauseMinBooked)
          +' · Arb. '+minToHM(c2.arbeitsMin)+' · Ind. '+minToDec(c2.arbeitsMin)
          +' · Saldo <b class="'+(c2.saldoMin<0?"neg":"pos")+'">'+saldo+'</b></div></div>'
          +'<div class="it-actions">'
          +'<button class="btn sm" data-wk-editday="'+esc(k)+'" title="Bearbeiten">✎</button>'
          +'<button class="btn sm" data-wk-delall="'+esc(k)+'">Tag leeren</button></div>'
          +'</div>';
      }).join('');
    }
  }
}
/* ---- Arbeitstag bearbeiten (Komm/Geht) ---- */
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
      +'<button class="linkbtn del wk-rowdel" data-wk-rowdel="'+i+'" title="Zeitraum entfernen">×</button>'
      +'</div>';
  }).join("");
}
function openWorkDay(k){
  wkEditKey = k;
  wkDraft = (workArr(k)||[]).map(function(x){ return {s:x.s||"", e:x.e||""}; });
  if(!wkDraft.length) wkDraft=[{s:"",e:""}];
  renderWkRows();
  document.getElementById("wkModalTitle").textContent = "Arbeitstag "+k.split("-").reverse().join(".")+(k===wkTodayKey()?" (heute)":"");
  openModal("wkModal");
}
document.getElementById("wkAdd").onclick = function(){
  syncWkDraft();
  wkDraft.push({s:"",e:""});
  renderWkRows();
  var rows=document.querySelectorAll("#wkRows .wk-s");
  if(rows.length) rows[rows.length-1].focus();
};
document.getElementById("wkSave").onclick = function(){
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

function tick(){
  const now = new Date();
  document.getElementById("clockChip").innerHTML =
    "<b>"+pad(now.getHours())+":"+pad(now.getMinutes())+":"+pad(now.getSeconds())+"</b>&nbsp; "
    + DOW_FULL[now.getDay()].slice(0,2) + ". " + now.getDate() + ". " + MONTHS[now.getMonth()].slice(0,3);
  const m = moonInfo(now);
  document.getElementById("moonChip").innerHTML =
    '<span class="big">'+m.emoji+"</span><b>"+m.name+"</b>&nbsp; "+m.illum+" %";
  const z = zodiacInfo(now);
  document.getElementById("zodiacChip").innerHTML =
    '<span class="big">'+z.sym+"</span><b>"+z.name+"</b>";
  try{ if(curView==="work" || workRunningToday()) updateWorkLive(); }catch(e){}
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
function repLabel(r){
  return r==="daily"?"Täglich":r==="weekly"?"Wöchentlich":r==="monthly"?"Monatlich":r==="quarterly"?"Vierteljährlich":r==="yearly"?"Jährlich":"";
}
function updateTaskBadge(){ try{ var b=document.getElementById('todoBadge'); if(!b) return; var n=0; if(typeof S!=="undefined"&&S&&Array.isArray(S.todos)) n=S.todos.filter(function(t){return inProfile(t.cat) && !taskIsDone(t)}).length; b.textContent=n; b.style.display=n?"grid":"none"; }catch(e){} }
function renderTasks(){
  try{
    if(typeof S==="undefined"||!S) S=defaults();
    if(!Array.isArray(S.todos)) S.todos=[];
    var list=document.getElementById('tasksList'); if(!list) return;
    var search=((document.getElementById('taskSearch')||{}).value||"").trim().toLowerCase();
    var filter=(document.getElementById('taskFilter')||{}).value||"all";
    var items=S.todos.filter(function(t){
      if(!inProfile(t.cat)) return false;
      var done=taskIsDone(t);
      if(filter==="open" && done) return false;
      if(filter==="done" && !done) return false;
      if(search && String(t.title||t.text||"").toLowerCase().indexOf(search)<0) return false;
      return true;
    });
    if(!items.length){ list.innerHTML='<div class="empty"><span class="big">🗒️</span>Keine Aufgaben vorhanden.</div>'; }
    else {
      list.innerHTML=items.map(function(t){
        var idx=S.todos.indexOf(t);
        var done=taskIsDone(t);
        var c=(typeof cat==="function")?cat(t.cat):{name:"",color:"#64748b"};
        var rep=repLabel(t.repeat);
        return '<div class="item'+(done?" done":"")+'">'
          + '<button class="check'+(done?" on":"")+'" data-task-toggle="'+idx+'">✓</button>'
          + '<div><div class="it-title">'+esc(t.title||t.text||"")+'</div>'
          + '<div class="it-sub"><span class="pill" style="background:'+c.color+'">'+esc(c.name)+'</span>'
          + (rep?'<span>↻ '+esc(rep)+'</span>':'')
          + (t.due?'<span>📅 '+esc(t.due)+'</span>':'')
          + (t.note?'<span> '+esc(t.note)+'</span>':'')+'</div></div>'
          + '<div class="it-actions"><button class="linkbtn" data-task-edit="'+idx+'">Bearbeiten</button>'
          + '<button class="linkbtn del" data-task-del="'+idx+'">Löschen</button></div>'
          + '</div>';
      }).join("");
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
    var items=S.routines.filter(function(r){ return inProfile(r.cat); });
    if(!items.length){ list.innerHTML='<div class="empty"><span class="big">🗓️</span>Keine Routinen vorhanden.</div>'; }
    else {
      list.innerHTML=items.map(function(r){
        var i=S.routines.indexOf(r);
        var c=(typeof cat==="function")?cat(r.cat):null;
        var rep=repLabel(r.freq);
        return '<div class="item"><div><div class="it-title">'+esc(r.name||'')+'</div><div class="it-sub">'
          +(c?'<span class="pill" style="background:'+c.color+'">'+esc(c.name)+'</span>':'')
          +(rep?'<span>↻ '+esc(rep)+'</span>':'')
          +(r.note?'<span> '+esc(r.note)+'</span>':'')
          +'</div></div><div class="it-actions">'
          +'<button class="linkbtn" data-routine-edit="'+i+'">Bearbeiten</button>'
          +'<button class="linkbtn del" data-routine-del="'+i+'">Löschen</button></div></div>';
      }).join('');
    }
  }catch(e){}
}
(function(){
  document.addEventListener('click', function(e){
    var t=e.target;
    if(t.matches&&t.matches('[data-task-edit]')){
      var idx=parseInt(t.getAttribute('data-task-edit'));
      if(!isNaN(idx)&&Array.isArray(S.todos)&&S.todos[idx]) openTodo(S.todos[idx].id, "task");
      return;
    }
    if(t.matches&&t.matches('[data-task-del]')){
      var idx=parseInt(t.getAttribute('data-task-del'));
      if(!isNaN(idx)&&Array.isArray(S.todos)&&idx>=0&&idx<S.todos.length){ S.todos.splice(idx,1); save(); renderTasks(); updateBadges(); }
      return;
    }
    if(t.matches&&t.matches('[data-task-toggle]')){
      var ti=parseInt(t.getAttribute('data-task-toggle'));
      if(!isNaN(ti)&&Array.isArray(S.todos)&&S.todos[ti]){
        var tk=S.todos[ti];
        if(tk.repeat&&tk.repeat!=="none"){
          var was=taskIsDone(tk);
          tk.lastDone=was?null:iso(today());
          if(!was) addPoints(tk.points||1, tk.title); else removePoints(tk.points||1, tk.title);
        }
        else {
          var wasd=tk.done; tk.done=!tk.done;
          if(!wasd) addPoints(tk.points||1, tk.title); else removePoints(tk.points||1, tk.title);
        }
        save(); renderTasks(); updateBadges();
      }
      return;
    }
    if(t.matches&&t.matches('[data-routine-edit]')){
      var ridx=parseInt(t.getAttribute('data-routine-edit'));
      if(!isNaN(ridx)&&Array.isArray(S.routines)&&S.routines[ridx]) openTodo(ridx, "routine");
      return;
    }
    if(t.matches&&t.matches('[data-routine-del]')){
      var ridx=parseInt(t.getAttribute('data-routine-del'));
      if(!isNaN(ridx)&&Array.isArray(S.routines)&&ridx>=0&&ridx<S.routines.length){ S.routines.splice(ridx,1); save(); renderRoutines(); }
      return;
    }
  });
  document.addEventListener('input', function(e){
    if(e.target&&e.target.id==='taskSearch') renderTasks();
  });
  document.addEventListener('change', function(e){
    if(e.target&&e.target.id==='taskFilter') renderTasks();
  });
})();
(function(){
  document.addEventListener('click', function(e){
    var t=e.target;
    if(t.matches('#workClearDay')){ if(confirm('Tag wirklich leeren?')){ var k=wkTodayKey(); if(typeof S!=="undefined") delete S.work[k]; try{save();if(typeof renderWork==="function")renderWork();if(typeof updateWorkLive==="function")updateWorkLive();}catch(ex){} return; }
    }
    if(t.matches('[data-wk-edit]')){ openWorkDay(wkTodayKey()); return; }
    if(t.matches('[data-wk-editday]')){ openWorkDay(t.getAttribute('data-wk-editday')); return; }
    if(t.matches('[data-wk-rowdel]')){
      syncWkDraft();
      var ri=parseInt(t.getAttribute('data-wk-rowdel'));
      if(!isNaN(ri)&&wkDraft.length>1){ wkDraft.splice(ri,1); renderWkRows(); }
      else { wkDraft=[{s:"",e:""}]; renderWkRows(); }
      return;
    }
    if(t.matches('[data-wk-del]')){ var idx=parseInt(t.getAttribute('data-wk-del')); var k=wkTodayKey(); var a=workArr(k); if(!isNaN(idx)&&a[idx]){ a.splice(idx,1); try{save();if(typeof renderWork==="function")renderWork();}catch(ex){} return; }
    }
    if(t.matches('[data-wk-delall]')){ var kk=t.getAttribute('data-wk-delall'); if(typeof S!=="undefined"&&S.work&&S.work[kk]){ if(confirm('Tag '+kk.split('-').reverse().join('.')+' wirklich leeren?')){ delete S.work[kk]; try{save();if(typeof renderWork==="function")renderWork();}catch(ex){} return; }}
    }
  });
})();
function renderCalSide(){
  try{
    if(typeof S==="undefined"||!S) return;
    var tBox=document.getElementById('calTasksList');
    if(tBox){
      var todos=(Array.isArray(S.todos)?S.todos:[]).filter(function(t){ return inProfile(t.cat); });
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
            +(t.due?'<span>📅 '+esc(t.due)+'</span>':'')+'</div></div>'
            +'<div class="it-actions"><button class="btn sm" data-task-edit="'+idx+'" title="Bearbeiten">✎</button>'
            +'<button class="btn sm del" data-task-del="'+idx+'" title="Löschen">🗑</button></div>'
            +'</div>';
        }).join('');
      }
      var cnt=document.getElementById('calTaskCount');
      if(cnt){
        var open=todos.filter(function(t){return !taskIsDone(t)}).length;
        cnt.textContent=open;
      }
    }
    var rBox=document.getElementById('calRoutinesList');
    if(rBox){
      var routines=(Array.isArray(S.routines)?S.routines:[]).filter(function(r){ return inProfile(r.cat); });
      if(!routines.length){
        rBox.innerHTML='<div class="empty"><span class="big">🗓️</span>Noch keine Routinen.</div>';
      }else{
        rBox.innerHTML=routines.map(function(r){
          var i=S.routines.indexOf(r);
          return '<div class="item"><div><div class="it-title">'+esc(r.name||'')+'</div>'
            +'<div class="it-sub"><span>↻ '+esc(repLabel(r.freq))+'</span>'+(r.note?' · '+esc(r.note):'')+'</div></div>'
            +'<div class="it-actions"><button class="btn sm" data-routine-edit="'+i+'" title="Bearbeiten">✎</button>'
            +'<button class="btn sm del" data-routine-del="'+i+'" title="Löschen">🗑</button></div></div>';
        }).join('');
      }
      var rcnt=document.getElementById('calRoutineCount');
      if(rcnt) rcnt.textContent=routines.length;
    }
  }catch(e){}
}
