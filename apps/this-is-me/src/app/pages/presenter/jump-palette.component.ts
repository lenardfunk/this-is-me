import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal } from '@angular/core';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import type { ResolvedDeck } from '@this-is-me/content';
import {
  filterJumpEntries,
  parseJumpInput,
  samePosition,
  type JumpEntry,
  type Position,
} from '../../core/navigation';

export interface JumpPaletteData {
  deck: Pick<ResolvedDeck, 'slides'>;
  entries: JumpEntry[];
  current: Position;
}

/**
 * Quick jump to any slide, step or deep dive. Typing filters the list; a numeric input such as
 * `3.2` jumps to slide 3, step 2. Closes with the chosen position, or nothing on Escape.
 */
@Component({
  selector: 'app-jump-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './jump-palette.component.html',
  styleUrl: './jump-palette.component.scss',
})
export class JumpPaletteComponent {
  protected readonly data = inject<JumpPaletteData>(DIALOG_DATA);
  private readonly ref = inject<DialogRef<Position>>(DialogRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly query = signal('');
  protected readonly active = signal(0);

  protected readonly options = computed<JumpEntry[]>(() => {
    const direct = parseJumpInput(this.data.deck, this.query());
    const matches = filterJumpEntries(this.data.entries, this.query());
    if (!direct) return matches;
    const label = `Folie ${direct.slide + 1} · Schritt ${direct.step + 1}`;
    return [{ pos: direct, path: ['Direkt'], label }, ...matches];
  });

  protected isCurrent(entry: JumpEntry) {
    return samePosition(entry.pos, this.data.current);
  }

  protected onInput(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
    this.active.set(0);
  }

  protected onKey(event: KeyboardEvent) {
    const count = this.options().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.moveActive(Math.min(this.active() + 1, count - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.moveActive(Math.max(this.active() - 1, 0));
        break;
      case 'Enter': {
        const entry = this.options()[this.active()];
        if (entry) {
          event.preventDefault();
          this.choose(entry);
        }
        break;
      }
    }
  }

  protected choose(entry: JumpEntry) {
    this.ref.close(entry.pos);
  }

  private moveActive(index: number) {
    this.active.set(index);
    this.host.nativeElement.querySelector(`#jump-option-${index}`)?.scrollIntoView({ block: 'nearest' });
  }
}
