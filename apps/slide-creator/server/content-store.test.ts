import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { parseBlockSource } from '../../../scripts/build-content.ts';
import { ContentStore, formatJson, serializeBlock, StoreError } from './content-store.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..');
// The real content/ is private and not in the repository (only the demo deck is), so the store is
// tested against a small fixture: a template deck, a child deck with its own block, a block library.
const fixtureContent = path.join(import.meta.dirname, 'fixtures', 'content');
const demoDeck = path.join(repoRoot, 'content', 'decks', 'demo');

let tmp: string;
let store: ContentStore;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tim-creator-'));
  fs.cpSync(fixtureContent, path.join(tmp, 'content'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'public', 'media'), { recursive: true });
  store = new ContentStore({
    contentDir: path.join(tmp, 'content'),
    publicDir: path.join(tmp, 'public'),
    outDir: path.join(tmp, 'public', 'generated'),
  });
});

afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

function blockFiles(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(dir, f));
}

describe('serializeBlock', () => {
  it('round-trips every fixture and demo block without losing data', () => {
    for (const file of [...blockFiles(fixtureContent), ...blockFiles(demoDeck)]) {
      const raw = parseBlockSource(fs.readFileSync(file, 'utf8'));
      const again = parseBlockSource(serializeBlock(raw.frontmatter, raw.body, raw.notes));
      assert.deepEqual(again.frontmatter, raw.frontmatter, file);
      assert.equal(again.body, raw.body, file);
      assert.equal(again.notes, raw.notes, file);
    }
  });

  it('keeps short structures in flow style and long lists as block lists', () => {
    const out = serializeBlock(
      {
        id: 'x',
        layout: 'closing',
        title: 'Warum {{company.name}}?',
        tile: { label: 'Hallo', size: 'md' },
        points: ['Ein ziemlich langer erster Punkt mit vielen Wörtern', 'Ein zweiter, ebenfalls langer Punkt hier'],
      },
      '',
      'Notiz',
    );
    assert.equal(
      out,
      [
        '---',
        'id: x',
        'layout: closing',
        "title: 'Warum {{company.name}}?'",
        'tile: { label: Hallo, size: md }',
        'points:',
        '  - Ein ziemlich langer erster Punkt mit vielen Wörtern',
        // js-yaml 3 always quotes strings containing ", "
        "  - 'Ein zweiter, ebenfalls langer Punkt hier'",
        '---',
        '<!-- notes -->',
        'Notiz',
        '',
      ].join('\n'),
    );
  });
});

describe('formatJson', () => {
  it('reproduces the hand-written deck files', () => {
    const files = [
      path.join(fixtureContent, 'decks', 'default', 'deck.json'),
      path.join(fixtureContent, 'decks', 'beispiel-firma', 'deck.json'),
      path.join(demoDeck, 'deck.json'),
    ];
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      assert.equal(`${formatJson(JSON.parse(source))}\n`, source, file);
    }
  });
});

