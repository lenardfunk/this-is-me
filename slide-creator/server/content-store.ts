/**
 * File access for the slide creator: reads and writes decks (`content/decks/<id>/deck.json`) and
 * blocks (`content/blocks/<id>.md`, `content/decks/<id>/blocks/<id>.md`) in the same style as the
 * hand-written files, and resolves single blocks for the live preview.
 *
 * Runs with Node's type stripping (erasable TypeScript only).
 */
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import {
  buildContent,
  ContentError,
  DeckLoader,
  parseBlockSource,
  resolveBlockInDeck,
} from '../../scripts/build-content.ts';
import { DeckFileSchema } from '../../src/app/core/content.schema.ts';
import type { DeckFile, ResolvedDeck, ResolvedSlide, SlideRef } from '../../src/app/core/content.schema.ts';
import type {
  BlockDraft,
  BlockInfo,
  BlockLocation,
  DeckDetails,
  DeckSummary,
  NewDeckInput,
  SaveResult,
} from '../shared/api.types.ts';

export interface ContentPaths {
  contentDir: string;
  /** `public/` directory (media files live in `public/media`). */
  publicDir: string;
  /** Output directory of the content build (`public/generated`). */
  outDir: string;
}

const NOTES_MARKER = '<!-- notes -->';
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MEDIA_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg']);

/** Error with an HTTP status, thrown for invalid requests. */
export class StoreError extends Error {
  readonly status: number;
  readonly problems: string[];
  constructor(status: number, problems: string[]) {
    super(problems.join('\n'));
    this.name = 'StoreError';
    this.status = status;
    this.problems = problems;
  }
}

function assertId(id: unknown, what: string): asserts id is string {
  if (typeof id !== 'string' || !KEBAB.test(id)) {
    throw new StoreError(400, [`${what} "${String(id)}" must be kebab-case (a-z, 0-9, "-")`]);
  }
}


// ---- formatting ----------------------------------------------------------------------------


const isScalar = (v: unknown) => v === null || typeof v !== 'object';

/** Flat = scalar, list of scalars (or of scalar tuples), or object with scalar values only. */
function isFlat(v: unknown): boolean {
  if (isScalar(v)) return true;
  if (Array.isArray(v)) return v.every((x) => isScalar(x) || (Array.isArray(x) && x.every(isScalar)));
  return Object.values(v as object).every(isScalar);
}

function flowYaml(v: unknown): string {
  // scalars outside a flow collection need no quoting for commas etc.
  const out = yaml.safeDump(v, { flowLevel: isScalar(v) ? -1 : 0, lineWidth: -1 }).trimEnd();
  return /^\{.+\}$/.test(out) ? `{ ${out.slice(1, -1)} }` : out;
}

const MAX_FLOW_LINE = 96;

function yamlMap(obj: Record<string, unknown>, indent: number): string[] {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const flow = isFlat(value) ? flowYaml(value) : null;
    if (flow !== null && (isScalar(value) || pad.length + key.length + flow.length + 2 <= MAX_FLOW_LINE)) {
      lines.push(`${pad}${key}: ${flow}`);
    } else if (Array.isArray(value)) {
      lines.push(`${pad}${key}:`, ...yamlSeq(value, indent + 2));
    } else {
      lines.push(`${pad}${key}:`, ...yamlMap(value as Record<string, unknown>, indent + 2));
    }
  }
  return lines;
}

function yamlSeq(items: unknown[], indent: number): string[] {
  const pad = ' '.repeat(indent);
  const lines: string[] = [];
  for (const item of items) {
    if (isScalar(item) || Array.isArray(item) || Object.keys(item as object).length === 0) {
      lines.push(`${pad}- ${flowYaml(item)}`);
    } else {
      const [first, ...rest] = yamlMap(item as Record<string, unknown>, indent + 2);
      lines.push(`${pad}- ${first.trimStart()}`, ...rest);
    }
  }
  return lines;
}

