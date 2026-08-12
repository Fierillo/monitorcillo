import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ fetchTextFromUrl: vi.fn() }));

vi.mock('@/lib/sync/http-client', () => ({ fetchTextFromUrl: mocks.fetchTextFromUrl }));

describe('time series client', () => {
    beforeEach(() => {
        vi.resetModules();
        mocks.fetchTextFromUrl.mockReset();
    });

    it('builds encoded single and multi-series URLs', async () => {
        const { buildTimeSeriesUrl } = await import('@/lib/sync/time-series-client');
        const url = new URL(buildTimeSeriesUrl({ ids: ['ipc', 'emae'], limit: 100 }));

        expect(url.origin + url.pathname).toBe('https://apis.datos.gob.ar/series/api/series/');
        expect(url.searchParams.get('ids')).toBe('ipc,emae');
        expect(url.searchParams.get('format')).toBe('json');
        expect(url.searchParams.get('limit')).toBe('100');
    });

    it('validates options and response rows', async () => {
        const { buildTimeSeriesUrl, parseTimeSeriesResponse } = await import('@/lib/sync/time-series-client');

        expect(() => buildTimeSeriesUrl({ ids: [] })).toThrow('Provide at least one valid series ID');
        expect(() => buildTimeSeriesUrl({ ids: ['ipc'], limit: 0 })).toThrow('Limit must be a positive integer');
        expect(parseTimeSeriesResponse({ data: [['2026-01-01', 100, null]] }, ['ipc', 'emae']).data).toHaveLength(1);
        expect(() => parseTimeSeriesResponse({ data: [['2026-01-01', 100]] }, ['ipc', 'emae'])).toThrow('Expected a date and 2 value column(s)');
    });

    it('deduplicates equal requests during the process', async () => {
        mocks.fetchTextFromUrl.mockResolvedValue(JSON.stringify({ data: [['2026-01-01', 100]] }));
        const { fetchTimeSeries } = await import('@/lib/sync/time-series-client');

        const [first, second] = await Promise.all([
            fetchTimeSeries({ ids: ['ipc'] }),
            fetchTimeSeries({ ids: ['ipc'] }),
        ]);

        expect(first).toEqual(second);
        expect(mocks.fetchTextFromUrl).toHaveBeenCalledOnce();
    });

    it('does not cache failed requests', async () => {
        mocks.fetchTextFromUrl
            .mockRejectedValueOnce(new Error('network error'))
            .mockResolvedValueOnce(JSON.stringify({ data: [['2026-01-01', 100]] }));
        const { fetchTimeSeries } = await import('@/lib/sync/time-series-client');

        await expect(fetchTimeSeries({ ids: ['ipc'] })).rejects.toThrow('Failed to fetch time series ipc. network error');
        await expect(fetchTimeSeries({ ids: ['ipc'] })).resolves.toEqual({ data: [['2026-01-01', 100]] });
        expect(mocks.fetchTextFromUrl).toHaveBeenCalledTimes(2);
    });
});
