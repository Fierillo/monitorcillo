import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
    query: vi.fn((text: string, values?: unknown[]) => ({ text, values })),
    transaction: vi.fn(async (queries: unknown[]) => queries),
}));

vi.mock('../lib/db/client', () => ({ sql: database }));

import { replaceNormalizedData } from '../lib/db/normalized';

describe('replaceNormalizedData', () => {
    beforeEach(() => {
        database.query.mockClear();
        database.transaction.mockClear();
    });

    it('replaces normalized rows inside one locked transaction', async () => {
        await replaceNormalizedData('emision', [{
            fecha: '2 ENE 26',
            iso_fecha: '2026-01-02',
            BCRA: 2_000,
            BCRA_POS: 2_000,
            BCRA_NEG: null,
            TC: 1_000,
            CompraDolares: 2,
            Vencimientos: 0,
            Licitado: 0,
            Licitaciones: 0,
            Licitaciones_POS: null,
            Licitaciones_NEG: null,
            'Resultado fiscal': 0,
            ResultadoFiscal_POS: null,
            ResultadoFiscal_NEG: null,
            TOTAL: 2_000,
            ACUMULADO: 2_000,
        }]);

        expect(database.transaction).toHaveBeenCalledOnce();
        const queries = database.transaction.mock.calls[0][0] as Array<{ text: string }>;
        expect(queries.map(query => query.text)).toEqual([
            'SELECT pg_advisory_xact_lock(hashtext($1))',
            'DELETE FROM emision_normalized',
            expect.stringContaining('INSERT INTO emision_normalized'),
        ]);
    });
});
