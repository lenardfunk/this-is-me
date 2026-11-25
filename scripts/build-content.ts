/**
 * Content build: resolves decks (inheritance, block lookup, overrides, interpolation, journey
 * handling, stepLinks), validates everything against the zod schemas and writes
 * public/generated/decks/*.json.
 *
 * Two modes (see docs/IMPLEMENTIERUNGSPLAN.md, section 2.4):
 *  - development (default): `<id>.json` for every deck (local preview) plus `<publicId>.json`
 *    for every live published deck
 *  - production (`--production`, env `CONTENT_MODE=production`, or any Vercel build): only `<publicId>.json` of live published decks, nothing under
 *    the readable deck name and no deck list, so nothing reveals what else exists
 *
 * Run with Node's type stripping: `node scripts/build-content.ts [--production] [--watch]`
 * (erasable TypeScript syntax only: no enums, no parameter properties).
 */
/// <reference types="node" />

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';
import type { z } from 'zod';
import { BlockSchema, DeckFileSchema, LAYOUTS } from '../libs/content/src/lib/content.schema.ts';
import type {
  Block,
  DeckFile,
  Publication,
  ResolvedBlock,
  ResolvedDeck,
  ResolvedSlide,
  SlideRef,
} from '../libs/content/src/lib/content.schema.ts';

const NOTES_MARKER = '<!-- notes -->';
const DEFAULT_DURATION_MINUTES = 5;
const COMPANY_FALLBACK = 'euch';

type PlainObject = Record<string, unknown>;

export class ContentError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join('\n'));
    this.name = 'ContentError';
    this.problems = problems;
  }
}

export interface BuildOptions {
  /** Directory containing `blocks/` and `decks/`. */
  contentDir: string;
  /** Directory the `decks/` folder is written to. */
  outDir: string;
  /** `production` writes only the published decks under their public id. Default: `development`. */
  mode?: 'development' | 'production';
  /** Today as `YYYY-MM-DD` (publication expiry check); defaults to the local date. */
  today?: string;
  /** Optional `public/` directory: if given, referenced media files are checked for existence. */
  publicDir?: string;
  /** Receives non-fatal warnings (missing media files). */
  warn?: (message: string) => void;
  /**
   * In-memory file contents that take precedence over the disk (absolute path -> source).
   * Used by the slide creator to preview unsaved edits.
   */
  drafts?: Map<string, string>;
}

// ---- helpers -------------------------------------------------------------------------------

const isPlainObject = (v: unknown): v is PlainObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Deep-merge: objects recursively, arrays replace, `null` deletes a key. */
export function deepMerge(base: PlainObject, patch: PlainObject): PlainObject {
  const result: PlainObject = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key];
    else if (isPlainObject(value) && isPlainObject(result[key])) result[key] = deepMerge(result[key], value);
    else result[key] = value;
  }
  return result;
}

function interpolate<T>(value: T, vars: PlainObject): T {
  if (typeof value === 'string') {
    return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
      const resolved = key.split('.').reduce<unknown>((o, k) => (isPlainObject(o) ? o[k] : undefined), vars);
      if (typeof resolved === 'string' || typeof resolved === 'number') return String(resolved);
      return key === 'company.name' ? COMPANY_FALLBACK : match;
    }) as T;
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, vars)) as T;
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, interpolate(v, vars)])) as T;
  }
  return value;
}

function formatIssues(file: string, error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const where = issue.path.length ? issue.path.join('.') : '(root)';
    let message = issue.message;
    if (issue.code === 'invalid_union' && 'discriminator' in issue && issue.discriminator === 'layout') {
      message = `unknown layout – expected one of: ${LAYOUTS.join(', ')}`;
    } else if (issue.code === 'unrecognized_keys') {
      message = `unknown field(s): ${issue.keys.join(', ')}`;
    }
    return `${file}: ${where}: ${message}`;
  });
}

const rel = (base: string, file: string) => path.relative(base, file).split(path.sep).join('/');

