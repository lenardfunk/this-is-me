import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Loading / error placeholder shown instead of a page while its deck is not available.
 * The error state deliberately has no link and does not repeat the requested id: decks are only
 * reachable through their private link, so there is nowhere to send visitors.
 */
@Component({
  selector: 'app-deck-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status() === 'error') {
      <h1>Nicht gefunden</h1>
      <p>Diese Seite gibt es nicht. Prüfe den Link.</p>
    } @else {
      <p role="status">Lädt …</p>
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      display: grid;
      place-content: center;
      justify-items: center;
      gap: 12px;
      padding: 24px;
      text-align: center;
      background: var(--bg);
      color: var(--ink);
      font: 400 20px/1.4 var(--font-sans);
    }
    h1 {
      font-size: 44px;
    }
    p {
      margin: 0;
      color: var(--muted);
    }
  `,
})
export class DeckStatusComponent {
  readonly status = input.required<'idle' | 'loading' | 'ready' | 'error'>();
}
