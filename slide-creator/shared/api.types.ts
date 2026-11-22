/**
 * Types shared by the slide creator's API server and its Angular client.
 * Type-only module: no runtime code, so both sides can import it.
 */
import type { DeckFile, SlideRef } from '../../src/app/core/content.schema.ts';

/** Where a block file lives: the shared library (`content/blocks`) or a deck's own `blocks/` folder. */
export type BlockLocation = { kind: 'library' } | { kind: 'deck'; deck: string };

export interface DeckSummary {
  id: string;
  title: string;
  extends?: string;
  company?: string;
  accent?: string;
  unlisted: boolean;
  /** Set if the deck file cannot be read. */
  error?: string;
}

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
  unlisted?: boolean;
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

export type { DeckFile, SlideRef };
