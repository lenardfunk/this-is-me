import { ChangeDetectionStrategy, Component, effect, ElementRef, inject, viewChild } from '@angular/core';
import { HelpService } from '../core/help.service';
import { KEY_BINDINGS } from '@this-is-me/slides';

/** Modal listing all keyboard shortcuts. Own CSS (no Material), available on every page. */
@Component({
  selector: 'app-help-overlay',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(click)': 'onBackdrop($event)' },
  template: `
    @if (help.open()) {
      <div class="backdrop">
        <div #dialog class="dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" tabindex="-1">
          <h2 id="help-title">Tastaturhilfe</h2>
          <dl>
            @for (binding of bindings; track binding.action) {
              <dt>
                @for (label of binding.labels; track label) {
                  <kbd>{{ label }}</kbd>
                }
              </dt>
              <dd>{{ binding.description }}</dd>
            }
          </dl>
          <p class="note">Klick ins Bild geht ebenfalls weiter. <kbd>?</kbd> oder <kbd>Esc</kbd> schließt diese Hilfe.</p>
          <button type="button" (click)="help.close()">Schließen</button>
        </div>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: grid;
      place-items: center;
      background: rgba(20, 19, 17, 0.6);
    }
    .dialog {
      width: min(620px, calc(100vw - 32px));
      max-height: calc(100vh - 32px);
      overflow: auto;
      padding: 28px 32px;
      border-radius: 20px;
      background: var(--surface);
      color: var(--ink);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
      font: 400 17px/1.4 var(--font-sans);
      outline: none;
    }
    h2 {
      margin-bottom: 18px;
      font-size: 32px;
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 10px 24px;
      margin: 0;
      align-items: center;
    }
    dt {
      display: flex;
      gap: 6px;
    }
    dd {
      margin: 0;
    }
    kbd {
      min-width: 28px;
      padding: 3px 9px;
      border: 1px solid var(--line);
      border-bottom-width: 3px;
      border-radius: 8px;
      background: var(--bg);
      font: 500 15px/1.3 var(--font-sans);
      text-align: center;
    }
    .note {
      margin: 20px 0;
      color: var(--muted);
      font-size: 15px;
    }
    button {
      padding: 10px 24px;
      border: 0;
      border-radius: 999px;
      background: var(--accent);
      color: #fff;
      font: 500 16px/1 var(--font-sans);
      cursor: pointer;
    }
  `,
})
export class HelpOverlayComponent {
  protected readonly help = inject(HelpService);
  protected readonly bindings = KEY_BINDINGS;
  private readonly dialog = viewChild<ElementRef<HTMLElement>>('dialog');

  constructor() {
    // Move focus into the dialog so screen readers announce it.
    effect(() => this.dialog()?.nativeElement.focus());
  }

  protected onBackdrop(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('backdrop')) this.help.close();
  }
}
