import { describe, expect, it } from 'vitest';
import { planEmisionRawUpserts } from './emision-plan';

const apiRow = {
    fecha: '2026-03-02',
    compra_dolares: 2,
    tc: 1_000,
    bcra: 2_000,
};

describe('emission sync plan', () => {
    it('creates a new day with manual fields at zero', () => {
        const plan = planEmisionRawUpserts([], [apiRow]);

        expect(plan.appended).toBe(1);
        expect(plan.upserts).toEqual([{
            ...apiRow,
            vencimientos: 0,
            licitado: 0,
            resultado_fiscal: 0,
        }]);
    });

    it('does not write again when the BCRA figures are unchanged', () => {
        const plan = planEmisionRawUpserts([{
            fecha: '2 MAR 26',
            compra_dolares: 2,
            tc: 1_000,
            bcra: 2_000,
            vencimientos: 40,
            licitado: 90,
            resultado_fiscal: -15,
        }], [apiRow]);

        expect(plan).toEqual({ upserts: [], appended: 0 });
    });

    it('patches only the API fields and keeps the treasury figures', () => {
        const plan = planEmisionRawUpserts([{
            fecha: '2026-03-02',
            compra_dolares: 1,
            tc: 900,
            bcra: 900,
            vencimientos: 40,
            licitado: 90,
            resultado_fiscal: -15,
        }], [apiRow]);

        expect(plan.appended).toBe(0);
        expect(plan.upserts).toEqual([{
            fecha: '2026-03-02',
            compra_dolares: 2,
            tc: 1_000,
            bcra: 2_000,
        }]);
    });

    it('does not count a Spanish stored date as a second row', () => {
        const plan = planEmisionRawUpserts(
            [{ fecha: '2 MAR 26', compra_dolares: '2', tc: '', bcra: 2_000 }],
            [apiRow],
        );

        expect(plan.appended).toBe(0);
        expect(plan.upserts).toEqual([{
            fecha: '2026-03-02',
            compra_dolares: 2,
            tc: 1_000,
            bcra: 2_000,
        }]);
    });
});
