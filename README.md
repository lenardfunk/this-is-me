# this-is-me

Angular-Präsentations-App für die Selbstvorstellung in Remote-Bewerbungsgesprächen:
Bento-Hub, 2D-Deck, Werdegang als Weg auf einem Landschaftsfoto, Präsentator-Fenster und
Decks pro Firma. Konzept und Phasen: [`docs/IMPLEMENTIERUNGSPLAN.md`](docs/IMPLEMENTIERUNGSPLAN.md).

## Befehle

Nx-Workspace mit zwei Apps und zwei Libs:

| Projekt         | Pfad                 | Inhalt                                                        |
| --------------- | -------------------- | ------------------------------------------------------------- |
| `this-is-me`    | `apps/this-is-me`    | Präsentations-App (Hub, Deck, Präsentator-Fenster)            |
| `slide-creator` | `apps/slide-creator` | Editor für Decks und Folien + lokale Node-API (`server/`)     |
| `slides`        | `libs/slides`        | `@this-is-me/slides`: Stage, Layouts, Media, Tastatur, Tokens |
| `content`       | `libs/content`       | `@this-is-me/content`: Content-Schema, Content-Build-Targets  |

| Befehl                 | Zweck                                                                      |
| ---------------------- | -------------------------------------------------------------------------- |
| `npm start`            | Content-Watcher + Dev-Server der App auf Port 4200 (`nx serve this-is-me`) |
| `npm run build`        | Content bauen und Produktions-Build der App                                |
| `npm test`             | Tests der App                                                              |
| `npm run test:slides`  | Tests der Folien-Lib (Layouts, Tastatur)                                   |
| `npm run test:content` | Tests der Content-Pipeline und der Creator-API (`node --test`)             |
| `npm run content`      | Nur den Content bauen (`content/` → `public/generated/`)                   |
| `npm run creator`      | Slide-Creator inkl. API auf Port 4400 (`nx serve slide-creator`)           |
| `npm run test:creator` | Tests des Slide-Creators                                                   |
| `npm run test:all`     | Alle Tests aller Projekte (mit Nx-Cache)                                   |
| `npm run build:all`    | Beide Apps bauen                                                           |
| `npm run graph`        | Abhängigkeitsgraph der Projekte im Browser                                 |

Einzelne Targets direkt: `npx nx <target> <projekt>`, z. B. `npx nx test slides`.

## Slide-Creator

`npm run creator` startet einen lokalen Editor unter http://localhost:4400 (Quellcode in
[`apps/slide-creator/`](apps/slide-creator/)): Deck wählen oder neu anlegen (Firma, Akzentfarbe, Vererbung),
Folien aus Layout-Vorlagen erstellen, per Formular bearbeiten, umsortieren und als Vertiefung
einhängen – mit Live-Vorschau aus den echten Folien-Komponenten. Gespeichert wird direkt in
`content/` (Markdown + JSON im gleichen Stil wie von Hand), danach läuft der Content-Build, sodass
eine parallel laufende Präsentations-App (`npm start`) die Änderung sofort zeigt.

- Ein kleiner Node-Server (`apps/slide-creator/server/`, nur `127.0.0.1:4310`) liest und schreibt die
  Dateien; das Angular-Frontend erreicht ihn per Proxy unter `/api` und `/media`.
- In Firmen-Decks wird eine Bibliotheks-Folie beim Speichern standardmäßig als **eigene Kopie** im
  Deck abgelegt (umschaltbar auf „Bibliothek“). Werdegang-Stationen ausblenden/hervorheben landet
  als `overrides` in der `deck.json`.
- Hochgeladene Bilder landen in `public/media/uploads/`.

## Inhalte pflegen

- `content/blocks/*.md` – gemeinsame Folien-Bibliothek (Frontmatter + Markdown, Sprechernotizen
  nach `<!-- notes -->`).
- `content/decks/<id>/deck.json` – Reihenfolge der Folien, Vertiefungen (`children`), Firma,
  `overrides`. Ein Deck kann mit `extends` erben und eigene Blöcke in `decks/<id>/blocks/` ablegen.
- Medien liegen in `public/media/`. `public/generated/` wird vom Content-Build erzeugt.
- Fehler in den Inhalten (Tippfehler im Layout, fehlender Block, Zyklus …) meldet der Build mit
  Datei, Feldpfad und Problem.

Neues Firmen-Deck: im Slide-Creator „Neues Deck“ – oder von Hand einen Ordner
`content/decks/<firma>/` mit einer `deck.json` anlegen (siehe `content/decks/beispiel-firma/`),
dann `/d/<firma>` öffnen.

## Bedienung

`→` / `Leertaste` weiter · `←` zurück · `↓` / `↑` Vertiefung · `Esc` Hub · `Z` Werdegang-Gesamtbild ·
`P` Präsentator-Fenster · `B` abdunkeln · `?` Tastaturhilfe.

Im Call nur das **Präsentationsfenster** teilen; das Präsentator-Fenster (`/presenter/<deck>`)
bleibt privat und ist per `BroadcastChannel` synchron.
