/* Testharness: lädt den Cloud-Sync-Teil von app.js mit geMocktem Supabase-Client. */
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/app.js", "utf8");
const marker = "var CLOUD_META_KEY";
const idx = app.indexOf(marker);
if (idx < 0) { console.error("Cloud-Block nicht gefunden"); process.exit(1); }
const block = app.slice(idx);

// --- DOM-/Browser-Stubs (global, damit der eval-Block sie sieht) ---
const els = {};
function mkEl(id) {
  return {
    id, textContent: "", value: "", style: {}, handlers: {},
    addEventListener(t, f) { this.handlers[t] = f; },
    focus() {}
  };
}
global.window = {
  __supabaseReady: true,
  addEventListeners: {},
  addEventListener(t, f) { (this.addEventListeners[t] = this.addEventListeners[t] || []).push(f); },
  dispatchEvent() {}
};
global.document = {
  getElementById: id => (els[id] = els[id] || mkEl(id)),
  addEventListener() {},
  querySelector: () => null,
  hidden: false,
  visibilityState: "visible"
};
global.location = { protocol: "http:", origin: "http://localhost:8000", pathname: "/" };
const mem = {};
global.localStorage = {
  getItem: k => (k in mem ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
  removeItem: k => { delete mem[k]; }
};

// --- App-Stubs (so wie in app.js) ---
global.KEY = "familienkalender.v1";
global.uid = () => Math.random().toString(36).slice(2, 10);
global.defaults = () => ({
  categories: [{ id: "c1", name: "Papa", color: "#38bdf8" }],
  events: [], todos: [], tasks: [], routines: [], birthdays: [], meals: {},
  lists: [{ id: "l1", name: "Einkaufsliste", items: [] }],
  rewards: [], points: 0, history: [],
  settings: { appTitle: "Test" }
});
global.S = global.defaults();
global.rendered = 0;
global.render = () => { global.rendered++; };
global.toastMsg = "";
global.toast = m => { global.toastMsg = m; };
global.curList = null;
global.save = function () {
  const json = JSON.stringify(global.S);
  global.localStorage.setItem(global.KEY, json);
  try { global.cloudNoteLocalChange(json); } catch (e) { /* noch nicht eingebunden */ }
};

// --- In-Memory-"Supabase" mit Server-Uhr ---
let serverNow = Date.now() - 60000; // Server-Uhr läuft 1 Min. hinter der lokalen
const table = {};
const writeTimes = [];
function clientBuilder() {
  return {
    from(name) {
      let op = null, payload = null, filters = {}, single = false;
      const b = {
        upsert(row) { op = "upsert"; payload = row; return b; },
        select() { if (op !== "upsert") op = "select"; return b; },
        eq(k, v) { filters[k] = v; return b; },
        maybeSingle() { single = true; return b; },
        then(resolve, reject) {
          let result;
          if (op === "upsert") {
            serverNow += 5000; // Trigger: updated_at = now()
            const updated_at = new Date(serverNow).toISOString();
            table[payload.user_id] = { user_id: payload.user_id, data: JSON.parse(JSON.stringify(payload.data)), updated_at };
            writeTimes.push(updated_at);
            result = { data: [{ updated_at }], error: null };
          } else {
            // wie im echten Client: die Zeile kommt frisch aus dem JSON-Response
            const row = table[filters.user_id] || null;
            const copy = row ? JSON.parse(JSON.stringify(row)) : null;
            result = single ? { data: copy, error: null } : { data: copy ? [copy] : [], error: null };
          }
          return Promise.resolve(result).then(resolve, reject);
        }
      };
      return b;
    },
    auth: {
      getSession() { return Promise.resolve({ data: { session: { user: { id: "u1", email: "fam@test.de" } } } }); },
      onAuthStateChange() { return { data: { subscription: {} } }; },
      signInWithOtp() { return Promise.resolve({ error: null }); },
      signOut() { return Promise.resolve({ error: null }); }
    }
  };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
let failed = 0;
const ok = (name, cond, extra) => {
  if (!cond) failed++;
  console.log((cond ? "  ✓ " : "  ✗ FEHLER: ") + name + (cond || extra === undefined ? "" : " → " + extra));
};

(async function () {
  console.log("Start: App lädt, dann Supabase-Client wird bereitgestellt.");
  global.window.SUPABASE_CONFIG = { url: "https://testprojekt.supabase.co", anonKey: "eyJ-test-key" }; // wie supabase.config.js
  global.save();                       // wie app.js beim Start
  global.window.sbClient = clientBuilder();
  (0, eval)(block);                    // Cloud-Modul global einbinden
  await wait(30);

  console.log("\n1) Anmeldung & erster Sync");
  ok("angemeldet", global.cloud.user && global.cloud.user.id === "u1");
  ok("Anmeldung ausgeblendet, Abmelden sichtbar",
    document.getElementById("sbAnonRow").style.display === "none" &&
    document.getElementById("sbAuthedRow").style.display === "");
  await wait(1400);                    // Debounce-Zeit abwarten
  ok("Daten in der Cloud", !!table.u1 && table.u1.data.events.length === 0, JSON.stringify(table.u1));
  ok("dirty danach false", global.cloud.meta.dirty === false);

  console.log("\n2) Lokale Änderung wird hochgeladen");
  global.S.events.push({ id: "e1", title: "Zahnarzt", date: "2026-10-20" });
  global.save();
  ok("Push geplant (debounced)", !!global.cloud.pushTimer);
  await wait(1400);
  ok("Änderung in der Cloud", table.u1.data.events.length === 1, JSON.stringify(table.u1.data.events));
  ok("dirty=false nach Push", global.cloud.meta.dirty === false);
  const afterPush = JSON.stringify(table.u1.data);

  console.log("\n3) Cloud ist neuer (zweites Gerät) → wird übernommen");
  table.u1.data = JSON.parse(JSON.stringify(global.defaults()));
  table.u1.data.events.push({ id: "e2", title: "Kino (vom Handy)", date: "2026-10-21" });
  const remoteNew = new Date(Date.now() - 30000).toISOString(); // 30 Sek. alt, neuer als unser letzter Kontakt
  table.u1.updated_at = remoteNew;
  await global.cloudPull(true);
  ok("Cloud-Daten übernommen", global.S.events.some(e => e.id === "e2"), JSON.stringify(global.S.events));
  ok("App neu gerendert", global.rendered > 0);
  ok("dirty=false nach Übernahme", global.cloud.meta.dirty === false);
  ok("Hinweis im UI", /Aus der Cloud geladen/.test(document.getElementById("sbStatus").textContent),
    document.getElementById("sbStatus").textContent);

  console.log("\n4) Beide Seiten geändert → lokalere Änderung gewinnt");
  global.S.events.push({ id: "e3", title: "Lokal neu", date: "2026-10-22" });
  global.save();
  await wait(10);
  table.u1.updated_at = new Date(Date.now() - 20000).toISOString(); // Cloud zieht auch noch nach
  await global.cloudPull(true);
  ok("Lokale Änderung nicht überschrieben", global.S.events.some(e => e.id === "e3"), JSON.stringify(global.S.events));
  await wait(1400);
  ok("…und in der Cloud gelandet", (table.u1.data.events || []).some(e => e.id === "e3"),
    JSON.stringify(table.u1.data.events));

  console.log("\n5) Ohne Änderung kein Traffic, Meta getrennt vom Zustand");
  const before = JSON.stringify(table.u1.data);
  global.save(); global.save();
  await wait(1400);
  ok("kein Push ohne Änderung", JSON.stringify(table.u1.data) === before);
  ok("Zeitstempel nicht im synchronisierten Zustand",
    !JSON.stringify(table.u1.data).includes("changedAt"));
  ok("Meta persistiert", !!global.localStorage.getItem(global.KEY + ".cloud"));

  console.log("\n6) Ab-/Anmelden und Offline-Fälle");
  const btn = document.getElementById("btnSbLogout");
  ok("Abmelden-Button verdrahtet", typeof btn.onclick === "function");
  btn.onclick();
  ok("Status nach Abmeldung", /Abgemeldet/.test(document.getElementById("sbStatus").textContent),
    document.getElementById("sbStatus").textContent);
  ok("lokale Daten bleiben", global.S.events.length > 0);

  // Offline: Push schlägt fehl, beim Zurückkommen wird nachgeholt
  global.cloud.user = { id: "u1" };
  global.cloud.pulledFor = null;
  const origFrom = global.cloud.client.from;
  global.cloud.client.from = function () {
    const b = origFrom.call(this, "kalender_state");
    b.then = (res, rej) => Promise.resolve({ data: null, error: { message: "Failed to fetch" } }).then(res, rej);
    return b;
  };
  global.S.events.push({ id: "e4", title: "Offline-Termin", date: "2026-10-23" });
  global.save();
  await wait(1400);
  ok("Offline-Fehlermeldung", /nicht erreichbar/.test(document.getElementById("sbStatus").textContent),
    document.getElementById("sbStatus").textContent);
  ok("Änderung bleibt dirty (offline)", global.cloud.meta.dirty === true);
  global.cloud.client.from = origFrom;
  await global.cloudPush();
  await wait(50);
  ok("nach Verbindungswiederherstellung hochgeladen", (table.u1.data.events || []).some(e => e.id === "e4"),
    JSON.stringify(table.u1.data.events));

  console.log("\n7) Anmeldelink (Magic Link) über das Formular");
  global.cloud.user = null;
  global.cloud.signedInBefore = false;
  global.cloudRenderAuth();
  const loginBtn = document.getElementById("btnSbLogin");
  ok("Anmelde-Button verdrahtet", typeof loginBtn.onclick === "function");
  document.getElementById("sbEmail").value = "keine-adresse";
  loginBtn.onclick();
  ok("ungültige E-Mail abgelehnt", /gültige E-Mail-Adresse/.test(document.getElementById("sbStatus").textContent),
    document.getElementById("sbStatus").textContent);
  document.getElementById("sbEmail").value = "fam@test.de";
  loginBtn.onclick();
  await wait(20);
  ok("Anmeldelink-Versand gemeldet", /Anmeldelink gesendet an fam@test\.de/.test(document.getElementById("sbStatus").textContent),
    document.getElementById("sbStatus").textContent);
  ok("Toast-Einblendung", /Anmeldelink gesendet/.test(global.toastMsg), global.toastMsg);
  ok("Eingabefeld-Eingabe (Enter) verdrahtet", typeof document.getElementById("sbEmail").handlers.keydown === "function");

  console.log("\n8) Nie angemeldet vs. abgemeldet");
  global.cloud.signedInBefore = false;
  global.cloudSetUser(null, false);
  ok("Hinweis für Erstnutzer", /E-Mail eingeben, um den Sync zu starten/.test(document.getElementById("sbStatus").textContent),
    document.getElementById("sbStatus").textContent);
  global.cloud.signedInBefore = true;
  global.cloudSetUser(null, false);
  ok("Hinweis nach Abmeldung", /pausiert/.test(document.getElementById("sbStatus").textContent),
    document.getElementById("sbStatus").textContent);

  console.log("\n9) Änderung im kurzen Fenster vor dem Laden des Clients");
  global.cloud.snapshot = null;                     // wie nach einem Neuladen
  global.cloud.meta.dirty = false;
  global.cloud.meta.sig = global.cloudHash(JSON.stringify(global.S));
  global.cloudSaveMeta();
  global.save();
  ok("gleiche Daten → kein Fehlalarm", global.cloud.meta.dirty === false);
  global.S.events.push({ id: "e5", title: "Ganz früh am Morgen", date: "2026-10-24" });
  global.cloud.snapshot = null;
  global.save();
  ok("echte Änderung erkannt (ohne bereiten Client)", global.cloud.meta.dirty === true);
  global.cloudSetUser({ id: "u1", email: "fam@test.de" }, true);
  await wait(1500);
  ok("später doch hochgeladen", (table.u1.data.events || []).some(e => e.id === "e5"),
    JSON.stringify(table.u1.data.events));

  console.log("\n10) Fehler aus der Rückkehr-URL (z. B. abgelaufener Link)");
  global.location.hash = "#error_code=401&error_description=Email+link+is+invalid+or+has+expired";
  ok("Fehler erkannt und gemeldet", global.cloudReportUrlError() === true &&
    /Anmeldung fehlgeschlagen/.test(document.getElementById("sbStatus").textContent),
    document.getElementById("sbStatus").textContent);
  global.location.hash = "";
  ok("ohne Fehler keine Meldung", global.cloudReportUrlError() === false);

  console.log("\n11) Automatisch nachziehen beim Zurückwechseln auf den Tab");
  // Zustand: angemeldet, nichts offen, nichts in Bewegung
  global.cloud.user = { id: "u1", email: "fam@test.de" };
  global.cloud.pulledFor = "u1";
  global.cloud.meta.dirty = false;
  global.cloud.meta.remoteAt = Date.now() - 600000;
  global.cloudLastAutoPull = 0;
  global.document.visibilityState = "visible";
  global.document.hidden = false;
  global.document.querySelector = () => null;
  // zweites Gerät schreibt in die Cloud
  table.u1.data = JSON.parse(JSON.stringify(global.defaults()));
  table.u1.data.events.push({ id: "e6", title: "Vom Handy", date: "2026-10-25" });
  table.u1.updated_at = new Date(Date.now() + 30000).toISOString();
  global.cloudAutoPull();
  await wait(30);
  ok("neuer Eintrag erscheint beim Zurückwechseln", global.S.events.some(e => e.id === "e6"),
    JSON.stringify(global.S.events));
  ok("kein Toast dabei (leise)", !/Cloud-Daten geladen/.test(global.toastMsg), global.toastMsg);

  // Schutz 1: zu schnell hintereinander
  global.cloud.meta.remoteAt = Date.now() - 600000;
  table.u1.data.events.push({ id: "e7", title: "Sofort danach", date: "2026-10-26" });
  table.u1.updated_at = new Date(Date.now() + 60000).toISOString();
  global.cloudAutoPull();
  await wait(30);
  ok("Rückhol-Schutz (max. alle 10 s)", !global.S.events.some(e => e.id === "e7"));

  // Schutz 2: Dialog ist offen
  global.cloudLastAutoPull = 0;
  global.document.querySelector = () => ({});
  table.u1.data.events.push({ id: "e8", title: "Dialog offen", date: "2026-10-27" });
  table.u1.updated_at = new Date(Date.now() + 90000).toISOString();
  global.cloudAutoPull();
  await wait(30);
  ok("kein Umbau, solange ein Dialog offen ist", !global.S.events.some(e => e.id === "e8"));
  global.document.querySelector = () => null;

  // Schutz 3: eigene Änderung steht noch aus (Push-Timer)
  global.cloudLastAutoPull = 0;
  global.cloud.pushTimer = setTimeout(() => {}, 5000);
  table.u1.data.events.push({ id: "e9", title: "Push steht aus", date: "2026-10-28" });
  table.u1.updated_at = new Date(Date.now() + 120000).toISOString();
  global.cloudAutoPull();
  await wait(30);
  ok("kein Rückholen mit laufendem Push", !global.S.events.some(e => e.id === "e9"));
  clearTimeout(global.cloud.pushTimer); global.cloud.pushTimer = null;

  // Schutz 4: Tab ist versteckt
  global.cloudLastAutoPull = 0;
  global.document.hidden = true;
  table.u1.data.events.push({ id: "e10", title: "Tab versteckt", date: "2026-10-29" });
  table.u1.updated_at = new Date(Date.now() + 150000).toISOString();
  global.cloudAutoPull();
  await wait(30);
  ok("kein Rückholen, solange der Tab im Hintergrund ist", !global.S.events.some(e => e.id === "e10"));
  global.document.hidden = false;

  // und jetzt doch
  global.cloudLastAutoPull = 0;
  global.cloudAutoPull();
  await wait(30);
  ok("holt danach doch", global.S.events.some(e => e.id === "e10"), JSON.stringify(global.S.events));

  console.log("\n" + (failed ? failed + " TEST(S) FEHLGESCHLAGEN" : "Alle Tests bestanden ✓"));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error("EXCEPTION:", e); process.exit(1); });
