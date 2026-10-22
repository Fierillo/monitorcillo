import { describe, expect, it } from 'vitest';
import { buildEmissionRows } from '../lib/sync/bcra';

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
