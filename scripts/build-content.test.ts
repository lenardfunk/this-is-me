import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { buildContent, ContentError, deepMerge } from './build-content.ts';

const fixtures = path.join(import.meta.dirname, 'fixtures');

function build(name: string) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tim-content-'));
  try {
    const result = buildContent({ contentDir: path.join(fixtures, name), outDir });
    const files = fs.readdirSync(path.join(outDir, 'decks')).sort();
    return { ...result, outDir, files, byId: Object.fromEntries(result.decks.map((d) => [d.id, d])) };
  } finally {
    // outDir is only needed for the file listing above
    fs.rmSync(outDir, { recursive: true, force: true });
  }
}

function problemsOf(name: string): string[] {
  try {
    build(name);
  } catch (e) {
    assert.ok(e instanceof ContentError, `expected ContentError, got ${String(e)}`);
    return e.problems;
  }
  assert.fail('expected the build to fail');
}

describe('deepMerge', () => {
  it('merges objects recursively, replaces arrays and deletes on null', () => {
    const merged = deepMerge({ a: { x: 1, y: 2 }, list: [1, 2], gone: 'x' }, { a: { y: 3 }, list: [9], gone: null });
    assert.deepEqual(merged, { a: { x: 1, y: 3 }, list: [9] });
  });
});

describe('content build', () => {
  const { byId, index, files } = build('ok');

  it('writes one file per deck and an index', () => {
    assert.deepEqual(files, ['base.json', 'hidden.json', 'inherit.json', 'replace.json']);
    assert.deepEqual(
      index.map((d) => [d.id, d.unlisted, d.company]),
      [
        ['base', false, undefined],
        ['hidden', false, undefined],
        ['inherit', true, 'ACME'],
        ['replace', false, 'ACME'],
      ],
    );
  });

  it('inherits slides, duration and merges company', () => {
    const inherit = byId['inherit'];
    assert.deepEqual(inherit.slides.map((s) => s.id), ['intro', 'trail', 'shadow', 'extra']);
    assert.equal(inherit.durationMinutes, 7);
    assert.equal(inherit.title, 'Base');
    assert.deepEqual(byId['replace'].company, { name: 'ACME', accent: '#aa0000' });
  });

  it('replaces the slide list instead of merging', () => {
    assert.deepEqual(byId['replace'].slides.map((s) => s.id), ['shadow', 'intro']);
  });

  it('prefers deck blocks over library blocks (shadowing)', () => {
    assert.equal(byId['replace'].slides[0].title, 'From deck');
    assert.equal(byId['inherit'].slides[2].title, 'From library');
  });

  it('merges overrides: nested objects merge, null deletes, arrays replace', () => {
    const intro = byId['inherit'].slides[0];
    assert.equal(intro.kicker, undefined);
    assert.deepEqual(intro.tile, { label: 'Hi', size: 'md' });
    const trail = byId['inherit'].slides[1];
    assert.equal(trail.layout, 'journey');
    if (trail.layout === 'journey') assert.deepEqual(trail.highlight, ['s2', 's3']);
  });

  it('interpolates company.name in fields, body and notes, with fallback', () => {
    const intro = byId['inherit'].slides[0];
    assert.equal(intro.title, 'Hallo ACME');
    assert.match(intro.bodyHtml, /Body for ACME\./);
    assert.match(intro.notesHtml, /Notes for ACME\./);
    const fallback = byId['base'].slides[0];
    assert.equal(fallback.title, 'Hallo euch');
    assert.match(fallback.notesHtml, /Notes for euch\./);
  });

  it('computes journey steps and stepLinks', () => {
    const trail = byId['base'].slides[1];
    assert.equal(trail.steps, 4);
    assert.deepEqual(trail.stepLinks, [null, null, 0, null]);
    assert.equal(trail.children.length, 1);
  });

  it('hides journey stations and reduces the step count', () => {
    const trail = byId['hidden'].slides[1];
    assert.equal(trail.layout, 'journey');
    if (trail.layout !== 'journey') return;
    assert.deepEqual(trail.stations.map((s) => s.id), ['s2', 's3']);
    assert.equal(trail.stations[0].via, undefined, 'the path starts at the first visible station');
    assert.equal(trail.steps, 3);
    assert.deepEqual(trail.stepLinks, [null, 0, null]);
  });

  it('gives non-journey slides with children a link on every step, others null', () => {
    assert.deepEqual(byId['base'].slides[3].stepLinks, [0]);
    assert.deepEqual(byId['base'].slides[2].stepLinks, [null]);
  });
});

describe('content build errors', () => {
  it('reports a missing block with deck name and id', () => {
    const [problem] = problemsOf('err-missing');
    assert.match(problem, /deck "d"/);
    assert.match(problem, /block "nope" not found/);
  });

  it('detects inheritance cycles', () => {
    const problems = problemsOf('err-cycle').join('\n');
    assert.match(problems, /inheritance cycle/);
  });

  it('explains an unknown layout with the file and the allowed values', () => {
    const [problem] = problemsOf('err-layout');
    assert.match(problem, /blocks\/typo\.md/);
    assert.match(problem, /layout/);
    assert.match(problem, /expected one of: hero, journey/);
  });

  it('requires deepDive ids to be children of the slide', () => {
    const [problem] = problemsOf('err-deepdive');
    assert.match(problem, /deepDive "not-a-child"/);
  });
});
