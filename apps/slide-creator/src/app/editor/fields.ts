import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import type { Media } from '@this-is-me/content';
import { ApiService, problemsOf } from '../api.service';

let nextId = 0;
const uid = (prefix: string) => `${prefix}-${++nextId}`;

/** Single- or multi-line text. Optional fields emit `undefined` when cleared. */
@Component({
  selector: 'sc-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <label [for]="id">{{ label() }}@if (optional()) {<span class="opt"> · optional</span>}</label>
      @if (multiline()) {
        <textarea
          [id]="id"
          [rows]="rows()"
          [value]="value() ?? ''"
          [placeholder]="placeholder()"
          (input)="emit($any($event.target).value)"
        ></textarea>
      } @else {
        <input
          [id]="id"
          [value]="value() ?? ''"
          [placeholder]="placeholder()"
          [attr.list]="list() ?? null"
          (input)="emit($any($event.target).value)"
        />
      }
      @if (hint()) {
        <span class="hint">{{ hint() }}</span>
      }
    </div>
  `,
  styles: `
    .opt {
      font-weight: 400;
    }
  `,
})
export class TextField {
  readonly label = input.required<string>();
  readonly value = input<string | number | undefined | null>();
  readonly optional = input(false);
  readonly multiline = input(false);
  readonly rows = input(3);
  readonly placeholder = input('');
  readonly hint = input('');
  /** id of a `<datalist>` with suggestions */
  readonly list = input<string>();
  readonly valueChange = output<string | undefined>();
  protected readonly id = uid('text');

  protected emit(v: string) {
    this.valueChange.emit(v === '' && this.optional() ? undefined : v);
  }
}

/** Number input; emits `undefined` when cleared. */
@Component({
  selector: 'sc-number',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <label [for]="id">{{ label() }}</label>
      <input
        [id]="id"
        type="number"
        [step]="step()"
        [min]="min() ?? null"
        [max]="max() ?? null"
        [value]="value() ?? ''"
        (input)="emit($any($event.target).value)"
      />
      @if (hint()) {
        <span class="hint">{{ hint() }}</span>
      }
    </div>
  `,
})
export class NumberField {
  readonly label = input.required<string>();
  readonly value = input<number | undefined>();
  readonly step = input<number | 'any'>('any');
  readonly min = input<number>();
  readonly max = input<number>();
  readonly hint = input('');
  readonly valueChange = output<number | undefined>();
  protected readonly id = uid('num');

  protected emit(raw: string) {
    const n = Number(raw);
    this.valueChange.emit(raw === '' || Number.isNaN(n) ? undefined : n);
  }
}

/**
 * A list of strings edited as text: one item per line, or comma separated. The raw text is kept
 * while typing, so a trailing newline or comma does not vanish before the next item is typed.
 */
@Component({
  selector: 'sc-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <label [for]="id">{{ label() }}</label>
      @if (mode() === 'lines') {
        <textarea [id]="id" [rows]="rows()" [value]="text()" (input)="onInput($any($event.target).value)"></textarea>
      } @else {
        <input [id]="id" [value]="text()" (input)="onInput($any($event.target).value)" />
      }
      <span class="hint">{{ hint() || (mode() === 'lines' ? 'Ein Eintrag pro Zeile' : 'Mit Komma trennen') }}</span>
    </div>
  `,
})
export class ListField {
  readonly label = input.required<string>();
  readonly value = input<readonly string[] | undefined>();
  readonly mode = input<'lines' | 'comma'>('lines');
  readonly rows = input(4);
  readonly hint = input('');
  readonly valueChange = output<string[]>();
  protected readonly id = uid('list');

  private readonly separator = computed(() => (this.mode() === 'lines' ? '\n' : ','));
  protected readonly text = linkedSignal<readonly string[] | undefined, string>({
    source: () => this.value(),
    computation: (list, previous) => {
      if (previous && same(this.parse(previous.value), list ?? [])) return previous.value;
      return (list ?? []).join(this.mode() === 'lines' ? '\n' : ', ');
    },
  });

  private parse(text: string) {
    return text
      .split(this.separator())
      .map((s) => s.trim())
      .filter(Boolean);
  }

  protected onInput(text: string) {
    this.text.set(text);
    this.valueChange.emit(this.parse(text));
  }
}

const same = (a: readonly unknown[], b: readonly unknown[]) => JSON.stringify(a) === JSON.stringify(b);

type Point = [number, number];

/** A percent point [x, y]. */
@Component({
  selector: 'sc-point',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NumberField],
  template: `
    <div class="row">
      <sc-number [label]="label() + ' x %'" [value]="value()?.[0]" [min]="0" [max]="100" (valueChange)="set(0, $event)" />
      <sc-number [label]="label() + ' y %'" [value]="value()?.[1]" [min]="0" [max]="100" (valueChange)="set(1, $event)" />
    </div>
  `,
})
export class PointField {
  readonly label = input('Position');
  readonly value = input<readonly number[] | undefined>();
  readonly valueChange = output<Point>();

  protected set(index: 0 | 1, v: number | undefined) {
    const next: Point = [this.value()?.[0] ?? 50, this.value()?.[1] ?? 50];
    next[index] = v ?? 0;
    this.valueChange.emit(next);
  }
}

/** A list of points, edited as "x, y; x, y". */
@Component({
  selector: 'sc-points',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <label [for]="id">{{ label() }}</label>
      <input [id]="id" [value]="text()" placeholder="z. B. 72, 89; 58, 86" (input)="onInput($any($event.target).value)" />
      <span class="hint">{{ hint() }}</span>
    </div>
  `,
})
export class PointsField {
  readonly label = input.required<string>();
  readonly value = input<readonly (readonly number[])[] | undefined>();
  readonly hint = input('Punkte als „x, y“ in %, getrennt mit „;“');
  readonly valueChange = output<Point[] | undefined>();
  protected readonly id = uid('points');

