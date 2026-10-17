# Plan: Ende-zu-Ende-Verschlüsselung für den Supabase-Cloud-Sync

> Status: Plan fertig, noch nicht umgesetzt.
> Datum: 2026-10-17
> Umsetzung: In den Build-Modus wechseln (Shift+Tab) und diesen Plan abarbeiten.

## Ziel

Kalenderdaten liegen bei Supabase **nur noch verschlüsselt** vor. Der Schlüssel
verlässt das Browser-Gerät nie – Supabase speichert nur Chiffre-Blobs.

**Bedrohungsmodell:**
- ✅ Schützt vor Einblick in DB/Dumps/Supabase-Projekt, Supabase-Staff, Fehlkonfiguration der RLS-Regeln.
- ❌ Metadaten (`user_id`, `updated_at`) bleiben sichtbar (unvermeidbar beim LWW-Blob-Sync).
- ❌ Schützt nicht vor XSS im Browser (Standardgrenze von E2E in Web-Apps).

## Getroffene Entscheidungen (vom Nutzer bestätigt)

1. **Schlüsselmanagement: Familien-Passphrase** – echtes E2E, Schlüssel wird per
   PBKDF2 aus der Passphrase abgeleitet, die nur die Familie kennt.
2. **Schlüssel-Cache: Opt-in** – Checkbox „Auf diesem Gerät merken" (standardmäßig
   aus), speichert den DEK in localStorage.
3. **Notfallkette: mit einbauen** – druckbarer Schlüssel-Export + Import zur
   Wiederherstellung ohne Passphrase.

## Kryptografisches Design

```
Passphrase ──PBKDF2(SHA-256, 600.000 Iterationen, 16-Byte-Salt)──▶ KEK
KEK ──unwrap/wrapKey──▶ zufälliger 256-Bit-DEK (Data-Encryption-Key)
DEK ──AES-256-GCM, 12-Byte-IV──▶ Kalender-JSON → Chiffretext
```

Envelope (landet in der bestehenden `data`-jsonb-Spalte, **keine Schema-Änderung**):

```json
{
  "v": 1,
  "alg": "AES-GCM",
  "kdf": "PBKDF2-SHA256",
  "it": 600000,
  "salt": "…base64…",
  "iv": "…base64…",
  "dek": "…vom KEK umhüllter DEK, base64…",
  "ct": "…base64-Chiffretext…"
}
```

- Salt: 16 Byte, zufällig, einmalig pro Konto, bleibt danach konstant (liegt in der Envelope).
- IV: 12 Byte, zufällig **bei jeder** Verschlüsselung.
- Passphrase-Änderung: KEK neu ableiten, DEK neu umhüllen, erneut pushen
  (der Chiffretext selbst muss nicht neu erstellt werden).
- Falsche Passphrase / manipulierter Chiffretext: GCM-AuthTag scheitert →
  Klartext bleibt lokal erhalten, freundliche Fehlermeldung, kein Datenverlust.

**Bewusst verworfene Alternativen:**
- Schlüssel aus Session-Token oder user_id+Secret ableiten → kein E2E (Secret im auslieferbaren JS).
- pgcrypto / Supabase Vault serverseitig → Schlüssel bleibt serverseitig.
- Asymmetrisch pro Familienmitglied → erst nötig, wenn Kalender zwischen
  verschiedenen Konten geteilt werden soll (aktuelles Schema: pro User private Zeile).

## Sync-Logik – was gleich bleibt

Das bestehende Design (ein JSON-Blob pro User, Last-Write-Wins über `updated_at`,
`dirty`-Flag, `sig`-Fingerabdruck, 1,2 s Debounce-Pull/Pull-on-Login) bleibt
**unverändert**. Zwei kritische Details:

1. Der `sig`-Fingerabdruck (`cloudHash`) wird weiter über den **Plaintext**
   berechnet – GCM erzeugt bei jedem Verschlüsseln ein zufälliges IV, ein
   Vergleich von Kryptotexten wäre wertlos.
2. `updated_at` wird unverändert mitgeschickt; die LWW-Entscheidung in
   `cloudPull` trifft nur der Client, der ja allein entschlüsseln kann.

## Änderungen pro Datei

### 1. `crypto.js` (neu, ~80–120 Zeilen, nur natives WebCrypto, kein Dependency)

- `deriveKey(passphrase, salt)` → PBKDF2 → KEK (CryptoKey, `deriveKey`, usages wrap/unwrap)
- `newDEK()` → zufälliger 256-Bit-DEK (AES-GCM)
- `wrapDEK(kek, dek)` / `unwrapDEK(kek, wrapped)` → `wrapKey`/`unwrapKey` (AES-KW oder GCM)
- `encryptState(dek, jsonString)` → Envelope-Objekt
- `decryptState(dek, envelope)` → Plaintext-String oder Fehler
- `exportKey(dek)` / `importKey(bytes)` → base64-Rohbytes für Notfallkette
- `randomBytes(n)`, base64-Helfer (btoa/atob-Umhüllungen)

