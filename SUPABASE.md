# Cloud-Sync mit Supabase einrichten

Die App speichert weiterhin alles lokal im Browser. Mit Cloud-Sync kommt
optional eine Kopie in einem eigenen Supabase-Projekt dazu – damit sind die
Daten auf mehreren Geräten mit demselben Konto verfügbar.

**Voraussetzungen:** ein kostenloses Supabase-Projekt (supabase.com) und eine
ausgelieferte Adresse (Netlify/own server). Lokal testen: `python3 -m http.server`.

## 1. Datenbank anlegen

Supabase-Dashboard → **SQL Editor** → New query → den Inhalt von
`supabase-schema.sql` einfügen → **Run**.

Das legt die Tabelle `kalender_state` (eine Zeile pro Konto, der komplette
Kalender als `jsonb`) mit Row-Level-Security an: Jede(r) sieht und ändert nur
die eigenen Daten.

## 2. Anmeldung (E-Mail-Link) konfigurieren

### Authentication → Sign In / Providers (die vier Schalter)

| Einstellung | Wert | Warum |
|---|---|---|
| **Allow new users to sign up** | **An** | Muss an sein: Beim ersten Anmeldelink wird das Konto automatisch angelegt (`create_user`). Aus → Fehler „Signups not allowed for otp“. |
| Allow manual linking | Aus | Wird nicht gebraucht. |
| Allow anonymous sign-ins | Aus | Die App meldet per E-Mail an, nicht anonym. |
| **Confirm email** | **Aus** (Empfehlung) | Der Magic Link ist selbst die Bestätigung. Bei „An“ bekommt jeder neue Nutzer zusätzlich die Bestätigungs-Mail – geht auch, kann aber zu „Email not confirmed“ führen, wenn jemand die zweite Mail übersieht. |

### Auth Providers

- **Email → Enabled** (ist so eingestellt, bitte so lassen). Reinklicken und
  nur „Email OTP Expiration“ ansehen: Standard **3600 s = Anmeldelink 1 Stunde gültig**.
  Wer die Mail erst am Abend öffnet, muss ggf. einen neuen Link anfordern.
- **Alle anderen Provider (Phone, SAML, Apple, Google, …) bleiben Disabled.**

### Email Templates (Authentication → Email Templates → Magic Link)

Unverändert lassen! Die Vorlage muss `{{ .ConfirmationURL }}` enthalten.
Steht dort `{{ .Token }}`, kommt ein 6-stelliger Code – die App fragt aber
keinen Code ab, sondern erwartet einen Link.

### Authentication → URL Configuration (das Wichtigste)

Ohne diese Seite landet der Nutzer nach dem Klick auf der Supabase-Standardadresse
(`localhost:3000`) und es „passiert nichts“.

- **Site URL** = Adresse der App, z. B. `https://euer-name.netlify.app`
- **Redirect URLs** dazu:
  - `https://euer-name.netlify.app/**`
  - `http://localhost:8000/**` (zum lokalen Testen)

Der `emailRedirectTo`-Wert in der App ist `origin + pathname` und muss
exakt auf einer dieser Einträge liegen (deshalb das `/**`).

## 3. Zugangsdaten eintragen

**Wo?** supabase.com/dashboard → Projekt öffnen → auf der Startseite den Button
**„Connect“** klicken; dort stehen Project URL und der API-Schlüssel fertig zum
Kopieren. Alternativ: unten links das Zahnrad **Project Settings → API Keys**
(`supabase.com/dashboard/project/_/settings/api-keys/`). Es gibt keine
„Settings → API“-Seite mehr.

Beides in `supabase.config.js` einsetzen:

```js
window.SUPABASE_CONFIG = {
  url: "https://abcdefgh.supabase.co",
  anonKey: "sb_publishable_..."   // ältere Projekte: Schlüssel beginnt mit "eyJ"
};
```

Der Schlüssel ist öffentlich und gehört so ins Frontend – geschützt wird über
die Security-Regeln aus Schritt 1. **Niemals** den `sb_secret_…`-/`service_role`-
Schlüssel eintragen, der umgeht jede Sicherheitsregel.

Prüfzeichen: In den Einstellungen → Cloud-Sync muss nach dem Neuladen stehen
„Nicht angemeldet – E-Mail eingeben, um den Sync zu starten“ – steht dort
„nicht eingerichtet“, ist einer der beiden Werte noch leer.

Danach die Seite neu laden. In **Einstellungen → Cloud-Sync** erscheint das
Anmeldefeld.

## 4. Anmelden

E-Mail-Adresse eingeben → „Anmeldelink senden“ → Mail öffnen → Link antippen.
Zurück in der App werden die Cloud-Daten gelesen und mit den lokalen abgeglichen.

**Konfliktregel:** Die Seite mit dem neueren Änderungszeitstempel gewinnt
(Last-Write-Wins). Beim ersten Anmelden in einem neuen Browser werden die
lokalen Daten hochgeladen, solange dort nichts Neueres existiert.

## Ablauf des Sync

| Situation | Verhalten |
|---|---|
| Kein Login / keine Config | Alles bleibt lokal, es erscheint ein Hinweis in den Einstellungen |
| Änderung während angemeldet | Wird nach 1,2 s automatisch hochgeladen (debounced) |
| Offline | Änderung bleibt lokal, beim nächsten Verbindungsaufbau wird nachgeholt |
| Login auf zweitem Gerät | Neueste Fassung wird aus der Cloud geladen |
| Änderung am anderen Gerät | Beim Öffnen der Seite **und beim Zurückwechseln auf den Tab** (Fokus/Sichtbarkeit) wird kurz nachgezogen – maximal alle 10 s und nie während eines Dialogs oder laufender Synchronisierung. Ohne Tabwechsel: F5 |
| Abmelden | Cloud-Sync pausiert, lokale Daten bleiben erhalten |
| „Alles löschen“ | Leert auch die Cloud-Zeile (wird im Bestätigungsdialog erwähnt) |

## Grenzen

- **Mehrere Tabs/Fenster gleichzeitig:** Die App ist auf einen Tab ausgelegt.
  Wie bisher (localStorage) gewinnt beim gleichzeitigen Bearbeiten in zwei Tabs
  die zuletzt gespeicherte Fassung – dann auch in der Cloud. Bitte einen Tab
  verwenden oder nach dem Wechsel neu laden.
- **Gleichzeitige Änderungen auf zwei Geräten:** Es gewinnt die Seite mit dem
  neueren Zeitstempel; die jeweils andere Änderung geht dabei verloren
  (kein Zusammenführen einzelner Einträge).
- **„Alles löschen“** überschreibt auch die Cloud-Fassung.

## Fehlerbilder

- *„Cloud-Sync nicht eingerichtet“* → `supabase.config.js` ausfüllen.
- *„Supabase-Client konnte nicht geladen werden“* → CDN (esm.sh) nicht
  erreichbar; später neu laden. Die App funktioniert auch ohne Cloud weiter.
- *Beim Anmeldelink passiert nichts* → Redirect-URL in den Auth-Einstellungen
  prüfen (muss exakt der Seiten-URL entsprechen). Der Fehler steht dann
  zusätzlich im Statusfeld von Einstellungen → Cloud-Sync.
- *„Anmeldung fehlgeschlagen: email link not valid“* → Link abgelaufen
  (Standard 1 Stunde) oder Vorlage geändert – neuen Link anfordern und die
  Magic-Link-Vorlage auf `{{ .ConfirmationURL }}` zurücksetzen.
- *Sync-Fehler / permission denied* → `supabase-schema.sql` noch nicht
  ausgeführt oder RLS-Policy fehlt.
