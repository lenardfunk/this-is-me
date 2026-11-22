import type { Layout, SlideRef } from '../../../src/app/core/content.schema';
import type { BlockLocation } from '../../shared/api.types';

export type Path = ReadonlyArray<string | number>;
type Obj = Record<string, unknown>;

/** Immutable deep set. `undefined` removes an object key; missing containers are created. */
export function setIn<T>(target: T, path: Path, value: unknown): T {
  if (path.length === 0) return value as T;
  const [key, ...rest] = path;
  if (typeof key === 'number') {
    const list: unknown[] = Array.isArray(target) ? [...target] : [];
    list[key] = setIn(list[key], rest, value);
    return list as T;
  }
  const obj: Obj = target && typeof target === 'object' && !Array.isArray(target) ? { ...(target as Obj) } : {};
  const next = setIn(obj[key], rest, value);
  if (next === undefined) delete obj[key];
  else obj[key] = next;
  return obj as T;
}

export function getIn(target: unknown, path: Path): unknown {
  return path.reduce<unknown>(
    (o, k) => (o && typeof o === 'object' ? (o as Record<string | number, unknown>)[k] : undefined),
    target,
  );
}

/** Moves an array element; returns a new array (unchanged copy if `to` is out of range). */
export function move<T>(list: readonly T[], from: number, to: number): T[] {
  const copy = [...list];
  if (to < 0 || to >= copy.length) return copy;
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

export function slugify(text: string): string {
  return text
    .replace(/ß/g, 'ss')
    .replace(/[äöüÄÖÜ]/g, (c) => ({ ä: 'ae', ö: 'oe', ü: 'ue', Ä: 'Ae', Ö: 'Oe', Ü: 'Ue' })[c] ?? c)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const slideIdOf = (ref: SlideRef) => (typeof ref === 'string' ? ref : ref.id);
export const childrenOf = (ref: SlideRef) => (typeof ref === 'string' ? [] : (ref.children ?? []));
export const makeRef = (id: string, children: string[]): SlideRef => (children.length ? { id, children } : id);

export const sameLocation = (a?: BlockLocation, b?: BlockLocation) =>
  !!a && !!b && a.kind === b.kind && (a.kind === 'library' || a.deck === (b as { deck: string }).deck);

export function locationLabel(location: BlockLocation, currentDeck: string): string {
  if (location.kind === 'library') return 'Bibliothek';
  return location.deck === currentDeck ? 'dieses Deck' : `Deck „${location.deck}“`;
}

export interface LayoutInfo {
  id: Layout;
  name: string;
  icon: string;
  description: string;
}

export const LAYOUT_INFO: LayoutInfo[] = [
  { id: 'hero', name: 'Hallo', icon: 'waving_hand', description: 'Porträt, Name und Rolle – zum Einstieg' },
  { id: 'journey', name: 'Werdegang', icon: 'hiking', description: 'Stationen als Weg auf einem Foto' },
  { id: 'stack', name: 'Schichten', icon: 'layers', description: 'Ebenen mit Stichworten, Schritt für Schritt' },
  { id: 'showcase', name: 'Projekt', icon: 'rocket_launch', description: 'Großes Bild, Chips und eine Kennzahl' },
  { id: 'gallery', name: 'Galerie', icon: 'photo_library', description: '2–4 Fotos mit Bildunterschrift' },
  { id: 'closing', name: 'Abschluss', icon: 'flag', description: 'Titel mit Kernpunkten' },
  { id: 'text', name: 'Text', icon: 'notes', description: 'Freier Markdown-Text, z. B. für Vertiefungen' },
];

export const layoutInfo = (id: string) => LAYOUT_INFO.find((l) => l.id === id);

const placeholder = (name: string, alt: string) => ({ type: 'svg', src: `media/placeholder/${name}.svg`, alt });

/** Starting frontmatter, body and notes for a new block of the given layout (valid as is). */
export function blockTemplate(
  layout: Layout,
  id: string,
  title: string,
): { frontmatter: Obj; body: string; notes: string } {
  const base: Obj = { id, layout, title };
  const notes = '**TODO:** Was sage ich zu dieser Folie?';
  switch (layout) {
    case 'hero':
      return {
        frontmatter: {
          ...base,
          kicker: 'Hallo, ich bin',
          subtitle: 'TODO Rolle',
          photo: placeholder('portrait', 'TODO Bildbeschreibung'),
        },
        body: '',
        notes,
      };
    case 'journey':
      return {
        frontmatter: {
          ...base,
          image: 'media/werdegang.jpg',
          imageSize: [851, 577],
          stations: [
            { id: 'start', at: [90, 94], year: 'TODO', title: 'Start', tags: ['TODO'] },
            {
              id: 'gipfel',
              at: [39.5, 33],
              via: [[60, 60]],
              year: 'Als Nächstes',
              title: '{{company.name}}',
              tags: ['der nächste Gipfel'],
              summit: true,
            },
          ],
        },
        body: '',
        notes,
      };
    case 'stack':
      return {
        frontmatter: { ...base, layers: [{ label: 'Ebene 1', icon: 'web', items: ['TODO'] }] },
        body: '',
        notes,
      };
    case 'showcase':
      return {
        frontmatter: {
          ...base,
          kicker: 'Projekt',
          media: placeholder('projekt-a', 'TODO Bildbeschreibung'),
          chips: ['TODO'],
        },
        body: '',
        notes,
      };
    case 'gallery':
      return {
        frontmatter: {
          ...base,
          items: [
            { media: placeholder('mensch-1', 'TODO Bildbeschreibung'), caption: 'TODO' },
            { media: placeholder('mensch-2', 'TODO Bildbeschreibung'), caption: 'TODO' },
          ],
        },
        body: '',
        notes,
      };
    case 'closing':
      return { frontmatter: { ...base, points: ['TODO Punkt 1', 'TODO Punkt 2', 'TODO Punkt 3'] }, body: '', notes };
    case 'text':
      return { frontmatter: { ...base, kicker: 'Vertiefung' }, body: '- **TODO:** Stichpunkt', notes };
  }
}
