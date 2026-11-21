import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Loading / error placeholder shown instead of a page while its deck is not available. */
@Component({
  selector: 'app-deck-status',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (status() === 'error') {
      <h1>Deck nicht gefunden</h1>
      <p>Ein Deck „{{ deckId() }}" gibt es nicht.</p>
      <a routerLink="/">Zum Standard-Deck</a>
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
    a {
      margin-top: 12px;
      padding: 10px 22px;
      border-radius: 999px;
      background: var(--accent);
      color: #fff;
      text-decoration: none;
    }
  `,
})
export class DeckStatusComponent {
  readonly status = input.required<'idle' | 'loading' | 'ready' | 'error'>();
  readonly deckId = input<string | null>(null);
}
