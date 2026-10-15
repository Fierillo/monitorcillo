import { describe, expect, it } from 'vitest';
import { updateEmisionCell, withEmisionTotals } from '../app/admin/admin-utils';
import type { EmisionAdminRow } from '@/types';

function emissionRow(overrides: Partial<EmisionAdminRow> = {}): EmisionAdminRow {
    return {
        fecha: '14 OCT 26', TOTAL: 0, CompraDolares: 10, TC: 1_000,
        BCRA: 10_000, Vencimientos: 5_500, Licitado: 4_200,
        Licitaciones: 1_300, 'Resultado fiscal': -300, ...overrides,
    };
}

describe('admin emission rollover', () => {
    it('preserves maturities for a missing, nonpositive or nonfinite rollover instead of dividing by it', () => {
        for (const percentage of ['', '-', '0', '-10', 'Infinity', 'texto']) {
            const edited = updateEmisionCell(withEmisionTotals([emissionRow()]), 0, 'Rollover', percentage);
            expect(edited[0]).toMatchObject({ Vencimientos: 5_500, Licitaciones: 1_300, TOTAL: 11_000 });
        }
    });
    it('keeps the entered percentage when adjudicated amounts change on new dates, but preserves historical maturities', () => {
        const rows = withEmisionTotals([emissionRow({ fecha: '13 OCT 26' }), emissionRow({ fecha: '15 OCT 26', Vencimientos: 0, Licitado: 0 })]);
        const withPercentage = updateEmisionCell(rows, 1, 'Rollover', '125');
        const updated = updateEmisionCell(withPercentage, 1, 'Licitado', '10.000');
        expect(updated[1]).toMatchObject({ Rollover: 125, Vencimientos: 8_000, Licitaciones: -2_000 });

        const historical = updateEmisionCell(updated, 0, 'Licitado', '11.000');
        expect(historical[0]).toMatchObject({ Vencimientos: 5_500, Rollover: 200, Licitaciones: -5_500 });
    });
    it('never recalculates maturities before the rollover start date, even when another numeric field changes', () => {
        for (const date of [{ fecha: '13 OCT 26' }, { fecha: '12 OCT 26', iso_fecha: '2026-10-12' }]) {
            const rows = withEmisionTotals([emissionRow(date)]);
            const edited = updateEmisionCell(rows, 0, 'Rollover', '150');
            expect(edited).toEqual(rows);
            expect(updateEmisionCell(rows, 0, 'TC', '2.000')[0].Vencimientos).toBe(5_500);
        }
    });
    it('calculates rounded maturities, emission and the running total from a percentage with either decimal separator', () => {
        for (const percentage of ['120,42', '120.42']) {
            const rows = [emissionRow({ fecha: '13 OCT 26', TOTAL: 11_000 }), emissionRow({ Licitado: 6_120_000 })];
            const edited = updateEmisionCell(rows, 1, 'Rollover', percentage);

            expect(edited[1]).toMatchObject({ Vencimientos: 5_082_212, Licitaciones: -1_037_788, TOTAL: -1_028_088, ACUMULADO: -1_017_088 });
            expect(edited[0]).toMatchObject(rows[0]);
            expect(rows[1].Vencimientos).toBe(5_500);
        }
    });
    it('derives the displayed rollover without recalculating stored maturities or monetary totals', () => {
        const rows = [emissionRow({ fecha: '13 OCT 26' }), emissionRow({ Vencimientos: 0, Licitado: 0, Licitaciones: 0 })];
        const loaded = withEmisionTotals(rows);

        expect(loaded[0]).toMatchObject({ Rollover: 4_200 / 5_500 * 100, Vencimientos: 5_500, TOTAL: 11_000, ACUMULADO: 11_000 });
        expect(loaded[1]).toMatchObject({ Rollover: 0, Vencimientos: 0, ACUMULADO: 20_700 });
        expect(rows[0].Vencimientos).toBe(5_500);
    });
});
