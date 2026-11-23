/** Collects `media/...` paths referenced anywhere in a block (src, image, logo). */
export function mediaPaths(value: unknown, key?: string, found = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if ((key === 'src' || key === 'image' || key === 'logo') && value.startsWith('media/')) found.add(value);
  } else if (Array.isArray(value)) {
    value.forEach((v) => mediaPaths(v, key, found));
  } else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([k, v]) => mediaPaths(v, k, found));
  }
  return found;
}

const preloaded = new Set<string>();

/** Warms the browser cache so the next slide shows up without images popping in. */
export function preloadMedia(block: unknown) {
  for (const path of mediaPaths(block)) {
    if (preloaded.has(path)) continue;
    preloaded.add(path);
    new Image().src = path;
  }
}