// ---- loading -------------------------------------------------------------------------------

export interface RawBlock {
  file: string;
  frontmatter: PlainObject;
  body: string;
  notes: string;
}

/** Splits a block file into frontmatter, Markdown body and speaker notes. */
export function parseBlockSource(source: string, file = ''): RawBlock {
  // gray-matter caches by content, hence the clone below
  const parsed = matter(source);
  const idx = parsed.content.indexOf(NOTES_MARKER);
  const body = idx === -1 ? parsed.content : parsed.content.slice(0, idx);
  const notes = idx === -1 ? '' : parsed.content.slice(idx + NOTES_MARKER.length);
  return { file, frontmatter: structuredClone(parsed.data) as PlainObject, body: body.trim(), notes: notes.trim() };
}

export class DeckLoader {
  readonly opts: BuildOptions;
  readonly deckFiles = new Map<string, DeckFile>();
  readonly problems: string[] = [];

  constructor(opts: BuildOptions) {
    this.opts = opts;
  }

  exists(file: string): boolean {
    return this.opts.drafts?.has(path.resolve(file)) || fs.existsSync(file);
  }

  read(file: string): string {
    return this.opts.drafts?.get(path.resolve(file)) ?? fs.readFileSync(file, 'utf8');
  }

  readBlock(file: string): RawBlock {
    return parseBlockSource(this.read(file), file);
  }

  get decksDir() {
    return path.join(this.opts.contentDir, 'decks');
  }

  deckIds(): string[] {
    if (!fs.existsSync(this.decksDir)) return [];
    return fs
      .readdirSync(this.decksDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && this.exists(path.join(this.decksDir, d.name, 'deck.json')))
      .map((d) => d.name)
      .sort();
  }

  loadDeckFile(id: string, requestedBy?: string): DeckFile {
    const cached = this.deckFiles.get(id);
    if (cached) return cached;
    const file = path.join(this.decksDir, id, 'deck.json');
    const label = rel(this.opts.contentDir, file);
    if (!this.exists(file)) {
      throw new ContentError([`${requestedBy ?? 'build'}: deck "${id}" not found (expected ${label})`]);
    }
    let json: unknown;
    try {
      json = JSON.parse(this.read(file));
    } catch (e) {
      throw new ContentError([`${label}: invalid JSON – ${(e as Error).message}`]);
    }
    const parsed = DeckFileSchema.safeParse(json);
    if (!parsed.success) throw new ContentError(formatIssues(label, parsed.error));
    if (parsed.data.id !== id) {
      throw new ContentError([`${label}: id "${parsed.data.id}" must equal the folder name "${id}"`]);
    }
    this.deckFiles.set(id, parsed.data);
    return parsed.data;
  }

  /** Inheritance chain, root first, deck itself last. Cycles are errors. */
  chain(id: string): DeckFile[] {
    const result: DeckFile[] = [];
    const seen: string[] = [];
    let current: string | undefined = id;
    let requestedBy: string | undefined;
    while (current) {
      if (seen.includes(current)) {
        throw new ContentError([`decks/${id}/deck.json: inheritance cycle: ${[...seen, current].join(' -> ')}`]);
      }
      seen.push(current);
      const deck = this.loadDeckFile(current, requestedBy);
      result.unshift(deck);
      requestedBy = `decks/${current}/deck.json`;
      current = deck.extends;
    }
    return result;
  }

  /** Block lookup: deck blocks -> parent decks' blocks -> shared library. First hit wins. */
  findBlockFile(deckChain: DeckFile[], blockId: string): string | undefined {
    const candidates = [...deckChain]
      .reverse()
      .map((d) => path.join(this.decksDir, d.id, 'blocks', `${blockId}.md`));
    candidates.push(path.join(this.opts.contentDir, 'blocks', `${blockId}.md`));
    return candidates.find((c) => this.exists(c));
  }
}

// ---- resolving -----------------------------------------------------------------------------

