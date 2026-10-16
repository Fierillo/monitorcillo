import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
    query: vi.fn((text: string, values?: unknown[]) => ({ text, values })),
    transaction: vi.fn(async (queries: unknown[]) => queries),
}));

vi.mock('../lib/db/client', () => ({ sql: database }));

import { replaceNormalizedData } from '../lib/db/normalized';
import { ensureEmaeSectorTables } from '../lib/sync/emae';
import { normalizeEmae } from '../lib/normalize/emae';
import { EMAE_SECTOR_APORTE_KEYS, EMAE_SECTOR_KEYS, EMAE_SECTOR_MM12_KEYS } from '../lib/emae/schema';

describe('replaceNormalizedData', () => {
    beforeEach(() => {
        database.query.mockClear();
        database.transaction.mockClear();
    });

    it('prepares each EMAE column only once across sync setup and normalized persistence', async () => {
        await ensureEmaeSectorTables();
        await replaceNormalizedData('emae', normalizeEmae([
            { fecha: '2017-01-01', emae: 100, emae_desestacionalizado: 100, poblacion: 40_000_000 },
        ]));

        const queries = database.query.mock.calls.map(([text]) => text);
        for (const column of ['poblacion', ...EMAE_SECTOR_KEYS]) {
            expect(queries.filter(text => text === `ALTER TABLE emae_raw ADD COLUMN IF NOT EXISTS ${column} NUMERIC`)).toHaveLength(1);
        }
        for (const column of ['emae_per_capita', ...EMAE_SECTOR_MM12_KEYS, ...EMAE_SECTOR_APORTE_KEYS]) {
            expect(queries.filter(text => text === `ALTER TABLE emae_normalized ADD COLUMN IF NOT EXISTS ${column} NUMERIC`)).toHaveLength(1);
        }
        expect(database.transaction).toHaveBeenCalledOnce();
    });

    it('prepares EMAE normalized columns without requiring sync setup', async () => {
        await replaceNormalizedData('emae', normalizeEmae([
            { fecha: '2017-01-01', emae: 100, emae_desestacionalizado: 100, poblacion: 40_000_000 },
        ]));

        const queries = database.query.mock.calls.map(([text]) => text);
        expect(queries).toContain('ALTER TABLE emae_normalized ADD COLUMN IF NOT EXISTS emae_per_capita NUMERIC');
        expect(queries.some(text => text.startsWith('ALTER TABLE emae_raw'))).toBe(false);
        expect(database.transaction).toHaveBeenCalledOnce();
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
