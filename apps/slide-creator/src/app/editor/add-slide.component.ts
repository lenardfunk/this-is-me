import { ChangeDetectionStrategy, Component, computed, input, linkedSignal, output, signal } from '@angular/core';
import type { Layout } from '@this-is-me/content';
import type { BlockInfo, BlockLocation } from '../../../shared/api.types';
import { KEBAB, LAYOUT_INFO, layoutInfo, locationLabel, slugify } from '../model';

export type AddSlideRequest =
  | { mode: 'new'; layout: Layout; id: string; title: string; location: BlockLocation; parent?: string }
  | { mode: 'existing'; id: string; parent?: string };

/** Panel to add a slide: a new block from a layout template, or an existing block (library/parent). */
@Component({
  selector: 'sc-add-slide',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="head">
      <h2>Folie hinzufügen</h2>
      <button type="button" class="btn ghost icon-only" title="Schließen" (click)="cancel.emit()"><span class="icon">close</span></button>
    </header>

    <div class="tabs" role="tablist">
      <button type="button" role="tab" [class.active]="mode() === 'new'" (click)="mode.set('new')">Neue Folie</button>
      <button type="button" role="tab" [class.active]="mode() === 'existing'" (click)="mode.set('existing')">
        Vorhandene Folie ({{ unused().length }})
      </button>
    </div>

    <div class="field">
      <label for="add-parent">Einfügen als</label>
      <select id="add-parent" [value]="parent()" (change)="parent.set($any($event.target).value)">
        <option value="">Hauptfolie (am Ende)</option>
        @for (id of mainSlides(); track id) {
          <option [value]="id" [selected]="parent() === id">Vertiefung (↓) unter „{{ titleOf()(id) }}“</option>
        }
      </select>
    </div>

    @if (mode() === 'new') {
      <div class="layouts">
        @for (l of layouts; track l.id) {
          <button type="button" class="layout" [class.active]="layout() === l.id" (click)="layout.set(l.id)">
            <span class="icon">{{ l.icon }}</span>
            <span class="name">{{ l.name }}</span>
            <span class="desc">{{ l.description }}</span>
          </button>
        }
      </div>
      <div class="row">
        <div class="field">
          <label for="add-title">Titel</label>
          <input id="add-title" [value]="title()" (input)="title.set($any($event.target).value)" placeholder="z. B. Kundenportal" />
        </div>
        <div class="field">
          <label for="add-id">Block-ID</label>
          <input id="add-id" [value]="id()" [placeholder]="defaultId() || 'block-id'" (input)="id.set($any($event.target).value)" />
          @if (idProblem()) {
            <span class="hint err">{{ idProblem() }}</span>
          } @else {
            <span class="hint">Dateiname: {{ effectiveId() || '…' }}.md</span>
          }
        </div>
      </div>
      <div class="field">
        <span class="label">Speichern in</span>
        @if (deckIsChild()) {
          <label class="check"><input type="radio" name="loc" [checked]="!toLibrary()" (change)="toLibrary.set(false)" /> Nur dieses Deck (content/decks/{{ deckId() }}/blocks)</label>
          <label class="check"><input type="radio" name="loc" [checked]="toLibrary()" (change)="toLibrary.set(true)" /> Bibliothek – für alle Decks nutzbar (content/blocks)</label>
        } @else {
          <span class="hint">Bibliothek (content/blocks) – Basis-Decks nutzen die gemeinsame Bibliothek.</span>
        }
      </div>
      <div class="actions">
        <button type="button" class="btn ghost" (click)="cancel.emit()">Abbrechen</button>
        <button type="button" class="btn primary" [disabled]="!!idProblem() || !title().trim()" (click)="submitNew()">
          <span class="icon">add</span> Folie anlegen
        </button>
      </div>
    } @else {
      @if (unused().length) {
        <div class="field">
          <label for="add-filter">Suchen</label>
          <input id="add-filter" [value]="filter()" (input)="filter.set($any($event.target).value)" placeholder="Titel oder ID" />
        </div>
        <ul class="existing">
          @for (b of filtered(); track b.id) {
            <li>
              <button type="button" [class.active]="existing() === b.id" (click)="existing.set(b.id)">
                <span class="icon">{{ iconOf(b.layout) }}</span>
                <span class="t">{{ b.title }}</span>
                <span class="m">{{ b.id }} · {{ where(b.location) }}</span>
              </button>
            </li>
          }
        </ul>
      } @else {
        <p class="muted">Alle verfügbaren Folien sind schon im Deck.</p>
      }
      <div class="actions">
        <button type="button" class="btn ghost" (click)="cancel.emit()">Abbrechen</button>
        <button type="button" class="btn primary" [disabled]="!existing()" (click)="submitExisting()"><span class="icon">add</span> Einfügen</button>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 14px;
      h2 {
        font-size: 26px;
      }
    }
    .tabs {
      display: flex;
      gap: 4px;
      padding: 4px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--ink) 6%, transparent);
      margin-bottom: 18px;
      button {
        flex: 1;
        border: 0;
        background: transparent;
        border-radius: 999px;
        padding: 7px 12px;
        cursor: pointer;
        color: var(--muted);
        &.active {
          background: var(--surface);
          color: var(--ink);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
        }
      }
    }
    .layouts {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 8px;
      margin-bottom: 18px;
    }
    .layout {
      display: grid;
      gap: 3px;
      text-align: left;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid var(--line);
      background: var(--surface);
      cursor: pointer;
      .icon {
        color: var(--accent);
        font-size: 22px;
        margin-bottom: 4px;
      }
      .name {
        font-weight: 600;
      }
      .desc {
        font-size: 12px;
        color: var(--muted);
        line-height: 1.3;
      }
      &.active {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-soft);
      }
    }
    .field .check {
      font-size: 14px;
      margin: 2px 0;
    }
    .existing {
      list-style: none;
      margin: 0 0 12px;
      padding: 0;
      max-height: 340px;
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 12px;
      background: var(--surface);
      button {
        width: 100%;
        display: grid;
        grid-template-columns: 28px 1fr;
        column-gap: 8px;
        text-align: left;
        padding: 9px 12px;
        border: 0;
        border-bottom: 1px solid var(--line);
        background: transparent;
        cursor: pointer;
        .icon {
          grid-row: span 2;
          color: var(--accent);
          align-self: center;
        }
        .m {
          font-size: 12px;
          color: var(--muted);
        }
        &.active {
          background: var(--accent-soft);
        }
      }
      li:last-child button {
        border-bottom: 0;
      }
    }
    .muted {
      color: var(--muted);
    }
    .err {
      color: var(--sc-danger) !important;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }
  `,
})
export class AddSlideComponent {
  readonly deckId = input.required<string>();
  readonly deckIsChild = input(false);
  readonly blocks = input.required<BlockInfo[]>();
  /** Block ids already used in the deck's slide list. */
  readonly usedIds = input.required<string[]>();
  /** Main slide ids (possible parents for a deep dive). */
  readonly mainSlides = input.required<string[]>();
  readonly initialParent = input<string>('');
  readonly titleOf = input.required<(id: string) => string>();

  readonly add = output<AddSlideRequest>();
  readonly cancel = output<void>();

  protected readonly layouts = LAYOUT_INFO;
  protected readonly mode = signal<'new' | 'existing'>('new');
  protected readonly parent = linkedSignal(() => this.initialParent());
  protected readonly layout = signal<Layout>('showcase');
  protected readonly title = signal('');
  protected readonly id = signal('');
  protected readonly toLibrary = linkedSignal(() => !this.deckIsChild());
  protected readonly existing = signal('');
  protected readonly filter = signal('');

  protected readonly defaultId = computed(() => slugify(this.title()));
  protected readonly effectiveId = computed(() => this.id() || this.defaultId());
  protected readonly idProblem = computed(() => {
    const id = this.effectiveId();
    if (!id) return 'Bitte einen Titel oder eine ID angeben';
    if (!KEBAB.test(id)) return 'Nur Kleinbuchstaben, Ziffern und Bindestriche';
    const clash = this.blocks().find((b) => b.id === id);
    if (clash) return `Die ID „${id}“ ist schon vergeben (${this.where(clash.location)})`;
    return '';
  });

  protected readonly unused = computed(() => this.blocks().filter((b) => !this.usedIds().includes(b.id)));
  protected readonly filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    return this.unused().filter((b) => !q || b.id.includes(q) || b.title.toLowerCase().includes(q));
  });

  protected iconOf(layout: string) {
    return layoutInfo(layout)?.icon ?? 'help';
  }

  protected where(location: BlockLocation) {
    return locationLabel(location, this.deckId());
  }

  protected submitNew() {
    if (this.idProblem()) return;
    const location: BlockLocation =
      this.deckIsChild() && !this.toLibrary() ? { kind: 'deck', deck: this.deckId() } : { kind: 'library' };
    this.add.emit({
      mode: 'new',
      layout: this.layout(),
      id: this.effectiveId(),
      title: this.title().trim(),
      location,
      parent: this.parent() || undefined,
    });
  }

  protected submitExisting() {
    if (!this.existing()) return;
    this.add.emit({ mode: 'existing', id: this.existing(), parent: this.parent() || undefined });
  }
}
