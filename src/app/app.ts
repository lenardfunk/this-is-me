import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HelpService } from './core/help.service';
import { actionForEvent, shouldIgnoreTarget } from './core/keyboard';
import { HelpOverlayComponent } from './help/help-overlay.component';

@Component({
  imports: [RouterOutlet, HelpOverlayComponent],
  selector: 'app-root',
  template: `
    <router-outlet />
    <app-help-overlay />
  `,
})
export class App {
  private readonly help = inject(HelpService);

  constructor() {
    // Registered before any page, so it sees keys first: while the help is open it swallows
    // everything except the keys that close it.
    window.addEventListener('keydown', (event) => {
      if (shouldIgnoreTarget(event.target, event.key)) return;
      const action = actionForEvent(event);
      if (action === 'help') {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.help.toggle();
      } else if (this.help.open()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === 'Escape') this.help.close();
      }
    });
  }
}
