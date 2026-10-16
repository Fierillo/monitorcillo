import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    fetchTimeSeries: vi.fn(),
    fetchBufferFromUrl: vi.fn(),
    fetchTextFromUrl: vi.fn(),
}));

vi.mock('@/lib/sync/time-series-client', () => ({ fetchTimeSeries: mocks.fetchTimeSeries }));
vi.mock('@/lib/sync/http-client', () => ({
    fetchBufferFromUrl: mocks.fetchBufferFromUrl,
    fetchTextFromUrl: mocks.fetchTextFromUrl,
}));
vi.mock('next/cache', () => ({
    unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { fetchInflacionRawReport } from '../lib/inflacion-source';

describe('fetchInflacionRawReport IPIM', () => {
    beforeEach(() => {
        mocks.fetchTimeSeries.mockReset();
        mocks.fetchBufferFromUrl.mockReset();
        mocks.fetchTextFromUrl.mockReset();
        mocks.fetchBufferFromUrl.mockRejectedValue(new Error('workbook unavailable'));
        mocks.fetchTextFromUrl.mockRejectedValue(new Error('http unavailable'));
        mocks.fetchTimeSeries.mockImplementation(async ({ ids }: { ids: string[] }) => {
            const seriesId = ids[0] ?? '';
            if (seriesId.includes('INGNAC') || seriesId.includes('INUCLEO')) {
                return { data: [['2026-01-01', 100], ['2026-02-01', 102]] };
            }
            return { data: [['2026-01-01', 100], ['2026-02-01', 101.7]] };
        });
    });

    it('merges IPIM index levels into raw rows', async () => {
        const { rows } = await fetchInflacionRawReport();
        expect(rows.find(row => row.fecha === '2026-01-01')?.ipim).toBe(100);
        expect(rows.find(row => row.fecha === '2026-02-01')?.ipim).toBe(101.7);
    });
});
