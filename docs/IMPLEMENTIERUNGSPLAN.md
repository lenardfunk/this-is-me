# this-is-me – Implementierungsplan

Dieser Plan ist so geschrieben, dass ein Agent ihn **Phase für Phase** abarbeiten kann, ohne die
Konzeptdiskussion zu kennen. Jede Phase hat: Ziel, Aufgaben, Dateien, Akzeptanzkriterien.
Entscheidungen sind getroffen – nicht neu diskutieren. Wo etwas offen ist, steht es unter
„Offene Punkte" (dann den User fragen, nicht raten).

---

## Stand (2026-11-24)

- **Phasen 0–7 sind umgesetzt** (Build und Tests grün, im Browser gegen die Akzeptanzkriterien geprüft).
  Das Default-Deck ist mit Platzhalter-Inhalten komplett präsentierbar.
- **Deployment-Entscheidung (2026-11-24):** privates GitHub-Repo, Hosting auf **Vercel (Hobby)**.
  Jedes Deck wird unter einer **unratbaren UUID** veröffentlicht (eine UUID pro Bewerbung); es gibt
  keine öffentliche Startseite und keine Deck-Liste. Das Standard-Deck ist nur **Vorlage** und wird
  nicht veröffentlicht. `/` und `/d` zeigen „nicht gefunden". Details: Abschnitt 2.5, Phase 8 und 9.
- **Phase 8 (Veröffentlichungsmodell + Vercel)** und **Phase 9 (Ansicht „Veröffentlichung" im
  Slide-Creator)**: Code umgesetzt; das Anlegen des Vercel-Projekts macht der User selbst (Phase 8, Schritt 4).
- Weiterhin offen: echte Inhalte (Abschnitt 5, Punkte 2 und 3) und eine Lighthouse-Messung (Phase 7).

---

## 0. Kontext und Produktentscheidungen

**Zweck:** Eine Angular-Web-App, mit der sich der User (Full-Stack-Entwickler, bewirbt sich v. a. auf
Angular-Stellen) in **Remote-Bewerbungsgesprächen** per Bildschirmfreigabe vorstellt. Kern ist eine
**Selbstvorstellung von max. ~5 Minuten**. Die App ist zugleich ein Vorzeigeprojekt (sauberes,
modernes Angular).

**UX-Konzept (fest):**

- **Hub (Bento-Übersicht)**: Kachel-Raster aller Hauptthemen. Start- und Endpunkt. Kachel-Klick
  „morpht" per View Transition in die Folie. `Esc` führt zurück.
- **2D-Deck**: `→`/`←` = roter Faden (Hauptfolien + Schritte innerhalb einer Folie),
  `↓`/`↑` = optionale Vertiefungen unter einer Folie.
