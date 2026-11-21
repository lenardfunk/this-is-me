import { Injectable, signal } from '@angular/core';

/** Visibility of the keyboard help overlay (toggled with `?`). */
@Injectable({ providedIn: 'root' })
export class HelpService {
  readonly open = signal(false);

  toggle() {
    this.open.update((o) => !o);
  }

  close() {
    this.open.set(false);
  }
}
