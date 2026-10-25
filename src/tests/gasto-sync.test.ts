import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/client', () => ({ sql: { query: vi.fn() } }));
vi.mock('@/lib/public-spending-source', () => ({ fetchPublicSpendingChartRows: vi.fn() }));

const partial = { fecha: '2026', nationPartial: 15.22, provincesPartial: 14.9, municipalitiesPartial: 2.975, interestPartial: 1.85, totalPartial: 34.945, partial: true, partialAsOf: '2026-10-21', partialQuarters: 2, partialBridgeYear: 2024 };

describe('fetchGastoRaw', () => {
    it('returns the MECON rows as raw rows when they reach the current year', async () => {
        const { fetchGastoRaw } = await import('@/lib/sync/gasto');
        const rows = await fetchGastoRaw('2026-10-24', [{ name: 'MECON', run: async () => [partial] }]);
        expect(rows.map(row => [row.fecha, row.kind, row.total])).toEqual([['2026-01-01', 'partial', 34.945]]);
    });

    it('warns instead of failing when every source fails, so stored rows stay', async () => {
        const { fetchGastoRaw } = await import('@/lib/sync/gasto');
        const warn = vi.fn();
        await expect(fetchGastoRaw('2026-10-24', [{ name: 'MECON', run: async () => { throw new Error('HTTP 503'); } }], warn)).resolves.toEqual([]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('HTTP 503'));
    });
});

vi.mock('@/lib/db', () => ({ getRawData: vi.fn(), saveRawData: vi.fn(), replaceNormalizedData: vi.fn(), saveIndicatorPublication: vi.fn(), saveIndicatorsCatalog: vi.fn() }));

describe('syncGasto', () => {
    it('upserts a changed partial year as a full row, so NOT NULL kind is always sent', async () => {
        const db = await import('@/lib/db');
        const source = await import('@/lib/public-spending-source');
        const stored = { fecha: '2026-01-01', nation: 15, provinces: 14.9, municipalities: 2.975, interest: 1.85, total: 34.7, kind: 'partial', as_of: '2026-09-30', partial_quarters: 2, bridge_year: 2024 };
        vi.mocked(db.getRawData).mockResolvedValue([stored] as never);
        vi.mocked(source.fetchPublicSpendingChartRows).mockResolvedValue([partial]);
        const { syncGasto } = await import('@/lib/sync/tasks');

        await syncGasto();

        expect(db.saveRawData).toHaveBeenCalledWith('gasto', [expect.objectContaining({ fecha: '2026-01-01', kind: 'partial', nation: 15.22, as_of: '2026-10-21', total: 34.945 })]);
        expect(db.saveIndicatorPublication).toHaveBeenCalledWith('gasto-publico', '2026-10-21', '2026-01-01');
    });
});
