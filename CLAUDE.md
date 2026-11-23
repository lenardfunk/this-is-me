# this-is-me

Angular-Präsentations-App für die Selbstvorstellung in Remote-Bewerbungsgesprächen
(Bento-Hub + 2D-Deck, Werdegang als Weg auf einem Landschaftsfoto, Präsentator-Fenster,
Decks pro Firma).

## Arbeitsweise

- **Maßgeblich ist `docs/IMPLEMENTIERUNGSPLAN.md`.** Phasen der Reihe nach umsetzen; die
  Produktentscheidungen in Abschnitt 0 nicht neu diskutieren. Offene Punkte (Abschnitt 5) den User
  fragen, nicht raten.
- Referenz für die Werdegang-Folie: `docs/prototypes/werdegang/index.html`
  (lokal: Launch-Konfiguration `prototypen` → http://localhost:4300/werdegang/).
- Nach jeder Phase: Build und Tests grün, Ergebnis im Browser prüfen (Launch-Konfiguration `app`,
  sobald vorhanden), Akzeptanzkriterien der Phase abhaken. Commits nur, wenn der User zustimmt.
- Nx-Workspace (kein `angular.json`, Befehle über `nx`/npm-Scripts, Projekte in `project.json`):
  - `apps/this-is-me` – Präsentations-App (Launch-Konfiguration `app` → http://localhost:4200)
  - `apps/slide-creator` – Editor für Decks/Folien mit lokaler Node-API in `server/`
    (Launch-Konfiguration `slide-creator` → http://localhost:4400)
  - `libs/content` (`@this-is-me/content`) – Content-Schema (zod) und Typen; Targets für den
    Content-Build (`scripts/build-content.ts`) und dessen Tests
  - `libs/slides` (`@this-is-me/slides`) – Stage, Slide-Host, Layouts, Media, Tastatur, Design-Tokens;
    alles, was beide Apps zum Rendern von Folien brauchen, gehört hierher
- Node-Code (Server, Content-Build) importiert Libs relativ mit `.ts`-Endung, nicht über Aliase.
- `@angular-devkit/architect` ist per `overrides` auf 0.2202.x gepinnt (Nx 24 kommt mit dessen
  `exports` ab 22.3 nicht klar); bei Nx-Updates prüfen, ob das noch nötig ist.

## Konventionen

- Angular aktuell: Standalone, Signals, `input()/output()`, `@if/@for/@switch`, OnPush, zoneless.
- UI-Texte und Inhalte auf Deutsch; Code, Bezeichner und Commit-Messages auf Englisch.
- Inhalte liegen in `content/` (Markdown + JSON), Medien in `public/media/`.
  `public/generated/` wird vom Content-Build erzeugt und nie von Hand bearbeitet.
- Folien werden auf einer festen 1600×900-px-Fläche gestaltet (keine vw/vh in Folien).
- Angular Material nur in der Präsentator-Ansicht; Folien und Hub haben eigenes CSS.
- Kein IDE- oder Terminal-Look.