- **Werdegang-Folie („Journey")**: Ein echtes Landschaftsfoto (Bohlenweg → Hügel → Vulkan-Gipfel).
  Stationen liegen als %-Koordinaten auf dem Foto, ein gestrichelter Weg verbindet sie, eine Kamera
  zoomt pro Schritt zur nächsten Station, ein „Wanderer"-Punkt läuft mit. Gipfel = „die Firma,
  bei der ich mich bewerbe". Jederzeit Herauszoomen aufs Gesamtbild (`Z`/Button) und Stationen
  direkt anklicken. **Referenz-Prototyp: `docs/prototypes/werdegang/index.html`** (funktionierend,
  Verhalten 1:1 übernehmen).
- **Präsentator-Ansicht** in einem zweiten Browserfenster (Notizen, Timer, nächste Folie),
  synchronisiert per `BroadcastChannel`. Nur das Präsentationsfenster wird geteilt.
- **Decks pro Firma**: Ein Firmen-Deck erbt vom Standard-Deck und kann Folien umsortieren,
  weglassen, **ersetzen**, **hinzufügen** und einzelne Felder **überschreiben**.
- **Folien sind visuell**: wenig Text (3–5 Stichworte), große Bilder/Illustrationen/interaktive
  Elemente. Der ausführliche Text steht in Sprechernotizen.
- **Easter Eggs**: (1) versteckte Station (Hütte) auf dem Werdegang-Foto, (2) Porträt auf der
  Hallo-Folie lässt sich umdrehen (zweites Foto), (3) Wanderer auf dem Weg. **Kein** Tag/Nacht,
  **kein** IDE-/Terminal-Look.
- **Visueller Stil**: hell, warm, editorial. Serifen-Headlines (Fraunces), Sans-Fließtext (Inter),
  viel Weißraum, **eine** Akzentfarbe (pro Firma überschreibbar). Keine Admin-Panel-Optik.
- Offline/PWA: **nicht** nötig. Deployment auf **Vercel**, Quelle in einem **privaten** Repo
  (siehe 2.5). Kein öffentlicher Einstieg: jedes Deck ist nur über seinen UUID-Link erreichbar.

**Hauptpfad (Standard-Deck)**, ~5 Min:

| # | Block-ID | Layout | Inhalt |
|---|---|---|---|
| 1 | `hallo` | `hero` | Porträt (umdrehbar), Name, Rolle |
| 2 | `weg` | `journey` | Werdegang auf dem Foto, Stationen als Schritte; Vertiefungen pro Station |
| 3 | `heute` | `stack` | Full-Stack-Schichten mit Technologien; Vertiefung `diese-app` |
| 4 | `projekt-a` | `showcase` | Bild, 3 Chips, 1 Kennzahl; Vertiefung `projekt-a-details` |
| 5 | `projekt-b` | `showcase` | dito |
| 6 | `mensch` | `gallery` | Hobbys/Werte als Fotos |
| 7 | `warum-ihr` | `closing` | „Warum {{company.name}}?" + 3 Punkte, Gipfel-Motiv |

Inhalte sind am Anfang **Platzhalter** (klar als `TODO` markiert). Echte Inhalte liefert der User.

---

## 1. Tech-Stack und Konventionen

- **Angular, aktuelle stabile Version** (`npx @angular/cli@latest new`). Standalone-Komponenten,
  **Signals** für jeglichen State, `input()`/`output()`/`model()`, neuer Control Flow
  (`@if`, `@for`, `@switch`), `ChangeDetectionStrategy.OnPush`, zoneless (CLI-Default übernehmen).
  Kein NgModule, kein RxJS-State (RxJS nur wo Angular-APIs es liefern).
- **Styles**: SCSS, CSS Custom Properties für Tokens. Kein Tailwind.
- **UI-Bibliotheken**: `@angular/cdk` (A11y, Layout), `@angular/material` **nur** in der
  Präsentator-Ansicht (Buttons, Icons, Tooltips). Folien und Hub sind komplett eigenes CSS.
- **Fonts**: `@fontsource-variable/fraunces`, `@fontsource-variable/inter` (self-hosted, kein CDN).
- **Icons**: `material-symbols` (npm, self-hosted), Klasse `material-symbols-outlined`.
- **Content-Build**: `gray-matter`, `marked`, `zod`; Skript in TypeScript, ausgeführt mit Node
  (Type-Stripping: `node scripts/build-content.ts`, nur „erasable" TS-Syntax: keine `enum`,
  keine Parameter-Properties).
- **Dev**: `concurrently` für Content-Watcher + `ng serve`.
- **Tests**: der Test-Runner, den die Angular-CLI standardmäßig einrichtet (für Komponenten/Logik);
  Content-Build-Tests mit `node --test`.
- **Sprache**: UI-Texte und Inhalte Deutsch, Code/Bezeichner/Commits Englisch.
- **Design-Canvas**: Folien werden auf einer festen **1600×900-px-Fläche** gestaltet und als Ganzes
  skaliert (siehe Phase 3). Innerhalb von Folien daher px-Werte verwenden, keine vw/vh.

### Ziel-Verzeichnisstruktur

```
this-is-me/
├─ content/                         # Quelle aller Inhalte (vom User gepflegt)
│  ├─ blocks/                       # gemeinsame Block-Bibliothek (*.md)
│  └─ decks/
│     ├─ default/deck.json
│     └─ <firma>/                   # pro Bewerbung
│        ├─ deck.json
│        └─ blocks/*.md             # optionale deck-eigene Blöcke (überschatten Bibliothek)
├─ public/
│  ├─ media/                        # Fotos, SVGs (direkt referenziert als "media/…")
│  └─ generated/                    # vom Content-Build erzeugt, in .gitignore
│     ├─ index.json
│     └─ decks/<id>.json
├─ scripts/
│  ├─ build-content.ts
│  └─ build-content.test.ts
├─ src/app/
│  ├─ core/
│  │  ├─ content.schema.ts          # zod-Schemas + abgeleitete Typen (Single Source of Truth)
│  │  ├─ navigation.ts              # reine Funktionen next/prev/down/up (+ spec)
│  │  ├─ deck.store.ts              # Signal-Store: Deck, Position, Modus
│  │  ├─ sync.service.ts            # BroadcastChannel
│  │  └─ keyboard.ts                # Tastenbelegung
│  ├─ pages/
│  │  ├─ hub/                       # Bento-Übersicht
│  │  ├─ present/                   # Präsentationsmodus (Stage)
│  │  └─ presenter/                 # Präsentator-Fenster
│  ├─ stage/                        # skalierte 1600×900-Bühne + SlideHost
│  ├─ slides/
│  │  ├─ layouts/{hero,journey,stack,showcase,gallery,closing,text}/
│  │  └─ media/                     # <app-media> für image/svg/component
│  └─ styles/ (tokens.scss, typography.scss, transitions.scss)
└─ docs/ (dieser Plan, Prototypen)
```

---

## 2. Content-Modell (verbindlich)

### 2.1 Block-Datei (`content/blocks/<id>.md`)

```markdown
---
id: projekt-a                 # muss = Dateiname sein
layout: showcase
title: Kundenportal
tile: { label: Projekte, icon: rocket_launch, size: md }   # optional, für den Hub
steps: 1                      # optional, Default 1 (journey berechnet selbst)
# ... layout-spezifische Felder (siehe 2.2)
---
Optionaler Markdown-Fließtext (für Layout `text` bzw. als Untertitel).

<!-- notes -->
Sprechernotizen in Markdown. Alles nach dem Marker landet NUR in der Präsentator-Ansicht.
```

Gemeinsame Felder (alle Layouts):

```ts
id: string            // kebab-case
layout: 'hero' | 'journey' | 'stack' | 'showcase' | 'gallery' | 'closing' | 'text'
title: string
kicker?: string       // kleine Zeile über dem Titel
tile?: { label?: string; icon?: string; size?: 'md' | 'wide' | 'lg'; image?: string }
steps?: number        // >= 1
```

### 2.2 Layout-spezifische Felder

```ts
type Media =
  | { type: 'image'; src: string; alt: string; focus?: string }  // focus = CSS object-position, z. B. "30% 50%"
  | { type: 'svg';   src: string; alt: string }
  | { type: 'component'; name: string; inputs?: Record<string, unknown> };

// hero
{ subtitle: string; location?: string; photo: Media; photoBack?: Media }   // photoBack = Easter Egg

// journey
{
  image: string;                  // z. B. "media/werdegang.jpg"
  imageSize: [number, number];    // Pixelmaße des Fotos, z. B. [851, 577]
  stations: Array<{
    id: string;
    at: [number, number];         // % des Fotos (x, y)
    via?: Array<[number, number]>;// Zwischenpunkte VOR dieser Station, damit der Weg dem Gelände folgt
    year: string; title: string; tags: string[];
    summit?: boolean;             // letzte Station = Fahne
    deepDive?: string;            // Block-ID einer Vertiefung (muss in children des Decks stehen)
  }>;
  secret?: { at: [number, number]; year: string; title: string; tags: string[] };  // Hütte
  hide?: string[];                // Station-IDs, die in diesem Deck ausgeblendet werden
  highlight?: string[];           // Station-IDs, die hervorgehoben werden
}

// stack   (Full-Stack-Schichten, oben = UI, unten = Infrastruktur)
{ layers: Array<{ label: string; icon?: string; items: string[] }> }

// showcase
{ media: Media; chips: string[]; metric?: { value: string; label: string } }

// gallery
{ items: Array<{ media: Media; caption: string }> }   // 2–4 Einträge

// closing
{ points: string[]; image?: Media }

// text
{}  // nutzt nur den Markdown-Body
```

### 2.3 Deck (`content/decks/<id>/deck.json`)

```jsonc
{
  "id": "firma-x",
  "extends": "default",                 // optional; Kette erlaubt, Zyklen = Fehler
  "title": "Bewerbung Firma X",
  "durationMinutes": 5,                 // Zielzeit für den Timer
  "publication": {                      // optional; ohne diesen Block wird das Deck NICHT veröffentlicht
    "id": "3f9c2b7e-81a4-4d0e-9b56-c7e1a02d4f18",  // UUID = öffentlicher Pfad, wird vom Slide-Creator erzeugt
    "note": "Per Mail an Personalabteilung, 12.11.", // nur für den Admin
    "expiresAt": "2026-12-31",          // optional; danach lässt der Produktions-Build das Deck weg
    "revoked": false                    // true = vom Netz nehmen (UUID bleibt zur Anzeige stehen)
  },
  "company": { "name": "Firma X", "accent": "#0F6E56", "logo": "media/firma-x.svg" },
  "slides": [                           // ersetzt (nicht merged) die Liste des Eltern-Decks
    "hallo",
    { "id": "weg", "children": ["firma-a-details", "firma-b-details"] },
    { "id": "heute", "children": ["diese-app"] },
    "projekt-fintech",
    "mensch",
    "warum-ihr"
  ],
  "overrides": {                        // Deep-Merge in die Block-Frontmatter
    "hallo": { "subtitle": "Full-Stack-Entwickler mit Fintech-Erfahrung" },
    "weg":   { "hide": ["abitur"], "highlight": ["firma-b"] }
  }
}
```

**Auflösungsregeln (im Build-Skript implementieren, alle testen):**

1. **Vererbung**: Eltern-Deck rekursiv auflösen, dann Kind darüber mergen. `slides` wird vom Kind
   **ersetzt**, falls vorhanden, sonst geerbt. `overrides` und `company` werden deep-gemerged.
2. **Block-Lookup** für eine ID: `decks/<deck>/blocks/<id>.md` → Blöcke der Eltern-Decks (in
   Vererbungsreihenfolge) → `content/blocks/<id>.md`. Erster Treffer gewinnt (= Austauschen).
   Nicht gefunden → Build-Fehler mit Deck-Name und ID.
3. **Overrides**: Deep-Merge auf die Frontmatter; Objekte rekursiv, **Arrays ersetzen**,
   `null` löscht ein Feld.
4. **Interpolation**: In allen String-Feldern (inkl. Markdown/Notizen) wird `{{company.name}}`
   ersetzt (Fallback: „euch").
5. **Journey**: `hide` filtert Stationen heraus; `steps` = `1 + sichtbare Stationen`
   (Schritt 0 = Gesamtbild/Übersicht, Schritt k = Station k).
6. **stepLinks**: Für jede Folie ein Array der Länge `steps` mit dem Index des Kind-Blocks, zu dem
   `↓` in diesem Schritt springt, oder `null`. Journey: aus `station.deepDive`; sonst
   `[0, 0, …]` wenn Kinder existieren, sonst `null`.
7. **Validierung** mit den zod-Schemas aus `src/app/core/content.schema.ts`. Fehler →
   lesbare Meldung (Datei + Pfad + Problem) und Exit-Code ≠ 0.
8. Markdown-Body und Notizen werden mit `marked` zu HTML (`bodyHtml`, `notesHtml`).

`publication` wird **nicht vererbt** (gehört nur dem Deck, in dessen `deck.json` es steht). Die UUIDs
müssen über alle Decks eindeutig sein (Build-Fehler sonst).

### 2.4 Build-Ausgabe (`public/generated/`)

Es gibt **keine** `index.json` mehr: Eine Deck-Liste würde alle UUIDs verraten.
Dateiname und URL-Parameter sind je nach Modus:

| Modus | Befehl | geschrieben nach `decks/` |
|---|---|---|
| Entwicklung (Standard) | `npm run content` | `<id>.json` für **jedes** Deck (lokale Vorschau, Slide-Creator) und zusätzlich `<publicId>.json` für jedes Deck mit `publication` |
| Produktion | `npm run content:production`, oder jeder Build mit `CONTENT_MODE=production` bzw. auf Vercel (`VERCEL` ist dort immer gesetzt) | **nur** `<publicId>.json` der veröffentlichten Decks (nicht widerrufen, nicht abgelaufen); nichts unter dem lesbaren Namen |

`ResolvedDeck.id` ist in beiden Fällen der lesbare Ordnername. Die App behandelt den URL-Parameter
`:deck` einfach als Dateinamen (`generated/decks/<param>.json`).

```ts
// decks/<id|publicId>.json
type ResolvedDeck = {
  id: string; title: string; durationMinutes: number;
  company?: { name: string; accent?: string; logo?: string };
  slides: ResolvedSlide[];
};
type ResolvedSlide = ResolvedBlock & { children: ResolvedBlock[]; stepLinks: (number | null)[] };
type ResolvedBlock = Block & { steps: number; bodyHtml: string; notesHtml: string };
```

### 2.5 Veröffentlichung (Zugriffsschutz durch unratbare Links)

Schutzmodell: **Capability-URL**. Wer den Link zu einem Deck hat, sieht es; ohne Link gibt es keinen
Weg dorthin. Das ist kein Passwortschutz, Weiterleitungen des Links sind möglich (bewusst akzeptiert).

- **Lesbare ID bleibt der Ordnername** (`content/decks/acme/`, Vererbung, Slide-Creator). Die
  **`publicId`** (UUID v4, 122 Bit) ist nur der Pfad im Netz: `https://<host>/d/<uuid>` und
  `/presenter/<uuid>`. **Eine UUID pro Bewerbung**, nicht pro Firma.
- **Kein Einstieg**: `/`, `/d` und alle unbekannten Pfade zeigen „nicht gefunden"; es gibt weder
  Deck-Liste noch `index.json`. Das Standard-Deck ist Vorlage und hat keine `publication`.
- **Quelle bleibt privat** (privates GitHub-Repo, Vercel baut daraus). Die Registry (UUID, Notiz,
  Ablauf) steht in den `deck.json`-Dateien im privaten Repo. Ein öffentliches Repo würde alles verraten.
- **Widerruf/Rotation**: UUID neu erzeugen bzw. `revoked` setzen; mit dem nächsten Deploy ist der alte
  Link tot (die Datei `<uuid>.json` existiert dann nicht mehr).
- **Hygiene**: `noindex` (Meta-Tag und `X-Robots-Tag`-Header), `Referrer-Policy: no-referrer`,
  keine Sitemap, `robots.txt` ohne Pfade. Firmenspezifische Mediendateien neutral benennen
  (Dateinamen in `public/media/` sind im Netz abrufbar; automatisches Umziehen steht im Backlog).

---

## 3. Phasen

Nach **jeder** Phase: `npm run build` und Tests grün, App im Browser geprüft (Akzeptanzkriterien),
dann (falls der User Commits freigegeben hat) ein Commit `feat: phase N – …`.

### Phase 0 – Projekt-Setup

1. `git init` (Repo existiert noch nicht). `.gitignore` inkl. `public/generated/`.
2. Angular-Projekt **im bestehenden Ordner** anlegen:
   `npx @angular/cli@latest new this-is-me --directory . --style=scss --routing --ssr=false --skip-git`
   (bestehende Ordner `docs/`, `.claude/` bleiben erhalten).
3. Abhängigkeiten: `@angular/cdk @angular/material @fontsource-variable/fraunces
   @fontsource-variable/inter material-symbols marked zod` und dev: `gray-matter concurrently`.
4. npm-Skripte:
   ```json
   "content": "node scripts/build-content.ts",
   "content:watch": "node scripts/build-content.ts --watch",
   "start": "npm run content && concurrently -k -n content,ng \"npm:content:watch\" \"ng serve\"",
   "build": "npm run content && ng build",
   "test:content": "node --test scripts/"
   ```
5. `.claude/launch.json`: Konfiguration `app` hinzufügen (`npm start`, Port 4200). Die bestehende
   Konfiguration `prototypen` behalten.
6. Foto übernehmen: `docs/prototypes/werdegang/berg.jpg` → `public/media/werdegang.jpg`.
7. Globale Styles: `src/styles.scss` importiert Fonts, `material-symbols/outlined.css`,
   `app/styles/tokens.scss`:
   ```scss
   :root {
     --bg: #faf8f4;  --surface: #ffffff;  --ink: #1f1e1b;  --muted: #6b6a64;
     --line: rgba(31,30,27,.12);
     --accent: #534ab7;  --accent-soft: color-mix(in srgb, var(--accent) 12%, white);
     --font-serif: 'Fraunces Variable', Georgia, serif;
     --font-sans: 'Inter Variable', system-ui, sans-serif;
     --radius: 16px;
   }
   ```

**Akzeptanz:** `npm start` startet, Default-Seite lädt, `npm run build` grün.

### Phase 1 – Content-Pipeline

1. `src/app/core/content.schema.ts`: zod-Schemas für Media, alle Layouts (discriminated union über
   `layout`), Deck-Datei, Resolved-Typen. Typen per `z.infer` exportieren. Die App importiert nur
   Typen (`import type`), damit zod nicht ins Bundle gelangt.
2. `scripts/build-content.ts`: implementiert Abschnitt 2.3 vollständig. Liest alle Decks unter
   `content/decks/*/deck.json`, schreibt `public/generated/index.json` und `decks/<id>.json`.
   Mit `--watch`: `fs.watch(content, { recursive: true })`, Debounce 200 ms, bei Fehlern
   Meldung ausgeben und **weiterlaufen** (nicht abstürzen).
3. Platzhalter-Inhalte anlegen (deutsch, mit `TODO:` in Notizen):
   - Blöcke: `hallo`, `weg`, `heute`, `diese-app`, `projekt-a`, `projekt-a-details`, `projekt-b`,
     `mensch`, `warum-ihr`, `firma-a-details`, `firma-b-details`.
   - `weg.md`: Stationen/Koordinaten exakt aus dem Prototyp übernehmen
     (`[90,94] [44,83] [80,57] [30,46] [39.5,33]`, `via`-Punkte, `secret` bei `[9,74]`,
     `imageSize: [851, 577]`), Gipfel-Titel `"{{company.name}}"`.
   - Bilder, die noch fehlen: `type: svg` mit einfachen Platzhalter-SVGs in `public/media/placeholder/`.
   - Decks: `default` (Hauptpfad aus Abschnitt 0, ohne `company`) und ein Beispiel
     `beispiel-firma` (`extends: default`, ein eigener Block
     `warum-ihr.md`, ein `overrides`-Eintrag mit `hide`).
4. `scripts/build-content.test.ts` (node:test) mit Fixtures in `scripts/fixtures/`:
   Vererbung, Slides-Ersetzung, Block-Shadowing, Override-Merge (Array ersetzt, `null` löscht),
   Interpolation, Journey-`hide`/`steps`/`stepLinks`, Fehler bei fehlendem Block und Zyklus.

**Akzeptanz:** `npm run content` erzeugt beide Deck-JSONs; `npm run test:content` grün;
ein absichtlicher Tippfehler im Layout-Namen liefert eine verständliche Fehlermeldung.

### Phase 2 – Kernlogik: Navigation, Store, Routing

1. `core/navigation.ts` – **reine Funktionen**, vollständig unit-getestet:
   ```ts
   type Position = { slide: number; step: number; sub: number | null; subStep: number };
   next(deck, pos)  // step+1 innerhalb der Folie/Vertiefung; sonst nächste Hauptfolie (step 0, sub null); am Ende: unverändert
   prev(deck, pos)  // step-1; sonst vorherige Hauptfolie auf ihrem LETZTEN Schritt; in Vertiefung: zurück zur Hauptfolie
   down(deck, pos)  // sub null → stepLinks[step]; sub k → k+1 (falls vorhanden); subStep 0; step bleibt erhalten
   up(deck, pos)    // sub > 0 → sub-1; sub 0 → null (Rückkehr auf denselben step der Hauptfolie)
   goTo(deck, slide, step?) // für Hub- und Stationsklicks
   ```
   Wichtig: Beim Rückweg aus einer Stations-Vertiefung bleibt die Journey auf derselben Station.
2. `core/deck.store.ts` (Injectable, Signals): `deckId`, `deck` (via `httpResource` auf
   `generated/decks/<id>.json`), `position`, `blackout`, abgeleitet `currentSlide`, `currentBlock`
   (Hauptfolie oder Kind), `nextBlock`, `progress`. Methoden `next/prev/down/up/goTo` rufen die
   reinen Funktionen auf und aktualisieren `position`.
3. Routing (`app.routes.ts`):
   - `''` → Redirect auf `d/default`
   - `d/:deck` → `HubPage`
   - `d/:deck/:slide` und `d/:deck/:slide/:sub` → `PresentPage` (Schritt als Query-Param `?s=`)
   - `presenter/:deck` → `PresenterPage`
   - `**` → Redirect `''`
   Position ↔ URL synchron halten (URL ist die Wahrheit beim Laden/Reload; Store ändert URL via
   `router.navigate(..., { replaceUrl: true })` bei reinen Schrittwechseln).
4. `core/keyboard.ts`: ein globaler Keydown-Handler (nur in `PresentPage` aktiv):
   `→`, `Space`, `PageDown` = next · `←`, `PageUp` = prev (PageUp/Down = Presenter-Clicker) ·
   `↓`/`↑` = down/up · `Esc` = Hub · `P` = Präsentator-Fenster öffnen · `B` = Blackout an/aus.
   Ignorieren, wenn Fokus in einem Eingabefeld liegt.

**Akzeptanz:** Navigation-Tests decken alle Randfälle ab (erste/letzte Folie, Folie ohne Kinder,
Journey-Station mit/ohne Vertiefung). Reload auf `/d/default/weg?s=3` landet auf Station 3.

### Phase 3 – Bühne, SlideHost und einfache Layouts

1. `stage/stage.component.ts`: Vollbild, Hintergrund `#111`. Innen eine 1600×900-Fläche
   (`.canvas`), skaliert mit `transform: scale(k)`, `k = min(w/1600, h/900)` (ResizeObserver),
   zentriert. Setzt `--accent` aus `deck.company.accent`, falls vorhanden. Blackout-Overlay.
2. `stage/slide-host.component.ts`: `@switch (block.layout)` → Layout-Komponente.
   Inputs: `block`, `step`. Output: `requestStep(number)` (für Journey-Klicks).
   Root-Element bekommt `view-transition-name: slide-<id>` (für den Hub-Morph).
3. `slides/media/media.component.ts`: rendert `image` (`<img>` mit `object-fit: cover`,
   `object-position: focus`), `svg` (als `<img>`), `component` (Registry `Record<string, Type>` +
   `NgComponentOutlet`; Registry anfangs leer, unbekannter Name → sichtbarer Hinweis).
4. Layouts (jeweils eigene Komponente, OnPush, Inputs `block` + `step`):
   - **hero**: links Kicker „Hallo, ich bin", Name in Serif ~96px, Subtitle; rechts Porträt
     (halbe Bühne, volle Höhe). **Easter Egg**: wenn `photoBack` gesetzt, Klick aufs Porträt dreht
     es (CSS 3D `rotateY(180deg)`, 600 ms, `backface-visibility: hidden`); erneuter Klick zurück.
     Klick darf **nicht** die Navigation auslösen.
   - **stack**: horizontale Schichten-Bänder übereinander (UI oben → Infra unten), Label links,
     Chips rechts. Bei `steps > 1` werden die Schichten schrittweise eingeblendet.
   - **showcase**: links Media (60 %, abgerundet), rechts Kicker, Serif-Titel, Chips,
     Kennzahl groß unten.
   - **gallery**: 2–4 Fotos nebeneinander, leicht gedreht (±2°), Bildunterschrift darunter.
   - **closing**: Titel „Warum {{company}}?" (bereits interpoliert), 3 Punkte, Hintergrundmotiv
     = `image` (Default: Werdegang-Foto mit Fokus auf den Gipfel, `focus: "40% 30%"`).
   - **text**: Titel + `bodyHtml`.
5. Folienwechsel-Animation: Router `withViewTransitions({ onViewTransitionCreated })`.
   **Transition überspringen** (`transition.skipTransition()`), wenn sich nur Query-Params ändern
   (Schrittwechsel). Standard: Crossfade 300 ms + leichter horizontaler Versatz in
   Navigationsrichtung (Richtung über `document.documentElement.dataset.dir = 'fwd' | 'back'`
   und CSS in `styles/transitions.scss`). `prefers-reduced-motion` respektieren.

**Akzeptanz:** Alle Platzhalter-Folien des Default-Decks sind mit Tastatur durchklickbar, sehen bei
1280×720 und 1920×1080 identisch (nur skaliert) aus, Text ist bei 1280×720 gut lesbar
(Mindestgröße 24px im Canvas).

### Phase 4 – Journey-Layout (Werdegang)

Prototyp `docs/prototypes/werdegang/index.html` als Angular-Komponente portieren. Logik in
eine reine Hilfsdatei `journey.geometry.ts` (Catmull-Rom → Bézier, Segmentlängen, %↔Pixel,
Kamera-Clamp) mit Unit-Tests; die Komponente macht nur Rendering und Animation.

- Inputs: `block` (journey), `step`. Output: `requestStep`.
- `step 0` = Gesamtbild mit Übersichtskarte „Mein Weg / in N Etappen"; `step k` = Kamera auf
  Station k (Zoom 1.9, Gipfel 1.6), Wanderer läuft per `requestAnimationFrame` den Pfad entlang
  (1100 ms, ease-in-out), erledigter Wegteil in Akzentfarbe, Pins bis k als „erledigt".
- Kamera über registrierte CSS-Properties `--s/--tx/--ty` mit `transition` (wie Prototyp).
  Marker/Pins gegen-skaliert (`scale(calc(1 / var(--s)))`).
- Foto in der Breite gefüllt, **unten verankert** (oben wird Himmel abgeschnitten); Umrechnung
  Foto-% → Bühnen-% wie `toStage()` im Prototyp.
- Info-Karte immer auf der Seite **gegenüber** der Station (`x < 50` → rechts).
- **Gesamtbild-Modus** (lokaler Signal-State, kein Navigationsschritt): Taste `Z` oder Button in der
  unteren Leiste. Kamera auf Gesamtbild, Wanderer bleibt an Ort und Stelle, Karte „Gesamtbild –
  Station anklicken". Erneut `Z` → zurück zur aktuellen Station. Jede Navigation beendet den Modus.
- **Pins anklickbar** (jederzeit): emittiert `requestStep(k)` → Store `goTo`. Klicks auf Pins,
  Hütte, Buttons dürfen nicht zusätzlich „weiter" auslösen.
- **Hütte (Easter Egg)**: Klick zoomt auf `secret.at` (2.2) und zeigt dessen Karte; aktiviert den
  Gesamtbild-Button, damit man zurückkommt.
- `highlight`-Stationen: Pin größer + Akzentring.
- Fortschritts-Punkte unten mittig (`steps` Stück).

**Akzeptanz:** Verhalten deckungsgleich mit dem Prototyp (nebeneinander vergleichen), inklusive
Gesamtbild + Stationsklick + Hütte. `↓` auf einer Station mit `deepDive` öffnet die Vertiefung,
`↑` kehrt auf dieselbe Station zurück (Kamera springt nicht auf Schritt 0).

### Phase 5 – Hub (Bento) und Morph-Übergang

1. `HubPage` auf der Bühne (gleiche 1600×900-Skalierung): Kopfzeile mit Name links und
   „für {company}" rechts (Akzentfarbe), darunter CSS-Grid (4 Spalten × 3 Reihen, Gap 16px).
   Kacheln = Top-Level-Slides des Decks; Größe über `tile.size` (`lg` = 2×2, `wide` = 2×1,
   `md` = 1×1), Label/Icon/Bild aus `tile`, Fallback `title`.
   Die Journey-Kachel zeigt eine Miniatur des Werdegang-Fotos mit gestricheltem Weg.
2. Jede Kachel trägt `view-transition-name: slide-<id>` → beim Klick morpht sie in die Folie
   (gleicher Name auf dem SlideHost-Root). `Esc` aus der Folie zurück → umgekehrter Morph.
3. Tastatur im Hub: `Enter`/`→` startet bei Folie 1; Pfeiltasten + Enter für Kachelauswahl
   (CDK `FocusKeyManager`), sichtbarer Fokus-Ring.

**Akzeptanz:** Hub → Kachel → Folie morpht sichtbar; `Esc` → zurück morpht; vollständig per
Tastatur bedienbar.

### Phase 6 – Präsentator-Ansicht und Synchronisation

1. `core/sync.service.ts`: `BroadcastChannel('this-is-me:' + deckId)`. Nachrichten:
   `{ kind: 'position', pos, from }`, `{ kind: 'blackout', on, from }`, `{ kind: 'hello', from }`.
   Jedes Fenster hat eine zufällige `windowId`; eigene Nachrichten ignorieren. Eingehende Position
   wird gesetzt **ohne** erneut zu senden (Echo-Schleifen vermeiden). Auf `hello` antwortet das
   Präsentationsfenster mit seiner aktuellen Position.
2. `P` im Präsentationsfenster: `window.open('/presenter/<deck>', 'this-is-me-presenter',
   'popup,width=1280,height=800')`.
3. `PresenterPage` (hier Angular Material erlaubt), Layout:
   - links groß: aktuelle Folie (SlideHost in einer verkleinerten Bühne, nicht interaktiv)
   - darunter: Sprechernotizen (`notesHtml`, gut lesbar, 18–20px)
   - rechts: Timer (vergangen mm:ss, Anteil an `durationMinutes`, wird ab 80 % gelb, ab 100 % rot;
     Start beim ersten Navigationsschritt, Buttons Pause/Reset), Vorschau der nächsten Folie,
     Liste der Vertiefungen der aktuellen Folie (klickbar → `down`), Fortschrittsbalken über alle
     Hauptfolien, Schritt-Anzeige („Weg · Schritt 3/5").
   - Tastatur im Präsentator-Fenster steuert ebenfalls (gleiche Belegung).
4. Hinweis-Overlay beim ersten Öffnen: „Teile im Call nur das Präsentationsfenster."

**Akzeptanz:** Zwei Fenster nebeneinander: Navigation in einem bewegt das andere sofort mit,
in beide Richtungen; Blackout synchron; Reload eines Fensters synchronisiert sich wieder.

### Phase 7 – Feinschliff

- Tastatur-Hilfe: `?` zeigt ein Overlay mit allen Tasten.
- Zielgruppen-Akzent: prüfen, dass `company.accent` überall greift (Chips, Pins, Weg, Hub-Kachel).
- Fokus- und Kontrastprüfung, `alt`-Texte, `prefers-reduced-motion` (Kamera springt ohne Fahrt).
- Ladezustand/Fehlerzustand für unbekanntes Deck („Deck nicht gefunden", ohne Link und ohne die
  angefragte ID zu wiederholen).
- Lighthouse kurz prüfen (Bilder in passender Größe, `loading="lazy"` außer Folie 1).

### Phase 8 – Veröffentlichungsmodell und Deployment auf Vercel

Hintergrund und Schutzmodell: Abschnitt 2.5.

1. **Schema** (`libs/content`): `publication` in `DeckFileSchema` (Abschnitt 2.3); `unlisted` und
   `DeckIndex` entfallen (es gibt keine Deck-Liste mehr).
2. **Build** (`scripts/build-content.ts`): Modus `development`/`production` (Abschnitt 2.4), Prüfung auf
   doppelte UUIDs, Ausgabe einer Übersicht (veröffentlicht / übersprungen und warum). Moduswahl:
   `--production`, `CONTENT_MODE=production` oder die von Vercel gesetzte Variable `VERCEL`
   (so kann ein Deploy die lesbaren Namen nie versehentlich mitliefern); npm-Script `content:production`
   für die lokale Prüfung. `nx build` hängt weiter von `content:generate` ab, das den Modus aus der Umgebung nimmt.
3. **App**: `/`, `/d` und `**` zeigen „nicht gefunden" (kein Redirect auf ein Standard-Deck); der
   Fehlerzustand eines Decks hat keinen Link mehr. `<meta name="robots" content="noindex">` und
   `<meta name="referrer" content="no-referrer">` in `index.html`.
4. **Vercel** (macht der User, Anleitung in `README.md`): privates Repo im **persönlichen** GitHub-Account,
   Vercel-Hobby-Account mit GitHub verbinden, Projekt importieren. `vercel.json` im Repo setzt Build-Befehl
   (`npm run build`; der Content-Build läuft dabei automatisch im Produktionsmodus), Output-Ordner, SPA-Rewrite (nicht für `generated/` und
   `media/`, damit unbekannte JSON-Dateien ein echtes 404 liefern) und die Header
   (`X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`). Jeder Push auf den Hauptzweig deployt.

**Akzeptanz:** `npm run content:production` erzeugt nur `decks/<uuid>.json` der veröffentlichten Decks
(Test in `scripts/build-content.test.ts`); `/`, `/d` und `/d/default` zeigen „nicht gefunden"; `/d/<uuid>`
zeigt das Deck; Vercel-Deployment erreichbar, Deep-Link-Reload funktioniert, `/d/default` ist dort 404.

### Phase 9 – Ansicht „Veröffentlichung" im Slide-Creator

Seite `/veroeffentlichung` (Link in der Kopfzeile der Deck-Liste). Pro Deck mit Eltern-Deck (Vorlagen ohne
`extends` erscheinen nicht) eine Karte: lesbare ID, Titel, Status (Entwurf, Live, Abgelaufen, Widerrufen;
zusätzlich „Nicht committet" / „Nicht gepusht", ermittelt über `git`), voller Link und Präsentator-Link
mit Kopieren-Button, Notiz („an wen, wann"), Ablaufdatum. Aktionen: **Veröffentlichen** (erzeugt UUID),
**Link rotieren** (neue UUID, mit Rückfrage), **Widerrufen** (mit Rückfrage), **Neu veröffentlichen**.
Die Basis-URL der Produktion (`https://….vercel.app`) steht in `content/site.json` (`{ "baseUrl": … }`),
bis dahin gilt ein Platzhalter und die Ansicht weist darauf hin.
API: `GET /api/publications`, `PUT /api/decks/:id/publication` (`action: publish | rotate | revoke | update`).

**Akzeptanz:** Alle Aktionen schreiben nur den `publication`-Block der jeweiligen `deck.json`; Tests in
`apps/slide-creator/server/content-store.test.ts`.

---

## 4. Backlog (nicht Teil der ersten Umsetzung)

- **Erkunden-Modus** (`/`): öffentliche Startseite mit allen öffentlichen Inhalten, scrollbar
  (derzeit bewusst nicht vorhanden, siehe 2.5).
- Medien einer Firma beim Produktions-Build automatisch nach `media/<publicId>/…` umziehen und die
  Verweise im Deck-JSON umschreiben (derzeit: Dateien neutral benennen).
- Optional: Deck-JSON mit einem Schlüssel im URL-Fragment verschlüsseln (Host kann nichts mitlesen).
- **Skill-Graph** als `component`-Media (Skills ↔ Projekte ↔ Stationen, Klick hebt Verbindungen hervor).
- **„Diese App"-Vertiefung** mit echter Architektur-Grafik (Content-Pipeline, Signals-Store, Sync).
- PDF-Export per Print-CSS als „Leave-behind".
- Prerendering/SSG statt SPA-Fallback.

## 5. Offene Punkte (den User fragen, wenn relevant)

1. ~~Firmen-Decks öffentlich?~~ **Entschieden (2026-11-24):** privates Repo, Vercel, UUID-Pfad pro
   Bewerbung, Standard-Deck nicht veröffentlicht (Abschnitt 2.5).
2. Echte Inhalte: Stationen (Jahr, Titel, 2–3 Stichworte), zwei Projekte mit Bild + Kennzahl,
   Porträt + Rückseitenfoto, 2–4 „Mensch"-Fotos, Tech-Stack pro Schicht.
3. Positionen der Stationen auf dem Foto ggf. nach echten Inhalten feinjustieren (Prototyp hat
   5 Stationen; bei mehr/weniger Stationen neue Punkte wählen).
