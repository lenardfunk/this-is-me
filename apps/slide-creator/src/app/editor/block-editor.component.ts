import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { BlockDraft } from '../../../shared/api.types';
import { getIn, layoutInfo, move, setIn, type Path } from '../model';
import { JsonField, ListField, MediaField, MediaPathField, NumberField, PointField, PointsField, TextField } from './fields';
import { JourneyMapComponent, type MapPick } from './journey-map.component';

// Frontmatter is edited generically; the API validates it against the zod schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fm = Record<string, any>;

/** Form for one block file: common fields, layout-specific fields, body, notes and hub tile. */
@Component({
  selector: 'sc-block-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TextField, NumberField, ListField, PointField, PointsField, MediaField, MediaPathField, JsonField, JourneyMapComponent],
  templateUrl: './block-editor.component.html',
  styleUrl: './block-editor.component.scss',
})
export class BlockEditorComponent {
  readonly draft = input.required<BlockDraft>();
  /** Block ids that are deep dives (children) of this slide in the deck – choices for station.deepDive. */
  readonly childIds = input<string[]>([]);
  /** Whether the block file belongs to the current deck; otherwise hide/highlight go into overrides. */
  readonly ownBlock = input(true);
  /** The deck's override for this block (deep-merged into the frontmatter at build time). */
  readonly override = input<Record<string, unknown> | undefined>();
  readonly showOverride = input(false);

  readonly draftChange = output<BlockDraft>();
  readonly overrideChange = output<Record<string, unknown> | undefined>();

  protected readonly fm = computed<Fm>(() => this.draft().frontmatter);
  protected readonly layout = computed(() => String(this.fm()['layout']));
  protected readonly info = computed(() => layoutInfo(this.layout()));
  protected readonly mapTarget = signal('at:0');
  protected readonly companyHint = '{{company.name}} wird durch den Firmennamen des Decks ersetzt';

  protected readonly tileSizes = [
    { value: 'md', label: 'Normal' },
    { value: 'wide', label: 'Breit' },
    { value: 'lg', label: 'Groß' },
  ];

  // ---- frontmatter helpers -----------------------------------------------------------------

  protected get(path: Path): unknown {
    return getIn(this.fm(), path);
  }

  protected set(path: Path, value: unknown) {
    this.draftChange.emit(setIn(this.draft(), ['frontmatter', ...path], value));
  }

  protected setPart(part: 'body' | 'notes', value: string | undefined) {
    this.draftChange.emit({ ...this.draft(), [part]: value ?? '' });
  }

  protected list(path: Path): unknown[] {
    const v = this.get(path);
    return Array.isArray(v) ? v : [];
  }

  protected add(path: Path, item: unknown) {
    this.set(path, [...this.list(path), item]);
  }

  protected remove(path: Path, index: number) {
    this.set(
      path,
      this.list(path).filter((_, i) => i !== index),
    );
  }

  protected shift(path: Path, index: number, by: number) {
    this.set(path, move(this.list(path), index, index + by));
  }

  /** Empty objects (e.g. a tile with all fields cleared) are removed. */
  protected setObjectField(path: Path, key: string, value: unknown) {
    const next = setIn((this.get(path) as object) ?? {}, [key], value);
    this.set(path, Object.keys(next).length ? next : undefined);
  }

  // ---- journey -----------------------------------------------------------------------------

  protected readonly stations = computed(() => this.list(['stations']) as Fm[]);

  protected addStation() {
    const n = this.stations().length + 1;
    const last = this.stations().at(-1);
    this.add(['stations'], {
      id: `station-${n}`,
      at: last?.['at'] ? [Math.min(100, last['at'][0] + 5), Math.max(0, last['at'][1] - 5)] : [50, 50],
      year: 'TODO',
      title: `Station ${n}`,
      tags: [],
    });
    this.mapTarget.set(`at:${n - 1}`);
  }

  protected onMapPick({ target, point }: MapPick) {
    const [kind, idx] = target.split(':');
    if (kind === 'secret') this.set(['secret', 'at'], point);
    else if (kind === 'at') this.set(['stations', Number(idx), 'at'], point);
    else if (kind === 'via') this.set(['stations', Number(idx), 'via'], [...this.list(['stations', Number(idx), 'via']), point]);
  }

  protected toggleSecret(on: boolean) {
    this.set(['secret'], on ? { at: [10, 75], year: 'Versteckte Station', title: 'Abseits des Weges', tags: [] } : undefined);
  }

  /** hide/highlight: in the block itself if it is the deck's own block, otherwise as a deck override. */
  protected stationFlag(field: 'hide' | 'highlight', stationId: string): boolean {
    const source = this.ownBlock() ? this.fm() : (this.override() ?? {});
    const list = source[field];
    return Array.isArray(list) && list.includes(stationId);
  }

  protected setStationFlag(field: 'hide' | 'highlight', stationId: string, on: boolean) {
    const current = this.ownBlock() ? this.fm()[field] : this.override()?.[field];
    const list = (Array.isArray(current) ? current : []).filter((id: string) => id !== stationId);
    if (on) list.push(stationId);
    const value = list.length ? list : undefined;
    if (this.ownBlock()) this.set([field], value);
    else {
      const next = setIn(this.override() ?? {}, [field], value);
      this.overrideChange.emit(Object.keys(next).length ? next : undefined);
    }
  }

  protected readImageSize() {
    const src = this.fm()['image'];
    if (!src) return;
    const img = new Image();
    img.onload = () => this.set(['imageSize'], [img.naturalWidth, img.naturalHeight]);
    img.src = src;
  }
}
