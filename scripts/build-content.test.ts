import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { LAYOUTS } from '../libs/content/src/lib/content.schema.ts';
import { buildContent, ContentError, deepMerge, publicationState } from './build-content.ts';

const fixtures = path.join(import.meta.dirname, 'fixtures');
const LIVE_ID = '11111111-1111-4111-8111-111111111111';

function build(name: string, mode: 'development' | 'production' = 'development') {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tim-content-'));
  try {
    const result = buildContent({ contentDir: path.join(fixtures, name), outDir, mode, today: '2026-06-01' });
    const files = fs.readdirSync(path.join(outDir, 'decks')).sort();
    const rootFiles = fs.readdirSync(outDir).sort();
    return { ...result, outDir, files, rootFiles, byId: Object.fromEntries(result.decks.map((d) => [d.id, d])) };
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
  const { byId, files, rootFiles } = build('ok');

  it('writes one file per deck under its folder name, plus the live ones under their public id', () => {
    assert.deepEqual(files, [`${LIVE_ID}.json`, 'base.json', 'hidden.json', 'inherit.json', 'old.json', 'replace.json']);
  });

  it('writes no deck list that could reveal the public ids', () => {
    assert.deepEqual(rootFiles, ['decks']);
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

describe('publication', () => {
  it('reports draft, live, revoked and expired decks (the expiry day itself still counts)', () => {
    const { report } = build('ok');
    assert.deepEqual(
      report.map((r) => [r.id, r.state]),
      [
        ['base', 'draft'],
        ['hidden', 'revoked'],
        ['inherit', 'live'],
        ['old', 'expired'],
        ['replace', 'draft'],
      ],
    );
    assert.equal(publicationState({ id: LIVE_ID, expiresAt: '2026-06-01' }, '2026-06-01'), 'live');
    assert.equal(publicationState({ id: LIVE_ID, expiresAt: '2026-05-31' }, '2026-06-01'), 'expired');
  });

  it('does not inherit the publication of the parent deck', () => {
    const { report } = build('ok');
    assert.equal(report.find((r) => r.id === 'replace')?.publicId, undefined);
  });

  it('production writes only the live decks under their public id', () => {
    const { files, rootFiles } = build('ok', 'production');
    assert.deepEqual(files, [`${LIVE_ID}.json`]);
    assert.deepEqual(rootFiles, ['decks']);
  });

  it('rejects a public id that two decks share', () => {
    const problems = problemsOf('err-duplicate-publication').join('\n');
    assert.match(problems, /publication\.id is already used by deck "a"/);
  });
});

describe('demo deck', () => {
  const root = path.resolve(import.meta.dirname, '..');

  // content/ is private except for the demo deck, so the demo must stand on its own
  it('builds on its own, uses every layout and only references media that is in the repository', () => {
    const contentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tim-demo-'));
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tim-demo-out-'));
    try {
      fs.cpSync(path.join(root, 'content', 'decks', 'demo'), path.join(contentDir, 'decks', 'demo'), { recursive: true });
      const warnings: string[] = [];
      const { decks } = buildContent({ contentDir, outDir, publicDir: path.join(root, 'public'), warn: (m) => warnings.push(m) });
      assert.deepEqual(decks.map((d) => d.id), ['demo']);
      assert.deepEqual(warnings, []);
      const layouts = new Set(decks[0].slides.flatMap((s) => [s.layout, ...s.children.map((c) => c.layout)]));
      for (const layout of LAYOUTS) assert.ok(layouts.has(layout), `demo deck has no "${layout}" slide`);
      const uploads = JSON.stringify(decks[0]).match(/media\/uploads\/[^"]*/g);
      assert.equal(uploads, null, 'the demo deck must not use private uploads');
    } finally {
      fs.rmSync(contentDir, { recursive: true, force: true });
      fs.rmSync(outDir, { recursive: true, force: true });
    }
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
