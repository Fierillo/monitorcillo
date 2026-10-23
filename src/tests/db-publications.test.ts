import { beforeEach, describe, expect, it, vi } from 'vitest';

const sql = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/lib/db/client', () => ({ sql }));

import { getUpcomingPublicationDate } from '../lib/db/catalog';

describe('getUpcomingPublicationDate', () => {
    beforeEach(() => { sql.query.mockReset(); });

    it('shows the following official release once the stored next one has passed', async () => {
        sql.query.mockImplementation(async (text: string) => text.includes('SELECT')
            ? [{ id: 'tesoro-licitacion', published_at: '2026-10-28' }, { id: 'tesoro-licitacion#2', published_at: '2026-11-11' }, { id: 'tesoro-licitacion#3', published_at: '2026-11-26' }]
            : []);

        expect(await getUpcomingPublicationDate('tesoro-licitacion', '2026-10-27')).toBe('2026-10-28');
        expect(await getUpcomingPublicationDate('tesoro-licitacion', '2026-10-29')).toBe('2026-11-11');
    });

    it('keeps a past publication date of a source without upcoming dates', async () => {
        sql.query.mockImplementation(async (text: string) => text.includes('SELECT') ? [{ id: 'deuda-boletin', published_at: '2026-10-15' }] : []);

        expect(await getUpcomingPublicationDate('deuda-boletin', '2026-10-23')).toBe('2026-10-15');
    });
});
