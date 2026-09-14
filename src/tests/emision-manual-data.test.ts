import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
    getRawData: vi.fn(),
    saveRawData: vi.fn(),
    replaceNormalizedData: vi.fn(),
    saveIndicatorPublication: vi.fn(),
    saveIndicatorsCatalog: vi.fn(),
}));

const bcra = vi.hoisted(() => ({ fetchEmisionRaw: vi.fn() }));

vi.mock('@/lib/db/client', () => ({ sql: { query: vi.fn(), transaction: vi.fn() } }));
vi.mock('@/lib/db', () => db);
vi.mock('@/lib/sync/bcra', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/sync/bcra')>()),
    fetchEmisionRaw: bcra.fetchEmisionRaw,
}));

const MANUALLY_EDITED_ROW = {
    fecha: '2026-01-07',
    compra_dolares: 10,
    tc: 1_000,
    bcra: 10_000,
    vencimientos: 5_500,
    licitado: 4_200,
    resultado_fiscal: -1_300,
};

function bcraResponse(compra: number, tc: number) {
    return {
        compraData: [{ fecha: '2026-01-07', valor: compra }],
        tcData: [{ fecha: '2026-01-07', valor: tc }],
    };
}

describe('manually entered emision data', () => {
    beforeEach(() => {
        vi.resetModules();
        [...Object.values(db), ...Object.values(bcra)].forEach(mock => mock.mockReset());
        db.getRawData.mockResolvedValue([MANUALLY_EDITED_ROW]);
    });

    it('is never included in the rows a sync writes back for an existing date', async () => {
        bcra.fetchEmisionRaw.mockResolvedValue(bcraResponse(12, 1_000));
        const { syncEmision } = await import('@/lib/sync/tasks');

        await syncEmision();

        expect(db.saveRawData).toHaveBeenCalledWith('emision', [
            { fecha: '2026-01-07', compra_dolares: 12, tc: 1_000, bcra: 12_000 },
        ]);
        const [, writtenRows] = db.saveRawData.mock.calls[0];
        for (const row of writtenRows) {
            expect(Object.keys(row)).not.toContain('vencimientos');
            expect(Object.keys(row)).not.toContain('licitado');
            expect(Object.keys(row)).not.toContain('resultado_fiscal');
        }
    });

    it('is left untouched when the BCRA values did not change', async () => {
        bcra.fetchEmisionRaw.mockResolvedValue(bcraResponse(10, 1_000));
        const { syncEmision } = await import('@/lib/sync/tasks');

        await syncEmision();

        expect(db.saveRawData).not.toHaveBeenCalled();
    });

    it('is not reset to zero when the stored history cannot be read', async () => {
        db.getRawData.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));
        bcra.fetchEmisionRaw.mockResolvedValue(bcraResponse(12, 1_000));
        const { syncEmision } = await import('@/lib/sync/tasks');

        await expect(syncEmision()).rejects.toThrow('ECONNREFUSED');
        expect(db.saveRawData).not.toHaveBeenCalled();
        expect(db.replaceNormalizedData).not.toHaveBeenCalled();
    });

    it('starts at zero only for a date that was never stored', async () => {
        db.getRawData.mockResolvedValue([]);
        bcra.fetchEmisionRaw.mockResolvedValue(bcraResponse(12, 1_000));
        const { syncEmision } = await import('@/lib/sync/tasks');

        await syncEmision();

        expect(db.saveRawData).toHaveBeenCalledWith('emision', [
            { fecha: '2026-01-07', compra_dolares: 12, tc: 1_000, bcra: 12_000, vencimientos: 0, licitado: 0, resultado_fiscal: 0 },
        ]);
    });
});
