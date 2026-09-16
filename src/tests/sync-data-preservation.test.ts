import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
    getRawData: vi.fn(),
    saveRawData: vi.fn(),
    replaceRawData: vi.fn(),
    replaceNormalizedData: vi.fn(),
    saveIndicatorPublication: vi.fn(),
    saveIndicatorsCatalog: vi.fn(),
}));

const icgSource = vi.hoisted(() => ({
    ensureIcgTables: vi.fn(),
    fetchIcgRawReport: vi.fn(),
}));

const sipaSource = vi.hoisted(() => ({
    ensureSipaTables: vi.fn(),
    fetchSipaRawReport: vi.fn(),
}));

const bmaSource = vi.hoisted(() => ({ fetchBmaRaw: vi.fn() }));

vi.mock('@/lib/db/client', () => ({ sql: { query: vi.fn(), transaction: vi.fn() } }));
vi.mock('@/lib/db', () => db);
vi.mock('@/lib/sync/icg', () => icgSource);
vi.mock('@/lib/sync/sipa', () => sipaSource);
vi.mock('@/lib/sync/bma', () => bmaSource);

const STORED_ICG_HISTORY = [
    { fecha: '2025-10-01', icg: 2.41 },
    { fecha: '2025-11-01', icg: 2.35 },
    { fecha: '2025-12-01', icg: 2.29 },
];

const STORED_SIPA_HISTORY = [
    {
        fecha: '2026-04-01',
        privado: 6141.4,
        publico: 3385.7,
        casas_particulares: 444.5,
        autonomos: 394.7,
        monotributo: 2198.1,
        monotributo_social: 236.7,
        total: 12801,
        provisional: true,
    },
    {
        fecha: '2026-05-01',
        privado: 6132.6,
        publico: 3385.1,
        casas_particulares: 445,
        autonomos: 391.7,
        monotributo: 2202.4,
        monotributo_social: 232.1,
        total: 12789,
        provisional: true,
    },
];

function expectNoSeriesWrites() {
    expect(db.saveRawData).not.toHaveBeenCalled();
    expect(db.replaceRawData).not.toHaveBeenCalled();
    expect(db.replaceNormalizedData).not.toHaveBeenCalled();
}

