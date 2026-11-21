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

## Inhalte pflegen

- `content/blocks/*.md` – gemeinsame Folien-Bibliothek (Frontmatter + Markdown, Sprechernotizen
  nach `<!-- notes -->`).
- `content/decks/<id>/deck.json` – Reihenfolge der Folien, Vertiefungen (`children`), Firma,
  `overrides`. Ein Deck kann mit `extends` erben und eigene Blöcke in `decks/<id>/blocks/` ablegen.
- Medien liegen in `public/media/`. `public/generated/` wird vom Content-Build erzeugt.
- Fehler in den Inhalten (Tippfehler im Layout, fehlender Block, Zyklus …) meldet der Build mit
  Datei, Feldpfad und Problem.

Neues Firmen-Deck: Ordner `content/decks/<firma>/` mit einer `deck.json` anlegen
(siehe `content/decks/beispiel-firma/`), dann `/d/<firma>` öffnen.

## Bedienung

`→` / `Leertaste` weiter · `←` zurück · `↓` / `↑` Vertiefung · `Esc` Hub · `Z` Werdegang-Gesamtbild ·
`P` Präsentator-Fenster · `B` abdunkeln · `?` Tastaturhilfe.

Im Call nur das **Präsentationsfenster** teilen; das Präsentator-Fenster (`/presenter/<deck>`)
bleibt privat und ist per `BroadcastChannel` synchron.
