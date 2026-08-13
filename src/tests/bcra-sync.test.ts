import { describe, expect, it } from 'vitest';
import { buildEmissionRows, sampleMonthlyBalanceDates } from '../lib/sync/bcra';

describe('buildEmissionRows', () => {
    it('combines purchases with exchange rates', () => {
        expect(buildEmissionRows(
            [{ fecha: '2026-01-02', valor: 2 }],
            [{ fecha: '2026-01-02', valor: 1_000 }],
        )).toEqual([{ fecha: '2026-01-02', compra_dolares: 2, tc: 1_000, bcra: 2_000 }]);
    });

    it('rejects a partial exchange-rate response before persistence', () => {
        expect(() => buildEmissionRows(
            [{ fecha: '2026-01-02', valor: 2 }],
            [],
        )).toThrow('BCRA variable 4 returned no exchange rates');
    });

    it('rejects purchases without a matching exchange rate', () => {
        expect(() => buildEmissionRows(
            [{ fecha: '2026-01-02', valor: 2 }],
            [{ fecha: '2026-01-03', valor: 1_000 }],
        )).toThrow('Missing BCRA exchange rates for 2026-01-02');
    });
});

describe('sampleMonthlyBalanceDates', () => {
    it('keeps balances at the four historical monthly cutoffs', () => {
        const rows = Array.from({ length: 31 }, (_, index) => ({
            fecha: `2026-07-${String(index + 1).padStart(2, '0')}`,
            valor: index + 1,
        }));

        expect(sampleMonthlyBalanceDates(rows).map(row => row.fecha)).toEqual([
            '2026-07-07',
            '2026-07-15',
            '2026-07-23',
            '2026-07-31',
        ]);
    });

    it('uses the preceding business day and omits future cutoffs', () => {
        const rows = [
            { fecha: '2026-08-06', valor: 1 },
            { fecha: '2026-08-07', valor: 2 },
            { fecha: '2026-08-10', valor: 3 },
        ];

        expect(sampleMonthlyBalanceDates(rows)).toEqual([{ fecha: '2026-08-07', valor: 2 }]);
    });

    it('keeps the cutoff date when its balance comes from a preceding business day', () => {
        const rows = [
            { fecha: '2026-05-21', valor: 1 },
            { fecha: '2026-05-22', valor: 2 },
            { fecha: '2026-05-25', valor: 3 },
        ];

        expect(sampleMonthlyBalanceDates(rows).at(-1)).toEqual({ fecha: '2026-05-23', valor: 2 });
    });
});
