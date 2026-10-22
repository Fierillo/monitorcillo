import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));
vi.mock('../lib/db/client', () => ({ sql: database }));

import { getDeudaVencimientos, replaceDeudaVencimientos } from '../lib/db/deuda';

const FUENTE = 'https://www.argentina.gob.ar/sites/default/files/deuda_publica_30-06-2026_0.xlsx';

beforeEach(() => {
    database.query.mockReset();
    database.transaction.mockReset();
    database.query.mockResolvedValue([]);
    database.transaction.mockImplementation(async (queries: Array<Promise<unknown>>) => Promise.all(queries));
});

describe('deuda vencimientos', () => {
    it('replaces the stored profile with the latest workbook in one transaction', async () => {
        await replaceDeudaVencimientos({
            anuales: [{ periodo: '2026', capital_usd: 80717.06, interes_usd: 5432.72 }, { periodo: '2036-2089', capital_usd: 43013.47, interes_usd: 9034.17 }],
            proximos12m: { capital_usd: 137211.79, interes_usd: 10717.9 },
        }, '2026-06-30', FUENTE);
        const calls = database.query.mock.calls.map(([query, params]) => ({ query: String(query), params }));
        expect(calls.some(call => call.query.includes('CREATE TABLE IF NOT EXISTS deuda_vencimientos'))).toBe(true);
        expect(calls.some(call => call.query.includes('DELETE FROM deuda_vencimientos'))).toBe(true);
        const inserts = calls.filter(call => call.query.includes('INSERT INTO deuda_vencimientos'));
        expect(inserts.map(call => call.params)).toEqual([
            ['2026', 80717.06, 5432.72, '2026-06-30', FUENTE],
            ['2036-2089', 43013.47, 9034.17, '2026-06-30', FUENTE],
            ['proximos-12m', 137211.79, 10717.9, '2026-06-30', FUENTE],
        ]);
        expect(database.transaction).toHaveBeenCalledOnce();
    });

    it('reads the annual profile and the next 12 months apart', async () => {
        database.query.mockResolvedValueOnce([
            { periodo: '2026', capital_usd: '80717.06', interes_usd: '5432.72', corte: '2026-06-30', fuente_url: FUENTE },
            { periodo: '2027', capital_usd: '90128.26', interes_usd: '10438.59', corte: '2026-06-30', fuente_url: FUENTE },
            { periodo: 'proximos-12m', capital_usd: '137211.79', interes_usd: '10717.9', corte: '2026-06-30', fuente_url: FUENTE },
        ]);
        await expect(getDeudaVencimientos()).resolves.toEqual({
            corte: '2026-06-30',
            fuenteUrl: FUENTE,
            anuales: [{ periodo: '2026', capital: 80717.06, interes: 5432.72 }, { periodo: '2027', capital: 90128.26, interes: 10438.59 }],
            proximos12m: { capital: 137211.79, interes: 10717.9 },
        });
    });

    it('is null when nothing is stored', async () => {
        await expect(getDeudaVencimientos()).resolves.toBeNull();
    });
});
