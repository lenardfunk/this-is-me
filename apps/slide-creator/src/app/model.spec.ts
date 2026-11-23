import { LAYOUTS } from '@this-is-me/content';
import { blockTemplate, makeRef, move, setIn, slugify } from './model';

describe('setIn', () => {
  it('sets nested values immutably and creates missing containers', () => {
    const source = { a: { b: 1 }, list: [{ x: 1 }] };
    const next = setIn(source, ['list', 0, 'x'], 2);
    expect(next).toEqual({ a: { b: 1 }, list: [{ x: 2 }] });
    expect(source.list[0].x).toBe(1);
    expect(next.a).toBe(source.a);
    expect(setIn({}, ['tile', 'label'], 'Hallo')).toEqual({ tile: { label: 'Hallo' } });
  });

  it('removes keys set to undefined', () => {
    expect(setIn({ kicker: 'x', title: 't' }, ['kicker'], undefined)).toEqual({ title: 't' });
  });
});

describe('helpers', () => {
  it('slugifies German titles', () => {
    expect(slugify('Testfirma Müller & Söhne GmbH')).toBe('testfirma-mueller-soehne-gmbh');
    expect(slugify('Straße – Größe')).toBe('strasse-groesse');
  });

  it('moves list items and keeps the list for out-of-range targets', () => {
    expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(move(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });

  it('writes plain ids for slides without children', () => {
    expect(makeRef('a', [])).toBe('a');
    expect(makeRef('a', ['b'])).toEqual({ id: 'a', children: ['b'] });
  });

  it('has a template for every layout', () => {
    for (const layout of LAYOUTS) {
      const t = blockTemplate(layout, 'x', 'Titel');
      expect(t.frontmatter).toMatchObject({ id: 'x', layout, title: 'Titel' });
    }
  });
});
