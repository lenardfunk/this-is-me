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

## Konventionen

- Angular aktuell: Standalone, Signals, `input()/output()`, `@if/@for/@switch`, OnPush, zoneless.
- UI-Texte und Inhalte auf Deutsch; Code, Bezeichner und Commit-Messages auf Englisch.
- Inhalte liegen in `content/` (Markdown + JSON), Medien in `public/media/`.
  `public/generated/` wird vom Content-Build erzeugt und nie von Hand bearbeitet.
- Folien werden auf einer festen 1600×900-px-Fläche gestaltet (keine vw/vh in Folien).
- Angular Material nur in der Präsentator-Ansicht; Folien und Hub haben eigenes CSS.
- Kein IDE- oder Terminal-Look.