describe('ContentStore', () => {
  it('lists decks and resolves where each block comes from', () => {
    const ids = store.listDecks().map((d) => d.id);
    assert.ok(ids.includes('beispiel-firma') && ids.includes('default'), ids.join(', '));
    const details = store.getDeck('beispiel-firma');
    assert.deepEqual(details.chain, ['default', 'beispiel-firma']);
    assert.equal(details.slidesFrom, 'default');
    const warum = details.blocks.find((b) => b.id === 'warum-ihr');
    assert.deepEqual(warum?.location, { kind: 'deck', deck: 'beispiel-firma' });
    assert.deepEqual(warum?.shadows, [{ kind: 'library' }]);
    assert.deepEqual(details.blocks.find((b) => b.id === 'hallo')?.location, { kind: 'library' });
  });

  it('creates a deck that inherits from default and builds', () => {
    store.createDeck({
      id: 'acme',
      extends: 'default',
      title: 'Bewerbung ACME',
      company: { name: 'ACME', accent: '#AA3300' },
    });
    const deck = JSON.parse(fs.readFileSync(path.join(tmp, 'content/decks/acme/deck.json'), 'utf8'));
    assert.deepEqual(deck, {
      id: 'acme',
      extends: 'default',
      title: 'Bewerbung ACME',
      company: { name: 'ACME', accent: '#AA3300' },
    });
    assert.deepEqual(store.build().problems, []);
    assert.throws(() => store.createDeck({ id: 'acme' }), (e) => e instanceof StoreError && e.status === 409);
    assert.throws(() => store.createDeck({ id: 'Not Kebab' }), StoreError);
  });

  it('can copy the slide list instead of inheriting it', () => {
    store.createDeck({ id: 'copy', extends: 'default', copySlidesFrom: 'default' });
    assert.equal(store.getDeck('copy').slidesFrom, 'copy');
    assert.equal(store.getDeck('copy').slides.length, store.getDeck('default').slides.length);
  });

  it('saves a deck-local copy of a block, previews it and deletes it again', () => {
    const block = store.getBlock('beispiel-firma', 'mensch');
    assert.deepEqual(block.location, { kind: 'library' });
    const draft = {
      ...block,
      location: { kind: 'deck' as const, deck: 'beispiel-firma' },
      frontmatter: { ...block.frontmatter, title: 'Privat bei {{company.name}}' },
    };
    // preview uses the draft without writing it
    const company = store.getDeck('beispiel-firma').deck.company?.name;
    assert.equal(store.preview('beispiel-firma', 'mensch', draft).slide.title, `Privat bei ${company}`);
    assert.equal(store.preview('beispiel-firma', 'mensch').slide.title, 'Der Mensch dahinter');

    store.saveBlock('mensch', draft);
    assert.deepEqual(store.getBlock('beispiel-firma', 'mensch').location, draft.location);
    assert.equal(store.getBlock('default', 'mensch').frontmatter['title'], 'Der Mensch dahinter');
    assert.deepEqual(store.build().problems, []);

    store.deleteDeckBlock('beispiel-firma', 'mensch');
    assert.deepEqual(store.getBlock('beispiel-firma', 'mensch').location, { kind: 'library' });
  });

  it('reports schema problems in previews and the build', () => {
    const block = store.getBlock('default', 'projekt-b');
    const broken = { ...block, frontmatter: { ...block.frontmatter, chips: 'nope' } };
    assert.throws(
      () => store.preview('default', 'projekt-b', broken),
      (e) => e instanceof StoreError && e.problems.some((p) => p.includes('chips')),
    );
    store.saveBlock('projekt-b', broken);
    assert.ok(store.build().problems.some((p) => p.includes('chips')));
  });

  it('previews unsaved deck changes (company name, overrides)', () => {
    const deck = store.readDeckFile('beispiel-firma');
    const { slide, company } = store.preview('beispiel-firma', 'hallo', undefined, {
      ...deck,
      overrides: { hallo: { subtitle: 'Neu' } },
    });
    assert.equal(slide.layout === 'hero' && slide.subtitle, 'Neu');
    assert.equal(company?.accent, '#0F6E56');
  });

  it('rejects invalid deck files and inheritance cycles', () => {
    assert.throws(() => store.saveDeck('default', { id: 'other' }), StoreError);
    assert.throws(() => store.saveDeck('default', { id: 'default', extends: 'beispiel-firma' }), StoreError);
    assert.throws(() => store.saveBlock('Bad Id', { location: { kind: 'library' }, frontmatter: {}, body: '', notes: '' }));
  });

  it('stores uploaded media with a safe file name', () => {
    const p = store.saveMedia('Mein Foto (1).JPG', Buffer.from('x'));
    assert.equal(p, 'media/uploads/mein-foto-1.jpg');
    assert.equal(store.saveMedia('Mein Foto (1).JPG', Buffer.from('x')), 'media/uploads/mein-foto-1-2.jpg');
    assert.deepEqual(store.listMedia(), ['media/uploads/mein-foto-1-2.jpg', 'media/uploads/mein-foto-1.jpg']);
    assert.throws(() => store.saveMedia('x.exe', Buffer.from('x')), StoreError);
  });
});

