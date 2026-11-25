/**
 * Types shared by the slide creator's API server and its Angular client.
 * Type-only module: no runtime code, so both sides can import it.
 */
import type { DeckFile, Publication, SlideRef } from '@this-is-me/content';

/** Where a block file lives: the shared library (`content/blocks`) or a deck's own `blocks/` folder. */
export type BlockLocation = { kind: 'library' } | { kind: 'deck'; deck: string };

export interface DeckSummary {
  id: string;
  title: string;
  extends?: string;
  company?: string;
  accent?: string;
  /** Publication state; `draft` if the deck was never published. */
  state?: PublicationState;
  /** Set if the deck file cannot be read. */
  error?: string;
}

export type PublicationState = 'draft' | 'live' | 'revoked' | 'expired';

/** Where the deck file stands relative to what Vercel builds: committed and pushed, or not yet. */
export type DeployState = 'synced' | 'uncommitted' | 'unpushed';

export interface PublicationInfo {
  /** Readable id (folder name). */
  deck: string;
  title: string;
  company?: string;
  accent?: string;
  state: PublicationState;
  publication?: Publication;
  /** Only known inside a git checkout; undefined for decks that were never published. */
  deploy?: DeployState;
}

export interface PublicationList {
  /** Production base URL from `content/site.json`; undefined until it is set. */
  baseUrl?: string;
  items: PublicationInfo[];
}

export type PublicationAction =
  | { action: 'publish' | 'rotate' | 'revoke' }
  | { action: 'update'; note?: string; expiresAt?: string | null };

export interface BlockInfo {
  id: string;
  title: string;
  layout: string;
  /** The file the deck uses for this id. */
  location: BlockLocation;
  /** Files with the same id that are hidden by `location` (e.g. the library version of a replaced block). */
  shadows: BlockLocation[];
}

export interface DeckDetails {
  /** The deck file as stored. */
  deck: DeckFile;
  /** Inheritance chain, root first, the deck itself last. */
  chain: string[];
  /** Effective slide list (own or inherited). */
  slides: SlideRef[];
  /** Deck whose `slides` list is in effect (undefined if none defines one). */
  slidesFrom?: string;
  /** Slide list the deck would inherit without its own `slides`. */
  parentSlides?: SlideRef[];
  /** Overrides defined by parent decks (merged, informational). */
  inheritedOverrides: Record<string, unknown>;
  /** All blocks this deck can use. */
  blocks: BlockInfo[];
}

/** A block file split into its parts (frontmatter as stored, before overrides). */
export interface BlockDraft {
  location: BlockLocation;
  frontmatter: Record<string, unknown>;
  body: string;
  notes: string;
}

export interface NewDeckInput {
  id: string;
  title?: string;
  extends?: string;
  durationMinutes?: number;
  company?: { name?: string; accent?: string; logo?: string };
  /** Copy the effective slide list of this deck instead of inheriting it. */
  copySlidesFrom?: string;
}

/** Result of the full content build that runs after every save. */
export interface SaveResult {
  problems: string[];
  warnings: string[];
}

export interface PreviewRequest {
  blockId: string;
  block?: BlockDraft;
  deck?: DeckFile;
}

export type { DeckFile, Publication, SlideRef };
