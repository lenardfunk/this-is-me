import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DeckStatusComponent } from './deck-status.component';

/** `/`, `/d` and every unknown path: there is no public entry point, decks live behind private links. */
@Component({
  selector: 'app-not-found-page',
  imports: [DeckStatusComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-deck-status status="error" />`,
})
export class NotFoundPage {}
