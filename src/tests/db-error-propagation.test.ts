import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));
const bcra = vi.hoisted(() => ({ fetchEmisionRaw: vi.fn() }));

vi.mock('../lib/db/client', () => ({ sql: database }));
vi.mock('@/lib/sync/bcra', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/sync/bcra')>()),
    fetchEmisionRaw: bcra.fetchEmisionRaw,
}));

function postgresError(code: string, message: string): Error {
    return Object.assign(new Error(message), { code });
}

const MISSING_TABLE = () => postgresError('42P01', 'relation "icg_raw" does not exist');
const MISSING_COLUMN = () => postgresError('42703', 'column "icg" does not exist');
const CONNECTION_LOST = () => postgresError('ECONNREFUSED', 'connect ECONNREFUSED 10.0.0.1:5432');

describe('database read failures', () => {
    beforeEach(() => {
        database.query.mockReset();
        bcra.fetchEmisionRaw.mockReset();
    });

    it('reports an absent table as an empty series', async () => {
        database.query.mockRejectedValue(MISSING_TABLE());
        const { getRawData, getRawDataByDate, getLatestRawDate } = await import('../lib/db/raw');

        await expect(getRawData('icg')).resolves.toEqual([]);
        await expect(getRawDataByDate('icg', '2026-01-01')).resolves.toBeNull();
        await expect(getLatestRawDate('icg', ['icg'])).resolves.toBeNull();
    });

    it('reports an absent column as an unknown latest date', async () => {
        database.query.mockRejectedValue(MISSING_COLUMN());
        const { getLatestRawDate } = await import('../lib/db/raw');

        await expect(getLatestRawDate('icg', ['icg'])).resolves.toBeNull();
    });

    it('propagates a lost connection instead of reporting an empty raw series', async () => {
        database.query.mockRejectedValue(CONNECTION_LOST());
        const { getRawData, getRawDataByDate, getLatestRawDate } = await import('../lib/db/raw');

        await expect(getRawData('icg')).rejects.toThrow('ECONNREFUSED');
        await expect(getRawDataByDate('icg', '2026-01-01')).rejects.toThrow('ECONNREFUSED');
        await expect(getLatestRawDate('icg', ['icg'])).rejects.toThrow('ECONNREFUSED');
    });

    it('propagates a lost connection instead of reporting missing normalized data', async () => {
        database.query.mockRejectedValue(CONNECTION_LOST());
        const { getNormalizedData, getNormalizedDataByDate, getLatestNormalizedData } = await import('../lib/db/normalized');

        await expect(getNormalizedData('icg')).rejects.toThrow('ECONNREFUSED');
        await expect(getNormalizedDataByDate('icg', '2026-01-01')).rejects.toThrow('ECONNREFUSED');
        await expect(getLatestNormalizedData('icg', 'icg')).rejects.toThrow('ECONNREFUSED');
    });

    it('propagates a lost connection instead of reporting an empty catalog', async () => {
        database.query.mockRejectedValue(CONNECTION_LOST());
        const { getIndicatorsCatalog } = await import('../lib/db/catalog');

        await expect(getIndicatorsCatalog()).rejects.toThrow('ECONNREFUSED');
    });

    it('stops the emision sync before it can overwrite manually entered values', async () => {
        database.query.mockRejectedValue(CONNECTION_LOST());
        bcra.fetchEmisionRaw.mockResolvedValue({
            compraData: [{ fecha: '2026-01-07', valor: 12 }],
            tcData: [{ fecha: '2026-01-07', valor: 1_000 }],
        });
        const { syncEmision } = await import('../lib/sync/tasks');

        await expect(syncEmision()).rejects.toThrow('ECONNREFUSED');

        const statements = database.query.mock.calls.map(([statement]) => statement).join(' ');
        expect(statements).not.toContain('INSERT');
    });
});