interface MergedDeck {
  id: string;
  title: string;
  durationMinutes: number;
  company?: PlainObject;
  slides: SlideRef[];
  overrides: Record<string, PlainObject>;
}

function mergeChain(deckChain: DeckFile[], id: string): MergedDeck {
  let merged: MergedDeck = { id, title: id, durationMinutes: DEFAULT_DURATION_MINUTES, slides: [], overrides: {} };
  for (const deck of deckChain) {
    merged = {
      ...merged,
      title: deck.title ?? merged.title,
      durationMinutes: deck.durationMinutes ?? merged.durationMinutes,
      slides: deck.slides ?? merged.slides,
      company: deck.company ? deepMerge(merged.company ?? {}, deck.company as PlainObject) : merged.company,
      overrides: deck.overrides
        ? (deepMerge(merged.overrides, deck.overrides as PlainObject) as Record<string, PlainObject>)
        : merged.overrides,
    };
  }
  return merged;
}

function renderMarkdown(source: string): string {
  return source ? (marked.parse(source, { async: false }) as string) : '';
}

function resolveBlock(
  loader: DeckLoader,
  deckChain: DeckFile[],
  merged: MergedDeck,
  blockId: string,
  deepDiveIds: string[] | undefined,
  mediaRefs: Set<string>,
): ResolvedBlock {
  const deckLabel = `deck "${merged.id}"`;
  const file = loader.findBlockFile(deckChain, blockId);
  if (!file) {
    throw new ContentError([`${deckLabel}: block "${blockId}" not found (looked in decks/*/blocks and blocks/)`]);
  }
  const label = rel(loader.opts.contentDir, file);
  const raw = loader.readBlock(file);
  if (raw.frontmatter['id'] !== blockId) {
    throw new ContentError([
      `${label}: id "${String(raw.frontmatter['id'])}" must equal the file name "${blockId}"`,
    ]);
  }
  const override = merged.overrides[blockId];
  const withOverride = override ? deepMerge(raw.frontmatter, override) : raw.frontmatter;
  const vars = { company: merged.company };
  const frontmatter = interpolate(withOverride, vars);
  const parsed = BlockSchema.safeParse(frontmatter);
  if (!parsed.success) {
    const where = override ? `${label} (+ overrides of ${deckLabel})` : label;
    throw new ContentError(formatIssues(where, parsed.error));
  }
  let block: Block = parsed.data;
  let steps = block.steps ?? 1;

  if (block.layout === 'journey') {
    const ids = new Set(block.stations.map((s) => s.id));
    const problems: string[] = [];
    if (ids.size !== block.stations.length) problems.push(`${label}: stations: duplicate station ids`);
    for (const field of ['hide', 'highlight'] as const) {
      for (const sid of block[field] ?? []) {
        if (!ids.has(sid)) problems.push(`${label}: ${field}: unknown station id "${sid}"`);
      }
    }
    const hidden = new Set(block.hide ?? []);
    const stations = block.stations.filter((s) => !hidden.has(s.id));
    if (stations.length === 0) problems.push(`${label}: hide: all stations are hidden`);
    for (const s of stations) {
      if (s.deepDive && !deepDiveIds?.includes(s.deepDive)) {
        problems.push(
          `${label}: station "${s.id}": deepDive "${s.deepDive}" is not listed in the children of slide "${blockId}" in ${deckLabel}`,
        );
      }
    }
    if (problems.length) throw new ContentError(problems);
    // the path starts at the first visible station, so it must not carry leading via points
    const [first, ...rest] = stations;
    const { via: _via, ...firstWithoutVia } = first;
    block = { ...block, stations: [firstWithoutVia, ...rest] };
    steps = 1 + stations.length;
  }

  collectMedia(block, mediaRefs);
  return {
    ...block,
    steps,
    bodyHtml: renderMarkdown(interpolate(raw.body, vars)),
    notesHtml: renderMarkdown(interpolate(raw.notes, vars)),
  } as ResolvedBlock;
}

