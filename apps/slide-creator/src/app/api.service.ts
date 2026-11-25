import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import type { ResolvedDeck, ResolvedSlide } from '@this-is-me/content';
import type {
  BlockDraft,
  BlockLocation,
  DeckDetails,
  DeckFile,
  DeckSummary,
  NewDeckInput,
  PreviewRequest,
  PublicationAction,
  PublicationInfo,
  PublicationList,
  SaveResult,
} from '../../shared/api.types';

/** Error with the readable problem list sent by the API. */
export class ApiError extends Error {
  readonly problems: string[];
  constructor(problems: string[]) {
    super(problems.join('\n'));
    this.problems = problems;
  }
}

export const problemsOf = (e: unknown): string[] => (e instanceof ApiError ? e.problems : [String(e)]);

export interface PreviewResult {
  slide: ResolvedSlide | null;
  company?: ResolvedDeck['company'];
  problems: string[];
}

/** Talks to the local slide-creator API (slide-creator/server/server.ts, proxied under /api). */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  /** All files under public/media, as `media/...` paths. */
  readonly media = signal<string[]>([]);

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (e) {
      if (e instanceof HttpErrorResponse) {
        const problems = (e.error as { problems?: string[] } | null)?.problems;
        if (problems?.length) throw new ApiError(problems);
        if (e.status === 0 || e.status >= 500) {
          throw new ApiError(['Die Slide-Creator-API ist nicht erreichbar. Läuft „npm run creator“?']);
        }
        throw new ApiError([`${e.status} ${e.statusText}`]);
      }
      throw e;
    }
  }

  decks() {
    return this.call(this.http.get<DeckSummary[]>('/api/decks'));
  }

  deck(id: string) {
    return this.call(this.http.get<DeckDetails>(`/api/decks/${id}`));
  }

  createDeck(input: NewDeckInput) {
    return this.call(this.http.post<SaveResult & { deck: DeckFile }>('/api/decks', input));
  }

  saveDeck(id: string, deck: DeckFile) {
    return this.call(this.http.put<SaveResult & { deck: DeckFile }>(`/api/decks/${id}`, deck));
  }

  publications() {
    return this.call(this.http.get<PublicationList>('/api/publications'));
  }

  updatePublication(deckId: string, request: PublicationAction) {
    return this.call(
      this.http.put<SaveResult & { item: PublicationInfo }>(`/api/decks/${deckId}/publication`, request),
    );
  }

  block(deckId: string, blockId: string) {
    return this.call(this.http.get<BlockDraft>(`/api/decks/${deckId}/blocks/${blockId}`));
  }

  saveBlock(deckId: string, blockId: string, draft: BlockDraft, create = false) {
    return this.call(
      this.http.put<SaveResult & { location: BlockLocation }>(
        `/api/decks/${deckId}/blocks/${blockId}${create ? '?create=1' : ''}`,
        draft,
      ),
    );
  }

  deleteDeckBlock(deckId: string, blockId: string) {
    return this.call(this.http.delete<SaveResult>(`/api/decks/${deckId}/blocks/${blockId}`));
  }

  preview(deckId: string, request: PreviewRequest) {
    return this.call(this.http.post<PreviewResult>(`/api/decks/${deckId}/preview`, request));
  }

  status() {
    return this.call(this.http.get<SaveResult>('/api/status'));
  }

  async refreshMedia() {
    this.media.set(await this.call(this.http.get<string[]>('/api/media')));
  }

  async uploadMedia(file: File, folder?: string): Promise<string> {
    const params = new URLSearchParams({ name: file.name, ...(folder ? { folder } : {}) });
    const { path } = await this.call(this.http.post<{ path: string }>(`/api/media?${params}`, file));
    await this.refreshMedia();
    return path;
  }
}
