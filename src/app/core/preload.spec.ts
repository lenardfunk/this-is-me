import { mediaPaths } from './preload';

describe('mediaPaths', () => {
  it('finds media references in nested block data', () => {
    const block = {
      image: 'media/a.jpg',
      title: 'media/not-a-key.jpg',
      tile: { image: 'media/tile.svg' },
      items: [{ media: { type: 'image', src: 'media/b.jpg' } }, { media: { type: 'component', name: 'x' } }],
      photo: { src: 'https://example.com/x.jpg' },
    };
    expect([...mediaPaths(block)].sort()).toEqual(['media/a.jpg', 'media/b.jpg', 'media/tile.svg']);
  });
});