### 2. `index.html` (Passphrase-Dialog im Cloud-Bereich, gleiche Optik wie E-Mail-Flow)

- Neuer Block neben `sbStatus` (Zeile ~334), z. B. `sbPassRow`:
  - Ersteinrichtung: zwei Eingabefelder (Passphrase + Bestätigung),
    Hinweis „≥ 12 Zeichen, vergessen = Datenverlust"
  - Wiederkehrend: ein Eingabefeld + Checkbox „Auf diesem Gerät merken"
  - Buttons: „Entsperren", „Notfallkette drucken", „Notfallkette importieren"
- `<script src="crypto.js"></script>` vor `app.js` einbinden

### 3. `app.js` (Cloud-Sync-Abschnitt, ca. Zeilen 4786–5120, ~100 Zeilen Änderung)

- `cloud.key` (CryptoKey, nur Arbeitsspeicher) und
  `cloudCacheKey = KEY + ".cloudkey"` für den Opt-in-Cache in localStorage
- `cloudEnsureKey()` → gibt Promise zurück:
  1. `cloud.key` vorhanden? → sofort
  2. Cache-Eintrag vorhanden? → DEK importieren, fertig
  3. sonst Passphrase-Dialog anzeigen, Aufrufer warten lassen
- `cloudPush`: statt `data: payload` → `cloudEnsureKey()` →
  `crypto.encryptState(dek, JSON.stringify(payload))` → Envelope als `data`
- `cloudPull`: Zeile hat `v`-Feld? → `cloudEnsureKey()` → `decryptState` →
  erst dann `cloudApplyRemote(decrypted, remoteAt)`. Kein `v`-Feld →
  **Migration**: Plaintext-Zeile wird beim nächsten Push automatisch überschrieben
  (siehe Migrations-Ablauf unten)
- `cloudApplyRemote` bleibt unverändert (arbeitet weiter mit dem Klartext-Objekt)
- Passphrase-Änderung (optionaler Button im Dialog): neu ableiten → DEK umhüllen
  → pushen → Cache aktualisieren
- Entsperrt-Dialog-Logik in `cloudBindAuthUI` ergänzen bzw. neue
  `cloudBindPassUI()`: Validierung (Länge, Bestätigung), Fehlermeldungen
- Statusmeldungen über bestehende `cloudStatus()`:
  - „Passphrase erforderlich, um die Cloud-Daten zu entsperren."
  - „Falsche Passphrase – Cloud-Daten bleiben unentschlüsselt, lokal ist alles erhalten."

### 4. `test-cloudsync.js` erweitern (Node ≥ 18 hat `crypto.subtle` global)

- Mock-Envelope bauen, Roundtrip testen (ver- → entschlüsseln ergibt Original)
- Falsche Passphrase → `decryptState` wirft / GCM schlägt fehl
- Tamper-Test: manipuliertes `ct`-Byte → AuthTag-Fehler, Klartext bleibt lokal
- Migrationstest: Zeile ohne `v`-Feld wird erkannt und neu migriert
- Bestehende Mocks um `crypto.js`-Ladung ergänzen

### 5. `SUPABASE.md` (kurzer Abschnitt)

- Einrichtung: Passphrase wählen, Notfallkette ausdrucken und verwahren
- Warnung: alle Familiengeräte zeitnah updaten (alte Clients schreiben Klartext,
  wird aber automatisch re-migriert – kein Datenverlust)
- Hinweise zu Grenzen: Metadaten sichtbar, XSS, Passphrase-Vergessen

## Migrations-Ablauf für bestehende Daten

1. Neues Update auf alle Geräte (zeitnah, aber kein harter Zwang).
2. Beim ersten Öffnen nach dem Update: Anmeldung wie gewohnt → Pull sieht alte
   Zeile ohne `v` → Passphrase-Dialog (Einrichtung) → lokale Daten werden
   verschlüsselt → Push überschreibt die Zeile mit der Envelope → fertig.
3. Danach: jedes neue Gerät braucht Anmeldung + Passphrase (bzw. Notfallkette).
4. Alte App-Versionen auf anderen Geräten schreiben weiter Klartext – wird vom
   neuen Client beim nächsten Pull als Migrationsfall erkannt und überschrieben.

## Reihenfolge bei der Umsetzung

1. `crypto.js` schreiben
2. `test-cloudsync.js` erweitern und grün bekommen (Tests zuerst oder parallel)
3. `index.html`: Dialog + Script-Tag
4. `app.js`: ensureKey, Push/Pull umhängen, UI-Bindung
5. `SUPABASE.md` ergänzen
6. Manuell testen: Ersteinrichtung, zweites Gerät, falsche Passphrase,
   Notfallkette-Import, Passphrase-Änderung, Migration einer bestehenden Zeile