/** Writes frontmatter in the compact style of the hand-written block files. */
export function serializeBlock(frontmatter: Record<string, unknown>, body: string, notes: string): string {
  const parts = [`---\n${yamlMap(frontmatter, 0).join('\n')}\n---\n`];
  if (body.trim()) parts.push(`${body.trim()}\n`);
  if (notes.trim()) parts.push(`${body.trim() ? '\n' : ''}${NOTES_MARKER}\n${notes.trim()}\n`);
  return parts.join('');
}

/** JSON with short objects/arrays kept on one line, like the hand-written deck files. */
export function formatJson(value: unknown, indent = 0, prefix = 0): string {
  const inline = (v: unknown): string => {
    if (Array.isArray(v)) return `[${v.map(inline).join(', ')}]`;
    if (v && typeof v === 'object') {
      const entries = Object.entries(v).filter(([, x]) => x !== undefined);
      return entries.length ? `{ ${entries.map(([k, x]) => `${JSON.stringify(k)}: ${inline(x)}`).join(', ')} }` : '{}';
    }
    return JSON.stringify(v);
  };
  const flat = inline(value);
  if (isScalar(value) || (indent > 0 && indent + prefix + flat.length <= MAX_FLOW_LINE)) return flat;
  const pad = ' '.repeat(indent + 2);
  if (Array.isArray(value)) {
    return `[\n${value.map((v) => pad + formatJson(v, indent + 2)).join(',\n')}\n${' '.repeat(indent)}]`;
  }
  const entries = Object.entries(value as object).filter(([, x]) => x !== undefined);
  return `{\n${entries
    .map(([k, v]) => `${pad}${JSON.stringify(k)}: ${formatJson(v, indent + 2, k.length + 4)}`)
    .join(',\n')}\n${' '.repeat(indent)}}`;
}

// ---- store ---------------------------------------------------------------------------------

export class ContentStore {
  readonly paths: ContentPaths;

  constructor(paths: ContentPaths) {
    this.paths = paths;
  }

  private get decksDir() {
    return path.join(this.paths.contentDir, 'decks');
  }

  private deckFilePath(id: string) {
    return path.join(this.decksDir, id, 'deck.json');
  }

  blockFilePath(location: BlockLocation, blockId: string) {
    return location.kind === 'library'
      ? path.join(this.paths.contentDir, 'blocks', `${blockId}.md`)
      : path.join(this.decksDir, location.deck, 'blocks', `${blockId}.md`);
  }

  private loader(drafts?: Map<string, string>) {
    return new DeckLoader({ contentDir: this.paths.contentDir, outDir: this.paths.outDir, drafts });
  }

  private wrap<T>(fn: () => T): T {
    try {
      return fn();
    } catch (e) {
      if (e instanceof ContentError) throw new StoreError(422, e.problems);
      throw e;
    }
  }

  readDeckFile(id: string): DeckFile {
    assertId(id, 'deck id');
    if (!fs.existsSync(this.deckFilePath(id))) throw new StoreError(404, [`deck "${id}" not found`]);
    return this.wrap(() => this.loader().loadDeckFile(id));
  }

  listDecks(): DeckSummary[] {
    const loader = this.loader();
    return loader.deckIds().map((id) => {
      try {
        const deck = loader.loadDeckFile(id);
        return {
          id,
          title: deck.title ?? id,
          extends: deck.extends,
          company: deck.company?.name,
          accent: deck.company?.accent,
          unlisted: deck.unlisted ?? false,
        };
      } catch (e) {
        return { id, title: id, unlisted: false, error: e instanceof ContentError ? e.problems.join('\n') : String(e) };
      }
    });
  }