  protected readonly text = linkedSignal<readonly (readonly number[])[] | undefined, string>({
    source: () => this.value(),
    computation: (points, previous) => {
      if (previous && same(parsePoints(previous.value), points ?? [])) return previous.value;
      return (points ?? []).map((p) => p.join(', ')).join('; ');
    },
  });

  protected onInput(text: string) {
    this.text.set(text);
    const points = parsePoints(text);
    this.valueChange.emit(points.length ? points : undefined);
  }
}

export function parsePoints(text: string): Point[] {
  return text
    .split(';')
    .map((part) => part.split(',').map((n) => Number(n.trim())))
    .filter((p): p is Point => p.length === 2 && p.every((n) => Number.isFinite(n)) && !!text.trim());
}

/** JSON text; emits only when the text parses. */
@Component({
  selector: 'sc-json',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="field">
      <label [for]="id">{{ label() }}</label>
      <textarea class="mono" [id]="id" [rows]="rows()" [value]="text()" (input)="onInput($any($event.target).value)"></textarea>
      @if (error()) {
        <span class="hint err">{{ error() }}</span>
      } @else if (hint()) {
        <span class="hint">{{ hint() }}</span>
      }
    </div>
  `,
  styles: `
    .mono {
      font-family: ui-monospace, 'Cascadia Mono', Consolas, monospace;
      font-size: 13px;
    }
    .err {
      color: var(--sc-danger);
    }
  `,
})
export class JsonField {
  readonly label = input.required<string>();
  readonly value = input<unknown>();
  readonly rows = input(6);
  readonly hint = input('');
  readonly valueChange = output<unknown>();
  protected readonly id = uid('json');
  protected readonly error = signal('');

  protected readonly text = linkedSignal<unknown, string>({
    source: () => this.value(),
    computation: (value, previous) => {
      if (previous) {
        try {
          if (JSON.stringify(JSON.parse(previous.value || 'null')) === JSON.stringify(value ?? null)) return previous.value;
        } catch {
          return previous.value;
        }
      }
      return value === undefined ? '' : JSON.stringify(value, null, 2);
    },
  });

  protected onInput(text: string) {
    this.text.set(text);
    try {
      const value = text.trim() ? JSON.parse(text) : undefined;
      this.error.set('');
      this.valueChange.emit(value);
    } catch (e) {
      this.error.set(`Kein gültiges JSON: ${(e as Error).message}`);
    }
  }
}

/** Datalist with all files in public/media (rendered once per page). */
@Component({
  selector: 'sc-media-datalist',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <datalist id="sc-media-files">
      @for (m of api.media(); track m) {
        <option [value]="m"></option>
      }
    </datalist>
  `,
})
export class MediaDatalist {
  protected readonly api = inject(ApiService);
}

