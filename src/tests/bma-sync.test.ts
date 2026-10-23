import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/sync/bcra', () => ({
    fetchBcraVariable: vi.fn(async (id: number) => id === 1264 ? [{ fecha: '2026-10-15', valor: 1 }, { fecha: '2026-10-16', valor: 2 }, { fecha: '2026-10-19', valor: 3 }] : []),
}));
vi.mock('@/lib/sync/cache', () => ({ fetchPbiAnchorRows: vi.fn(async () => []), fetchEmaeWorkbookRows: vi.fn(async () => []), fetchIpcNucleoSeries: vi.fn(async () => ({ data: [] })) }));
vi.mock('@/lib/sync/time-series-client', () => ({ fetchTimeSeries: vi.fn(async () => ({ data: [] })) }));

describe('fetchBmaRaw', () => {
    it('stores the BCRA government deposits (var 1264) on every business day it is published, unsampled', async () => {
        const { fetchBmaRaw } = await import('@/lib/sync/bma');
        const rows = await fetchBmaRaw();
        expect(rows.filter(row => row.depositos_tesoro != null).map(row => [row.fecha, row.depositos_tesoro])).toEqual([['2026-10-15', 1], ['2026-10-16', 2], ['2026-10-19', 3]]);
    });
});