  /** Blocks visible to a deck: own blocks, then parent decks' blocks, then the library. */
  private availableBlocks(chain: string[]): BlockInfo[] {
    const sources: BlockLocation[] = [
      ...[...chain].reverse().map((deck): BlockLocation => ({ kind: 'deck', deck })),
      { kind: 'library' },
    ];
    const seen = new Map<string, BlockInfo>();
    for (const location of sources) {
      const dir = path.dirname(this.blockFilePath(location, 'x'));
      if (!fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir).sort()) {
        if (!name.endsWith('.md')) continue;
        const id = name.slice(0, -3);
        if (seen.has(id)) {
          seen.get(id)!.shadows.push(location);
          continue;
        }
        let title = id;
        let layout = '?';
        try {
          const raw = parseBlockSource(fs.readFileSync(path.join(dir, name), 'utf8'));
          title = String(raw.frontmatter['title'] ?? id);
          layout = String(raw.frontmatter['layout'] ?? '?');
        } catch {
          // unreadable frontmatter: still list the block so it can be fixed
        }
        seen.set(id, { id, title, layout, location, shadows: [] });
      }
    }
    return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  getDeck(id: string): DeckDetails {
    const deck = this.readDeckFile(id);
    const chainFiles = this.wrap(() => this.loader().chain(id));
    const chain = chainFiles.map((d) => d.id);
    const owner = [...chainFiles].reverse().find((d) => d.slides);
    return {
      deck,
      chain,
      slides: owner?.slides ?? [],
      slidesFrom: owner?.id,
      parentSlides: [...chainFiles.slice(0, -1)].reverse().find((d) => d.slides)?.slides,
      inheritedOverrides: chainFiles
        .slice(0, -1)
        .reduce<Record<string, unknown>>((acc, d) => ({ ...acc, ...(d.overrides ?? {}) }), {}),
      blocks: this.availableBlocks(chain),
    };
  }

  createDeck(input: NewDeckInput): DeckFile {
    assertId(input.id, 'deck id');
    if (fs.existsSync(path.join(this.decksDir, input.id))) {
      throw new StoreError(409, [`deck "${input.id}" already exists`]);
    }
    if (input.extends) this.readDeckFile(input.extends);
    let slides: SlideRef[] | undefined;
    if (input.copySlidesFrom) slides = this.getDeck(input.copySlidesFrom).slides;
    const deck: DeckFile = {
      id: input.id,
      ...(input.extends ? { extends: input.extends } : {}),
      title: input.title || input.id,
      ...(input.unlisted ? { unlisted: true } : {}),
      ...(input.durationMinutes ? { durationMinutes: input.durationMinutes } : {}),
      ...(input.company?.name ? { company: input.company } : {}),
      ...(slides ? { slides } : {}),
    };
    if (!deck.extends && !deck.slides) deck.slides = [];
    this.writeDeckFile(deck);
    return deck;
  }

  saveDeck(id: string, deck: unknown): DeckFile {
    assertId(id, 'deck id');
    this.readDeckFile(id);
    const parsed = DeckFileSchema.safeParse(deck);
    if (!parsed.success) {
      throw new StoreError(
        422,
        parsed.error.issues.map((i) => `deck.json: ${i.path.join('.') || '(root)'}: ${i.message}`),
      );
    }
    if (parsed.data.id !== id) throw new StoreError(422, [`deck.json: id must stay "${id}"`]);
    // check the inheritance chain before writing (cycles, missing parents)
    const drafts = new Map([[path.resolve(this.deckFilePath(id)), JSON.stringify(parsed.data)]]);
    this.wrap(() => this.loader(drafts).chain(id));
    this.writeDeckFile(parsed.data);
    return parsed.data;
  }