describe('publication', () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const stored = (id: string) => JSON.parse(fs.readFileSync(path.join(tmp, 'content/decks', id, 'deck.json'), 'utf8'));
  const item = (id: string) => store.listPublications().items.find((i) => i.deck === id)!;

  it('lists decks with a parent but not the template, which stays unpublished', () => {
    const { items } = store.listPublications();
    assert.ok(items.some((i) => i.deck === 'beispiel-firma'));
    assert.ok(!items.some((i) => i.deck === 'default'));
    assert.equal(item('beispiel-firma').state, 'draft');
    assert.equal(item('beispiel-firma').publication, undefined);
  });

  it('publishes with a fresh UUID and only touches the publication block', () => {
    const before = stored('beispiel-firma');
    const result = store.updatePublication('beispiel-firma', { action: 'publish' });
    assert.equal(result.state, 'live');
    assert.match(result.publication!.id, UUID);
    assert.deepEqual({ ...stored('beispiel-firma'), publication: undefined }, { ...before, publication: undefined });
    assert.throws(
      () => store.updatePublication('beispiel-firma', { action: 'publish' }),
      (e) => e instanceof StoreError && e.status === 409,
    );
  });

  it('rotates the UUID and keeps note and expiry', () => {
    store.updatePublication('beispiel-firma', { action: 'publish' });
    store.updatePublication('beispiel-firma', { action: 'update', note: ' Mail an HR, 12.11. ', expiresAt: '2099-12-31' });
    const old = item('beispiel-firma').publication!;
    const rotated = store.updatePublication('beispiel-firma', { action: 'rotate' }).publication!;
    assert.notEqual(rotated.id, old.id);
    assert.equal(rotated.note, 'Mail an HR, 12.11.');
    assert.equal(rotated.expiresAt, '2099-12-31');
  });

  it('revokes, refuses to rotate a revoked deck and publishes it again under a new UUID', () => {
    const first = store.updatePublication('beispiel-firma', { action: 'publish' }).publication!;
    assert.equal(store.updatePublication('beispiel-firma', { action: 'revoke' }).state, 'revoked');
    assert.throws(() => store.updatePublication('beispiel-firma', { action: 'rotate' }), StoreError);
    const again = store.updatePublication('beispiel-firma', { action: 'publish' });
    assert.equal(again.state, 'live');
    assert.notEqual(again.publication!.id, first.id);
    assert.equal(again.publication!.revoked, undefined);
  });

  it('shows an expired deck as expired and clears note and expiry on request', () => {
    store.updatePublication('beispiel-firma', { action: 'publish' });
    assert.equal(store.updatePublication('beispiel-firma', { action: 'update', expiresAt: '2020-01-01' }).state, 'expired');
    const cleared = store.updatePublication('beispiel-firma', { action: 'update', expiresAt: null, note: '' });
    assert.equal(cleared.state, 'live');
    assert.deepEqual(Object.keys(cleared.publication!), ['id']);
  });

  it('validates the expiry date and the action', () => {
    store.updatePublication('beispiel-firma', { action: 'publish' });
    assert.throws(() => store.updatePublication('beispiel-firma', { action: 'update', expiresAt: 'bald' }), StoreError);
    assert.throws(() => store.updatePublication('beispiel-firma', { action: 'delete' } as never), StoreError);
    assert.throws(() => store.updatePublication('default', { action: 'revoke' }), StoreError);
  });

  it('reads the production base URL from content/site.json', () => {
    assert.equal(store.listPublications().baseUrl, undefined);
    fs.writeFileSync(path.join(tmp, 'content/site.json'), '{ "baseUrl": "https://this-is-me.vercel.app/" }');
    assert.equal(store.listPublications().baseUrl, 'https://this-is-me.vercel.app');
  });

  it('builds the published deck under its UUID', () => {
    const { publication } = store.updatePublication('beispiel-firma', { action: 'publish' });
    assert.deepEqual(store.build().problems, []);
    assert.ok(fs.existsSync(path.join(tmp, 'public/generated/decks', `${publication!.id}.json`)));
  });
});
