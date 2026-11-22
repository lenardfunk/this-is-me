# this-is-me

Angular-Präsentations-App für die Selbstvorstellung in Remote-Bewerbungsgesprächen:
Bento-Hub, 2D-Deck, Werdegang als Weg auf einem Landschaftsfoto, Präsentator-Fenster und
Decks pro Firma. Konzept und Phasen: [`docs/IMPLEMENTIERUNGSPLAN.md`](docs/IMPLEMENTIERUNGSPLAN.md).

## Befehle

| Befehl                 | Zweck                                                                  |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm start`            | Content bauen, danach Content-Watcher + `ng serve` auf Port 4200       |
| `npm run build`        | Content bauen und Produktions-Build                                    |
| `npm test`             | Komponenten- und Logik-Tests (Angular-Test-Runner)                     |
| `npm run test:content` | Tests der Content-Pipeline (`node --test`)                             |
| `npm run content`      | Nur den Content bauen (`content/` → `public/generated/`)               |
| `npm run creator`      | Slide-Creator (Editor für Decks und Folien) auf Port 4400              |
| `npm run test:creator` | Tests des Slide-Creators (Angular-Test-Runner)                         |

## Slide-Creator

`npm run creator` startet einen lokalen Editor unter http://localhost:4400 (Quellcode in
[`slide-creator/`](slide-creator/)): Deck wählen oder neu anlegen (Firma, Akzentfarbe, Vererbung),
Folien aus Layout-Vorlagen erstellen, per Formular bearbeiten, umsortieren und als Vertiefung
einhängen – mit Live-Vorschau aus den echten Folien-Komponenten. Gespeichert wird direkt in
`content/` (Markdown + JSON im gleichen Stil wie von Hand), danach läuft der Content-Build, sodass
eine parallel laufende Präsentations-App (`npm start`) die Änderung sofort zeigt.

- Ein kleiner Node-Server (`slide-creator/server/`, nur `127.0.0.1:4310`) liest und schreibt die
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