  private writeDeckFile(deck: DeckFile) {
    const file = this.deckFilePath(deck.id);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${formatJson(deck)}\n`);
  }

  /** The block file a deck would use for `blockId` (own, parent or library). */
  locateBlock(deckId: string, blockId: string): BlockLocation | undefined {
    assertId(blockId, 'block id');
    const chain = this.wrap(() => this.loader().chain(deckId)).map((d) => d.id);
    const found = this.availableBlocks(chain).find((b) => b.id === blockId);
    return found?.location;
  }

  getBlock(deckId: string, blockId: string): BlockDraft {
    const location = this.locateBlock(deckId, blockId);
    if (!location) throw new StoreError(404, [`block "${blockId}" not found for deck "${deckId}"`]);
    const raw = parseBlockSource(fs.readFileSync(this.blockFilePath(location, blockId), 'utf8'));
    return { location, frontmatter: raw.frontmatter, body: raw.body, notes: raw.notes };
  }

  private checkLocation(location: BlockLocation | undefined): BlockLocation {
    if (location?.kind === 'library') return location;
    if (location?.kind === 'deck') {
      this.readDeckFile(location.deck);
      return location;
    }
    throw new StoreError(400, ['location must be { kind: "library" } or { kind: "deck", deck }']);
  }

  private blockSource(blockId: string, draft: BlockDraft): string {
    if (draft.frontmatter?.['id'] !== blockId) {
      throw new StoreError(422, [`frontmatter id must equal the block id "${blockId}"`]);
    }
    return serializeBlock(draft.frontmatter, draft.body ?? '', draft.notes ?? '');
  }

  saveBlock(blockId: string, draft: BlockDraft, options: { create?: boolean } = {}): BlockLocation {
    assertId(blockId, 'block id');
    const location = this.checkLocation(draft.location);
    const file = this.blockFilePath(location, blockId);
    if (options.create && fs.existsSync(file)) {
      throw new StoreError(409, [`block "${blockId}" already exists in ${path.relative(this.paths.contentDir, file)}`]);
    }
    const source = this.blockSource(blockId, draft);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, source);
    return location;
  }

  /** Deletes a deck's own copy of a block (the deck then falls back to the parent/library block). */
  deleteDeckBlock(deckId: string, blockId: string) {
    assertId(blockId, 'block id');
    this.readDeckFile(deckId);
    const file = this.blockFilePath({ kind: 'deck', deck: deckId }, blockId);
    if (!fs.existsSync(file)) throw new StoreError(404, [`deck "${deckId}" has no own block "${blockId}"`]);
    fs.rmSync(file);
    const dir = path.dirname(file);
    if (fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  }

  /** Resolves one block as the deck would show it, optionally with unsaved block/deck edits. */
  preview(
    deckId: string,
    blockId: string,
    block?: BlockDraft,
    deck?: unknown,
  ): { slide: ResolvedSlide; company?: ResolvedDeck['company'] } {
    assertId(deckId, 'deck id');
    assertId(blockId, 'block id');
    const drafts = new Map<string, string>();
    if (block) {
      const location = this.checkLocation(block.location);
      drafts.set(path.resolve(this.blockFilePath(location, blockId)), this.blockSource(blockId, block));
    }
    if (deck) {
      const parsed = DeckFileSchema.safeParse(deck);
      if (!parsed.success) {
        throw new StoreError(422, parsed.error.issues.map((i) => `deck.json: ${i.path.join('.')}: ${i.message}`));
      }
      drafts.set(path.resolve(this.deckFilePath(deckId)), JSON.stringify(parsed.data));
    }
    return this.wrap(() =>
      resolveBlockInDeck({ contentDir: this.paths.contentDir, outDir: this.paths.outDir, drafts }, deckId, blockId),
    );
  }

  /** Runs the full content build (writes `public/generated`), so the main app picks up changes. */
  build(): SaveResult {
    const warnings: string[] = [];
    try {
      buildContent({ ...this.paths, warn: (m) => warnings.push(m) });
      return { problems: [], warnings };
    } catch (e) {
      if (e instanceof ContentError) return { problems: e.problems, warnings };
      throw e;
    }
  }

  listMedia(): string[] {
    const root = path.join(this.paths.publicDir, 'media');
    const result: string[] = [];
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
          result.push(path.relative(this.paths.publicDir, full).split(path.sep).join('/'));
        }
      }
    };
    walk(root);
    return result.sort();
  }

  /** Stores an uploaded file under `public/media/<folder>/` and returns its `media/...` path. */
  saveMedia(fileName: string, data: Buffer, folder = 'uploads'): string {
    const ext = path.extname(fileName).toLowerCase();
    if (!MEDIA_EXTENSIONS.has(ext)) throw new StoreError(400, [`unsupported file type "${ext}"`]);
    if (!KEBAB.test(folder)) throw new StoreError(400, [`folder "${folder}" must be kebab-case`]);
    const base =
      path
        .basename(fileName, path.extname(fileName))
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'bild';
    const dir = path.join(this.paths.publicDir, 'media', folder);
    fs.mkdirSync(dir, { recursive: true });
    let name = `${base}${ext}`;
    for (let i = 2; fs.existsSync(path.join(dir, name)); i++) name = `${base}-${i}${ext}`;
    fs.writeFileSync(path.join(dir, name), data);
    return `media/${folder}/${name}`;
  }
}

