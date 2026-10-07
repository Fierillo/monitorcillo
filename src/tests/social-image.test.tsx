import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
    Cinzel: () => ({ variable: 'cinzel' }),
    Libre_Baskerville: () => ({ variable: 'baskerville' }),
}));
vi.mock('@vercel/analytics/next', () => ({ Analytics: () => null }));

import { metadata } from '../app/layout';

it('shares the same static PNG on Open Graph and Twitter', () => {
    const images = metadata.openGraph?.images as string[];
    const twitterImages = metadata.twitter?.images as string[];
    expect(twitterImages).toEqual(images);
    expect(images).toHaveLength(1);
    expect(images[0]).toMatch(/^\/[^?]+\.png$/);
    const image = PNG.sync.read(readFileSync(join(process.cwd(), 'public', images[0])));
    expect([image.width, image.height]).toEqual([1200, 630]);
});
