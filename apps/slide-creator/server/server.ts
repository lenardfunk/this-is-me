/**
 * Local API for the slide creator (http://127.0.0.1:4310). Reads and writes `content/` and
 * `public/media/`, runs the content build after every save and serves `/media/*` for the preview.
 *
 *   node slide-creator/server/server.ts
 *
 * Only binds to localhost: this is an authoring tool, not part of the deployed app.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { ContentStore, StoreError } from './content-store.ts';
import type { BlockDraft, NewDeckInput, PreviewRequest } from '../shared/api.types.ts';

const PORT = Number(process.env['SLIDE_CREATOR_API_PORT'] ?? 4310);
const root = path.resolve(import.meta.dirname, '..', '..', '..');
const store = new ContentStore({
  contentDir: path.join(root, 'content'),
  publicDir: path.join(root, 'public'),
  outDir: path.join(root, 'public', 'generated'),
});

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};
const MAX_BODY = 25 * 1024 * 1024;

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new StoreError(413, ['request body too large']);
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson<T>(req: IncomingMessage): Promise<T> {
  const raw = (await readBody(req)).toString('utf8');
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new StoreError(400, ['invalid JSON body']);
  }
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function serveMedia(res: ServerResponse, urlPath: string) {
  const mediaRoot = path.join(store.paths.publicDir, 'media');
  const file = path.resolve(mediaRoot, decodeURIComponent(urlPath.replace(/^\/media\//, '')));
  if (!file.startsWith(mediaRoot + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

type Handler = (req: IncomingMessage, params: string[], url: URL) => Promise<unknown> | unknown;
const routes: Array<[method: string, pattern: RegExp, handler: Handler]> = [
  ['GET', /^\/api\/decks$/, () => store.listDecks()],
  [
    'POST',
    /^\/api\/decks$/,
    async (req) => {
      const deck = store.createDeck(await readJson<NewDeckInput>(req));
      return { deck, ...store.build() };
    },
  ],
  ['GET', /^\/api\/decks\/([^/]+)$/, (_req, [id]) => store.getDeck(id)],
  [
    'PUT',
    /^\/api\/decks\/([^/]+)$/,
    async (req, [id]) => {
      const deck = store.saveDeck(id, await readJson(req));
      return { deck, ...store.build() };
    },
  ],
  ['GET', /^\/api\/decks\/([^/]+)\/blocks\/([^/]+)$/, (_req, [deck, block]) => store.getBlock(deck, block)],
  [
    'PUT',
    /^\/api\/decks\/([^/]+)\/blocks\/([^/]+)$/,
    async (req, [, block], url) => {
      const location = store.saveBlock(block, await readJson<BlockDraft>(req), {
        create: url.searchParams.get('create') === '1',
      });
      return { location, ...store.build() };
    },
  ],
  [
    'DELETE',
    /^\/api\/decks\/([^/]+)\/blocks\/([^/]+)$/,
    (_req, [deck, block]) => {
      store.deleteDeckBlock(deck, block);
      return store.build();
    },
  ],
  [
    'POST',
    /^\/api\/decks\/([^/]+)\/preview$/,
    async (req, [deck]) => {
      const body = await readJson<PreviewRequest>(req);
      try {
        return { ...store.preview(deck, body.blockId, body.block, body.deck), problems: [] };
      } catch (e) {
        if (e instanceof StoreError && e.status === 422) return { slide: null, problems: e.problems };
        throw e;
      }
    },
  ],
  ['GET', /^\/api\/status$/, () => store.build()],
  ['GET', /^\/api\/media$/, () => store.listMedia()],
  [
    'POST',
    /^\/api\/media$/,
    async (req, _params, url) => {
      const name = url.searchParams.get('name') ?? '';
      const folder = url.searchParams.get('folder') ?? undefined;
      return { path: store.saveMedia(name, await readBody(req), folder) };
    },
  ],
];

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname.startsWith('/media/')) return serveMedia(res, url.pathname);
    for (const [method, pattern, handler] of routes) {
      const match = req.method === method && pattern.exec(url.pathname);
      if (match) {
        const params = match.slice(1).map((p) => decodeURIComponent(p));
        return send(res, 200, await handler(req, params, url));
      }
    }
    send(res, 404, { problems: [`no route for ${req.method} ${url.pathname}`] });
  } catch (e) {
    if (e instanceof StoreError) return send(res, e.status, { problems: e.problems });
    console.error(e);
    send(res, 500, { problems: [String((e as Error)?.message ?? e)] });
  }
});

server.listen(PORT, '127.0.0.1', () => console.log(`[slide-creator] API on http://127.0.0.1:${PORT}`));
