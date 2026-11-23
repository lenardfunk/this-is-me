import { DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { DeckStore } from './deck.store';
import { samePosition, START, type Position } from './navigation';

export type SyncMessage =
  | { kind: 'position'; pos: Position; from: string }
  | { kind: 'blackout'; on: boolean; from: string }
  | { kind: 'hello'; from: string };

export type SyncRole = 'presentation' | 'presenter';

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** Validates untrusted channel data; returns `null` for anything that is not a known message. */
export function parseSyncMessage(data: unknown): SyncMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  const m = data as Record<string, unknown>;
  if (typeof m['from'] !== 'string') return null;
  switch (m['kind']) {
    case 'hello':
      return { kind: 'hello', from: m['from'] };
    case 'blackout':
      return typeof m['on'] === 'boolean' ? { kind: 'blackout', on: m['on'], from: m['from'] } : null;
    case 'position': {
      const p = m['pos'] as Record<string, unknown> | null;
      if (!p || !isInt(p['slide']) || !isInt(p['step']) || !isInt(p['subStep'])) return null;
      if (p['sub'] !== null && !isInt(p['sub'])) return null;
      const pos: Position = { slide: p['slide'], step: p['step'], sub: p['sub'] as number | null, subStep: p['subStep'] };
      return { kind: 'position', pos, from: m['from'] };
    }
    default:
      return null;
  }
}

export const presenterUrl = (deckId: string, base = document.baseURI) =>
  new URL(`presenter/${encodeURIComponent(deckId)}`, base).toString();

/**
 * Keeps the presentation window and the presenter window in sync through a BroadcastChannel
 * per deck. Incoming state is applied without being re-sent (no echo loops).
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  readonly windowId = crypto.randomUUID();

  private readonly store = inject(DeckStore);
  private readonly role = signal<SyncRole | null>(null);
  private channel: BroadcastChannel | null = null;

  /** Last remotely applied values; consumed by the effects below to skip the echo. */
  private remotePosition: Position | null = null;
  private remoteBlackout: boolean | null = null;
  private knownBlackout = false;
  /** A freshly opened presenter must not push its initial position over the presentation. */
  private synced = false;

  constructor() {
    effect((onCleanup) => {
      const deckId = this.store.deckId();
      const role = this.role();
      if (!deckId || !role) return;
      const channel = new BroadcastChannel(`this-is-me:${deckId}`);
      channel.onmessage = (event) => this.receive(parseSyncMessage(event.data));
      this.channel = channel;
      this.synced = role === 'presentation';
      untracked(() => {
        this.send({ kind: 'hello', from: this.windowId });
        // A (re)loaded presentation window is the source of truth: tell open presenters its blackout state.
        if (role === 'presentation') this.send({ kind: 'blackout', on: this.store.blackout(), from: this.windowId });
      });
      onCleanup(() => {
        channel.close();
        if (this.channel === channel) this.channel = null;
      });
    });

    effect(() => {
      const pos = this.store.position();
      untracked(() => {
        if (this.remotePosition && samePosition(this.remotePosition, pos)) {
          this.remotePosition = null;
          return;
        }
        this.remotePosition = null;
        if (!this.synced && samePosition(pos, START)) return;
        this.synced = true;
        this.send({ kind: 'position', pos, from: this.windowId });
      });
    });

    effect(() => {
      const on = this.store.blackout();
      untracked(() => {
        if (on === this.knownBlackout) return;
        this.knownBlackout = on;
        if (this.remoteBlackout === on) {
          this.remoteBlackout = null;
          return;
        }
        this.remoteBlackout = null;
        this.send({ kind: 'blackout', on, from: this.windowId });
      });
    });

    inject(DestroyRef).onDestroy(() => this.channel?.close());
  }

  /** Called by a page to join the channel of the current deck with the given role. */
  start(role: SyncRole) {
    this.role.set(role);
  }

  /** Opens (or focuses) the presenter window; returns false if the browser blocked the popup. */
  openPresenter(): boolean {
    const deckId = this.store.deckId();
    if (!deckId) return false;
    const win = window.open(presenterUrl(deckId), 'this-is-me-presenter', 'popup,width=1280,height=800');
    win?.focus();
    return !!win;
  }

  private send(message: SyncMessage) {
    this.channel?.postMessage(message);
  }

  private receive(message: SyncMessage | null) {
    if (!message || message.from === this.windowId) return;
    switch (message.kind) {
      case 'hello':
        // The presentation window is the source of truth for newcomers.
        if (this.role() === 'presentation') {
          this.send({ kind: 'position', pos: this.store.position(), from: this.windowId });
          this.send({ kind: 'blackout', on: this.store.blackout(), from: this.windowId });
        }
        break;
      case 'position':
        this.synced = true;
        if (!samePosition(this.store.position(), message.pos)) {
          this.remotePosition = message.pos;
          this.store.setPosition(message.pos);
        }
        break;
      case 'blackout':
        if (this.store.blackout() !== message.on) {
          this.remoteBlackout = message.on;
          this.store.blackout.set(message.on);
        }
        break;
    }
  }
}
