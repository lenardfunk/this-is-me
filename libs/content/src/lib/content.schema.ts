import { z } from 'zod';

/**
 * Single source of truth for the content model (see docs/IMPLEMENTIERUNGSPLAN.md, section 2).
 * The Angular app only imports the *types* from this file (`import type`), so zod never
 * ends up in the browser bundle; the content build script uses the schemas at runtime.
 */

export const LAYOUTS = ['hero', 'journey', 'stack', 'showcase', 'gallery', 'closing', 'text'] as const;

const kebabId = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be kebab-case (a-z, 0-9, "-")');

/** Percent coordinates of a point on the journey photo: [x, y]. */
const percentPoint = z.tuple([z.number().min(0).max(100), z.number().min(0).max(100)]);

export const MediaSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('image'),
    src: z.string().min(1),
    alt: z.string(),
    /** CSS object-position, e.g. "30% 50%" */
    focus: z.string().optional(),
  }),
  z.strictObject({ type: z.literal('svg'), src: z.string().min(1), alt: z.string() }),
  z.strictObject({
    type: z.literal('component'),
    name: z.string().min(1),
    inputs: z.record(z.string(), z.unknown()).optional(),
  }),
]);

export const TileSchema = z.strictObject({
  label: z.string().optional(),
  icon: z.string().optional(),
  size: z.enum(['md', 'wide', 'lg']).optional(),
  image: z.string().optional(),
});

const common = {
  id: kebabId,
  title: z.string().min(1),
  kicker: z.string().optional(),
  tile: TileSchema.optional(),
  steps: z.number().int().min(1).optional(),
};

const text = z.coerce.string();

export const StationSchema = z.strictObject({
  id: kebabId,
  at: percentPoint,
  via: z.array(percentPoint).optional(),
  year: text,
  title: z.string().min(1),
  tags: z.array(z.string()),
  summit: z.boolean().optional(),
  deepDive: kebabId.optional(),
});

export const SecretStationSchema = z.strictObject({
  at: percentPoint,
  year: text,
  title: z.string().min(1),
  tags: z.array(z.string()),
});

export const BlockSchema = z.discriminatedUnion('layout', [
  z.strictObject({
    ...common,
    layout: z.literal('hero'),
    subtitle: z.string(),
    location: z.string().optional(),
    photo: MediaSchema,
    /** Easter egg: second photo on the back of the portrait. */
    photoBack: MediaSchema.optional(),
  }),
  z.strictObject({
    ...common,
    layout: z.literal('journey'),
    image: z.string().min(1),
    imageSize: z.tuple([z.number().positive(), z.number().positive()]),
    stations: z.array(StationSchema).min(1),
    secret: SecretStationSchema.optional(),
    hide: z.array(z.string()).optional(),
    highlight: z.array(z.string()).optional(),
  }),
  z.strictObject({
    ...common,
    layout: z.literal('stack'),
    layers: z
      .array(z.strictObject({ label: z.string(), icon: z.string().optional(), items: z.array(z.string()) }))
      .min(1),
  }),
  z.strictObject({
    ...common,
    layout: z.literal('showcase'),
    media: MediaSchema,
    chips: z.array(z.string()),
    metric: z.strictObject({ value: z.string(), label: z.string() }).optional(),
  }),
  z.strictObject({
    ...common,
    layout: z.literal('gallery'),
    items: z.array(z.strictObject({ media: MediaSchema, caption: z.string() })).min(2).max(4),
  }),
  z.strictObject({
    ...common,
    layout: z.literal('closing'),
    points: z.array(z.string()).min(1),
    image: MediaSchema.optional(),
  }),
  z.strictObject({ ...common, layout: z.literal('text') }),
]);

const slideRef = z.union([
  kebabId,
  z.strictObject({ id: kebabId, children: z.array(kebabId).optional() }),
]);

export const DeckFileSchema = z.strictObject({
  id: kebabId,
  extends: kebabId.optional(),
  title: z.string().optional(),
  unlisted: z.boolean().optional(),
  durationMinutes: z.number().positive().optional(),
  company: z
    .strictObject({ name: z.string().min(1), accent: z.string().optional(), logo: z.string().optional() })
    .partial()
    .optional(),
  slides: z.array(slideRef).optional(),
  overrides: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
});

export type Media = z.infer<typeof MediaSchema>;
export type Tile = z.infer<typeof TileSchema>;
export type Block = z.infer<typeof BlockSchema>;
export type Layout = Block['layout'];
export type JourneyStation = z.infer<typeof StationSchema>;
export type SecretStation = z.infer<typeof SecretStationSchema>;
export type DeckFile = z.infer<typeof DeckFileSchema>;
export type SlideRef = z.infer<typeof slideRef>;

export type BlockOf<L extends Layout> = Extract<Block, { layout: L }>;

// ---- Build output (public/generated) -------------------------------------------------------

export type DeckIndex = Array<{ id: string; title: string; company?: string; unlisted: boolean }>;

export type ResolvedBlock = Block & { steps: number; bodyHtml: string; notesHtml: string };
export type ResolvedBlockOf<L extends Layout> = Extract<ResolvedBlock, { layout: L }>;
export type ResolvedSlide = ResolvedBlock & { children: ResolvedBlock[]; stepLinks: (number | null)[] };

export type ResolvedDeck = {
  id: string;
  title: string;
  durationMinutes: number;
  company?: { name: string; accent?: string; logo?: string };
  slides: ResolvedSlide[];
};
