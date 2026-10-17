/* =========================================================
   Supabase-Zugangsdaten für den Cloud-Sync
   ---------------------------------------------------------
   Die "anon"-Key ist öffentlich – das ist in Ordnung, denn
   geschützt wird alles über die Row-Level-Security-Regeln
   (supabase-schema.sql). Niemand fremdes kann eure Daten lesen.
   ========================================================= */
window.SUPABASE_CONFIG = {
  // Projekt-URL: Supabase-Dashboard → Project Settings → API → Project URL
  url: "https://eoqejvxxniwnjzktordr.supabase.co",

  // Öffentlicher Schlüssel: gleiche Seite → "anon public"
  anonKey: "sb_publishable_OodwBukRO_q2Arww4ZVSrw_xRj_wNcS"
};