/** Path to a media file (with suggestions, thumbnail and upload). */
@Component({
  selector: 'sc-media-path',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextField],
  template: `
    <div class="media-path">
      <div class="thumb" [class.empty]="!value()">
        @if (value()) {
          <img [src]="value()" alt="" (error)="broken.set(true)" (load)="broken.set(false)" [class.broken]="broken()" />
        } @else {
          <span class="icon">image</span>
        }
      </div>
      <sc-text
        [label]="label()"
        [value]="value()"
        [optional]="optional()"
        list="sc-media-files"
        [hint]="broken() ? 'Datei nicht gefunden' : hint()"
        (valueChange)="valueChange.emit($event)"
      />
      <label class="btn small upload" [class.busy]="uploading()">
        <span class="icon">upload</span>
        {{ uploading() ? 'Lädt …' : 'Hochladen' }}
        <input type="file" accept="image/*,.svg" (change)="upload($event)" hidden />
      </label>
    </div>
    @if (error()) {
      <div class="problems">{{ error() }}</div>
    }
  `,
  styles: `
    .media-path {
      display: grid;
      grid-template-columns: 56px 1fr auto;
      gap: 10px;
      align-items: start;
    }
    .thumb {
      width: 56px;
      height: 56px;
      margin-top: 22px;
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--line);
      background: var(--sc-panel);
      display: grid;
      place-items: center;
      color: var(--muted);
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      img.broken {
        opacity: 0;
      }
    }
    .upload {
      margin-top: 24px;
      cursor: pointer;
    }
    .busy {
      opacity: 0.6;
      pointer-events: none;
    }
  `,
})
export class MediaPathField {
  private readonly api = inject(ApiService);
  readonly label = input('Datei');
  readonly value = input<string | undefined>();
  readonly optional = input(false);
  readonly hint = input('');
  readonly valueChange = output<string | undefined>();
  protected readonly uploading = signal(false);
  protected readonly broken = signal(false);
  protected readonly error = signal('');

  protected async upload(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.error.set('');
    try {
      this.valueChange.emit(await this.api.uploadMedia(file));
    } catch (e) {
      this.error.set(problemsOf(e).join(' '));
    } finally {
      this.uploading.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }
}

/** A `Media` value: image or SVG file (with alt text), or a registered component. */
@Component({
  selector: 'sc-media',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextField, MediaPathField, JsonField],
  template: `
    <div class="sub-card">
      <div class="sub-card-head">
        <span class="icon">image</span> {{ label() }}
        <span class="spacer"></span>
        @if (value(); as m) {
          <select class="input type" [value]="m.type" (change)="setType($any($event.target).value)" aria-label="Medientyp">
            <option value="image">Foto</option>
            <option value="svg">SVG-Grafik</option>
            <option value="component">Komponente</option>
          </select>
          @if (optional()) {
            <button type="button" class="btn ghost small danger" (click)="valueChange.emit(undefined)">Entfernen</button>
          }
        } @else {
          <button type="button" class="btn small" (click)="add()"><span class="icon">add</span> Hinzufügen</button>
        }
      </div>
      @if (value(); as m) {
        @if (m.type === 'component') {
          <sc-text label="Komponenten-Name" [value]="m.name" (valueChange)="patch({ name: $event ?? '' })" />
          <sc-json label="Inputs (JSON)" [rows]="3" [value]="m.inputs" (valueChange)="patch({ inputs: $any($event) })" />
        } @else {
          <sc-media-path [value]="m.src" (valueChange)="setSrc($event ?? '')" />
          <sc-text label="Bildbeschreibung (alt)" [value]="m.alt" (valueChange)="patch({ alt: $event ?? '' })" />
          @if (m.type === 'image') {
            <sc-text
              label="Bildausschnitt"
              [optional]="true"
              placeholder="z. B. 30% 50%"
              hint="CSS object-position: welcher Teil des Fotos sichtbar bleibt"
              [value]="m.focus"
              (valueChange)="patch({ focus: $event })"
            />
          }
        }
      }
    </div>
  `,
  styles: `
    .type {
      width: auto !important;
      min-height: 30px !important;
      padding: 3px 8px !important;
      font-size: 13px;
    }
  `,
})
export class MediaField {
  readonly label = input('Bild');
  readonly value = input<Media | undefined>();
  readonly optional = input(false);
  readonly valueChange = output<Media | undefined>();

  protected add() {
    this.valueChange.emit({ type: 'image', src: '', alt: '' });
  }

  protected setType(type: Media['type']) {
    const current = this.value();
    if (type === 'component') this.valueChange.emit({ type, name: '' });
    else {
      const src = current && 'src' in current ? current.src : '';
      const alt = current && 'alt' in current ? current.alt : '';
      this.valueChange.emit({ type, src, alt } as Media);
    }
  }

  protected setSrc(src: string) {
    const current = this.value();
    if (!current || current.type === 'component') return;
    // pick the type from the extension, so .svg files get the crisp inline treatment
    const type = /\.svg$/i.test(src) ? 'svg' : current.type === 'svg' && src ? 'image' : current.type;
    const next = { ...current, type, src } as Media;
    if (next.type === 'svg') delete (next as { focus?: string }).focus;
    this.valueChange.emit(next);
  }

  protected patch(patch: Record<string, unknown>) {
    const next = { ...this.value(), ...patch } as Record<string, unknown>;
    for (const [k, v] of Object.entries(next)) if (v === undefined) delete next[k];
    this.valueChange.emit(next as Media);
  }
}