describe('sync data preservation', () => {
    beforeEach(() => {
        vi.resetModules();
        [...Object.values(db), ...Object.values(icgSource), ...Object.values(sipaSource), ...Object.values(bmaSource)].forEach(mock => mock.mockReset());
        db.getRawData.mockResolvedValue(STORED_ICG_HISTORY);
    });

    it('writes nothing when the source returns no observations', async () => {
        icgSource.fetchIcgRawReport.mockResolvedValue({ rows: [], publishedAt: '2026-01-05' });
        const { syncIcg } = await import('@/lib/sync/tasks');

        await expect(syncIcg()).resolves.toEqual({ appended: 0, total: 3 });
        expectNoSeriesWrites();
        expect(db.saveIndicatorPublication).not.toHaveBeenCalled();
    });

    it('refreshes the publication date without rewriting an unchanged series', async () => {
        icgSource.fetchIcgRawReport.mockResolvedValue({ rows: STORED_ICG_HISTORY, publishedAt: '2026-01-05' });
        const { syncIcg } = await import('@/lib/sync/tasks');

        await expect(syncIcg()).resolves.toEqual({ appended: 0, total: 3 });
        expectNoSeriesWrites();
        expect(db.saveIndicatorPublication).toHaveBeenCalledWith('icg', '2026-01-05', '2025-12-01');
    });

    it('upserts only the new dates and rebuilds normalized data from the full stored history', async () => {
        const persistedAfterUpsert = [...STORED_ICG_HISTORY, { fecha: '2026-01-01', icg: 2.5 }];
        db.getRawData
            .mockResolvedValueOnce(STORED_ICG_HISTORY)
            .mockResolvedValueOnce(persistedAfterUpsert);
        icgSource.fetchIcgRawReport.mockResolvedValue({
            rows: [{ fecha: '2025-12-01', icg: 2.29 }, { fecha: '2026-01-01', icg: 2.5 }],
            publishedAt: '2026-01-05',
        });
        const { syncIcg } = await import('@/lib/sync/tasks');

        await expect(syncIcg()).resolves.toEqual({ appended: 1, total: 4 });

        expect(db.replaceRawData).not.toHaveBeenCalled();
        expect(db.saveRawData).toHaveBeenCalledWith('icg', [{ fecha: '2026-01-01', icg: 2.5 }]);
        expect(db.replaceNormalizedData.mock.calls[0][1].map((row: { iso_fecha: string }) => row.iso_fecha)).toEqual([
            '2025-10-01',
            '2025-11-01',
            '2025-12-01',
            '2026-01-01',
        ]);
        expect(db.saveIndicatorPublication).toHaveBeenCalledWith('icg', '2026-01-05', '2026-01-01');
    });

    it('propagates a source failure without touching the database', async () => {
        icgSource.fetchIcgRawReport.mockRejectedValue(new Error('UTDT is unreachable'));
        const { syncIcg } = await import('@/lib/sync/tasks');

        await expect(syncIcg()).rejects.toThrow('UTDT is unreachable');
        expectNoSeriesWrites();
        expect(db.saveIndicatorPublication).not.toHaveBeenCalled();
    });

    it('aborts without writing when the stored history cannot be read', async () => {
        db.getRawData.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));
        icgSource.fetchIcgRawReport.mockResolvedValue({ rows: [{ fecha: '2026-01-01', icg: 2.5 }], publishedAt: '2026-01-05' });
        const { syncIcg } = await import('@/lib/sync/tasks');

        await expect(syncIcg()).rejects.toThrow('ECONNREFUSED');
        expectNoSeriesWrites();
    });

    it('upserts only the new SIPA dates and rebuilds normalized modality totals from stored history', async () => {
        const persistedAfterUpsert = [
            ...STORED_SIPA_HISTORY,
            {
                fecha: '2026-06-01',
                privado: 6126.4,
                publico: 3380,
                casas_particulares: 444.1,
                autonomos: 388.9,
                monotributo: 2206.8,
                monotributo_social: 227.3,
                total: 12773.4,
                provisional: true,
            },
        ];
        db.getRawData
            .mockResolvedValueOnce(STORED_SIPA_HISTORY)
            .mockResolvedValueOnce(persistedAfterUpsert);
        sipaSource.fetchSipaRawReport.mockResolvedValue({
            rows: [STORED_SIPA_HISTORY[1], persistedAfterUpsert[2]],
            publishedAt: '2026-07-10',
        });
        const { syncSipa } = await import('@/lib/sync/tasks');

        await expect(syncSipa()).resolves.toEqual({ appended: 1, total: 3 });

        expect(db.replaceRawData).not.toHaveBeenCalled();
        expect(db.saveRawData).toHaveBeenCalledWith('sipa', [persistedAfterUpsert[2]]);
        expect(db.replaceNormalizedData.mock.calls[0][1].map((row: { iso_fecha: string; total: number | null }) => ({
            iso_fecha: row.iso_fecha,
            total: row.total,
        }))).toEqual([
            { iso_fecha: '2026-04-01', total: 12801 },
            { iso_fecha: '2026-05-01', total: 12789 },
            { iso_fecha: '2026-06-01', total: 12773.4 },
        ]);
        expect(db.saveIndicatorPublication).toHaveBeenCalledWith('sipa', '2026-07-10', '2026-06-01');
    });

    it('keeps the stored series when a full-replacement source returns nothing', async () => {
        db.getRawData.mockResolvedValue([{ fecha: '2025-12-01', base_monetaria: 30 }]);
        bmaSource.fetchBmaRaw.mockResolvedValue([]);
        const { syncBma } = await import('@/lib/sync/tasks');

        await expect(syncBma()).resolves.toEqual({ appended: 0, total: 1 });
        expectNoSeriesWrites();
    });

    it('keeps stored dates that a full refetch no longer reports', async () => {
        const stored = [
            { fecha: '2025-11-03', base_monetaria: 28, ipc_nucleo: 100, pbi_trimestral: 200 },
            { fecha: '2025-12-01', base_monetaria: 30, ipc_nucleo: 100, pbi_trimestral: 200 },
        ];
        const refetched = [
            { fecha: '2025-12-01', base_monetaria: 31, ipc_nucleo: 100, pbi_trimestral: 200 },
            { fecha: '2026-01-02', base_monetaria: 33, ipc_nucleo: 100, pbi_trimestral: 200 },
        ];
        db.getRawData
            .mockResolvedValueOnce(stored)
            .mockResolvedValueOnce([stored[0], ...refetched]);
        bmaSource.fetchBmaRaw.mockResolvedValue(refetched);
        const { syncBma } = await import('@/lib/sync/tasks');

        await expect(syncBma()).resolves.toEqual({ appended: 1, total: 3 });

        expect(db.replaceRawData).not.toHaveBeenCalled();
        expect(db.saveRawData).toHaveBeenCalledWith('bma', [
            { fecha: '2025-12-01', base_monetaria: 31 },
            refetched[1],
        ]);
        expect(db.replaceNormalizedData.mock.calls[0][1].map((row: { iso_fecha: string }) => row.iso_fecha)).toEqual([
            '2025-11-01',
            '2025-12-01',
            '2026-01-01',
        ]);
    });
});
