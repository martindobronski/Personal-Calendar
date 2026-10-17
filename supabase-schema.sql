-- =========================================================
--  Supabase-Schema für den Cloud-Sync des Familienkalenders
--  Ausführen: Supabase-Dashboard → SQL Editor → New query
--             → alles einfügen → Run
-- =========================================================

-- Eine Zeile pro Konto: der komplette Kalender als JSON.
create table if not exists public.kalender_state (
  user_id    uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- updated_at bei jeder Änderung automatisch auf "jetzt" setzen
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists kalender_state_touch on public.kalender_state;
create trigger kalender_state_touch
  before update on public.kalender_state
  for each row execute function public.touch_updated_at();

-- Sicherheit: Jede(r) sieht und ändert nur die eigenen Daten (Row Level Security).
-- Ohne diese Regeln könnte niemand etwas lesen oder schreiben.
alter table public.kalender_state enable row level security;

drop policy if exists "eigene daten" on public.kalender_state;
create policy "eigene daten" on public.kalender_state
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =========================================================
--  Einrichtung im Dashboard (einmalig):
--  1. Authentication → Providers → "Email" aktiviert lassen,
--     "Confirm email" AUS (sonst braucht man einen Bestätigungslink
--     zusätzlich zum Anmeldelink).
--  2. Authentication → URL Configuration:
--     Site URL = eure Adresse (z. B. https://euer-name.netlify.app)
--     Redirect URLs = dieselbe Adresse (+ http://localhost:8080 zum Testen)
--  3. Auf der Projekt-Startseite „Connect“ klicken (oder unten links das
--     Zahnrad „Project Settings“ → „API Keys“): Project URL und den
--     öffentlichen Schlüssel (sb_publishable_… bzw. „anon public“) in die
--     Datei supabase.config.js eintragen.
-- =========================================================