function collectMedia(value: unknown, refs: Set<string>, key?: string) {
  if (typeof value === 'string') {
    if ((key === 'src' || key === 'image' || key === 'logo') && /^media\//.test(value)) refs.add(value);
  } else if (Array.isArray(value)) value.forEach((v) => collectMedia(v, refs, key));
  else if (isPlainObject(value)) Object.entries(value).forEach(([k, v]) => collectMedia(v, refs, k));
}

export function resolveDeck(loader: DeckLoader, id: string): ResolvedDeck {
  const deckChain = loader.chain(id);
  const merged = mergeChain(deckChain, id);
  const mediaRefs = new Set<string>();

  let company: ResolvedDeck['company'];
  if (merged.company) {
    if (typeof merged.company['name'] !== 'string') {
      throw new ContentError([`decks/${id}/deck.json: company.name is required when a company is set`]);
    }
    company = merged.company as ResolvedDeck['company'];
  }
  if (merged.slides.length === 0) throw new ContentError([`decks/${id}/deck.json: deck has no slides`]);

  const slides: ResolvedSlide[] = merged.slides.map((ref) => {
    const slideId = typeof ref === 'string' ? ref : ref.id;
    const childIds = typeof ref === 'string' ? [] : (ref.children ?? []);
    const block = resolveBlock(loader, deckChain, merged, slideId, childIds, mediaRefs);
    const children = childIds.map((cid) => resolveBlock(loader, deckChain, merged, cid, undefined, mediaRefs));
    return { ...block, children, stepLinks: buildStepLinks(block, childIds) };
  });

  const missing = [...mediaRefs].filter(
    (m) => loader.opts.publicDir && !fs.existsSync(path.join(loader.opts.publicDir, m)),
  );
  missing.forEach((m) => loader.opts.warn?.(`deck "${id}": media file not found: public/${m}`));

  return { id, title: merged.title, durationMinutes: merged.durationMinutes, ...(company ? { company } : {}), slides };
}

/**
 * Resolves a single block in the context of a deck (inheritance, overrides, interpolation) without
 * requiring the rest of the deck to be valid. If the block is a main slide of the deck, its children
 * are used for the journey deep-dive check and the step links. Used by the slide creator's preview.
 */
export function resolveBlockInDeck(
  options: BuildOptions,
  deckId: string,
  blockId: string,
): { slide: ResolvedSlide; company?: ResolvedDeck['company'] } {
  const loader = new DeckLoader(options);
  const deckChain = loader.chain(deckId);
  const merged = mergeChain(deckChain, deckId);
  const ref = merged.slides.find((r) => (typeof r === 'string' ? r : r.id) === blockId);
  const childIds = ref && typeof ref !== 'string' ? (ref.children ?? []) : [];
  const block = resolveBlock(loader, deckChain, merged, blockId, childIds, new Set());
  return {
    slide: { ...block, children: [], stepLinks: buildStepLinks(block, childIds) },
    company: merged.company as ResolvedDeck['company'],
  };
}

function buildStepLinks(block: ResolvedBlock, childIds: string[]): (number | null)[] {
  if (block.layout === 'journey') {
    return [
      null,
      ...block.stations.map((s) => {
        const idx = s.deepDive ? childIds.indexOf(s.deepDive) : -1;
        return idx === -1 ? null : idx;
      }),
    ];
  }
  return Array.from({ length: block.steps }, () => (childIds.length > 0 ? 0 : null));
}

// ---- build ---------------------------------------------------------------------------------

export type PublicationState = 'draft' | 'live' | 'revoked' | 'expired';

/** Local date as `YYYY-MM-DD`. */
export function localDate(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** `draft` = never published; the expiry day itself still counts as live. */
export function publicationState(publication: Publication | undefined, today: string): PublicationState {
  if (!publication) return 'draft';
  if (publication.revoked) return 'revoked';
  if (publication.expiresAt && publication.expiresAt < today) return 'expired';
  return 'live';
}

export interface DeckPublicationReport {
  id: string;
  state: PublicationState;
  publicId?: string;
}

export function buildContent(options: BuildOptions): { decks: ResolvedDeck[]; report: DeckPublicationReport[] } {
  const loader = new DeckLoader(options);
  const ids = loader.deckIds();
  if (ids.length === 0) throw new ContentError([`no decks found in ${rel(process.cwd(), loader.decksDir)}`]);

  const decks: ResolvedDeck[] = [];
  const problems: string[] = [];
  for (const id of ids) {
    try {
      decks.push(resolveDeck(loader, id));
    } catch (e) {
      if (e instanceof ContentError) problems.push(...e.problems);
      else throw e;
    }
  }
  if (problems.length) throw new ContentError([...new Set(problems)]);

  const today = options.today ?? localDate();
  const report: DeckPublicationReport[] = decks.map((d) => {
    const publication = loader.deckFiles.get(d.id)?.publication;
    return { id: d.id, state: publicationState(publication, today), ...(publication ? { publicId: publication.id } : {}) };
  });
  const owners = new Map<string, string>();
  for (const { id, publicId } of report) {
    if (!publicId) continue;
    const other = owners.get(publicId.toLowerCase());
    if (other) problems.push(`decks/${id}/deck.json: publication.id is already used by deck "${other}"`);
    else owners.set(publicId.toLowerCase(), id);
  }
  if (problems.length) throw new ContentError(problems);

  const decksOut = path.join(options.outDir, 'decks');
  fs.rmSync(decksOut, { recursive: true, force: true });
  fs.rmSync(path.join(options.outDir, 'index.json'), { force: true });
  fs.mkdirSync(decksOut, { recursive: true });
  const write = (name: string, deck: ResolvedDeck) =>
    fs.writeFileSync(path.join(decksOut, `${name}.json`), JSON.stringify(deck, null, 2));
  for (const deck of decks) {
    if (options.mode !== 'production') write(deck.id, deck);
    const entry = report.find((r) => r.id === deck.id)!;
    if (entry.state === 'live' && entry.publicId) write(entry.publicId, deck);
  }
  return { decks, report };
}

// ---- CLI -----------------------------------------------------------------------------------

function runOnce(options: BuildOptions): boolean {
  try {
    const { decks, report } = buildContent(options);
    console.log(`[content] ${decks.length} deck(s) built: ${decks.map((d) => d.id).join(', ')}`);
    if (options.mode === 'production') {
      const live = report.filter((r) => r.state === 'live');
      console.log(`[content] production: ${live.length} published, ${report.length - live.length} left out`);
      for (const r of report) console.log(`[content]   ${r.id.padEnd(24)} ${r.state}${r.state === 'live' ? ` -> /d/${r.publicId}` : ''}`);
    }
    return true;
  } catch (e) {
    if (e instanceof ContentError) {
      console.error(`[content] build failed:\n${e.problems.map((p) => `  - ${p}`).join('\n')}`);
      return false;
    }
    throw e;
  }
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dirname, '..');
  const options: BuildOptions = {
    contentDir: path.join(root, 'content'),
    outDir: path.join(root, 'public', 'generated'),
    publicDir: path.join(root, 'public'),
    // Vercel always sets VERCEL, so a deploy can never ship the readable deck names by accident
    mode:
      process.argv.includes('--production') || process.env['CONTENT_MODE'] === 'production' || process.env['VERCEL']
        ? 'production'
        : 'development',
    warn: (m) => console.warn(`[content] warning: ${m}`),
  };
  const ok = runOnce(options);
  if (process.argv.includes('--watch')) {
    let timer: NodeJS.Timeout | undefined;
    fs.watch(options.contentDir, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => runOnce(options), 200);
    });
    console.log('[content] watching content/ …');
  } else if (!ok) {
    process.exitCode = 1;
  }
}
