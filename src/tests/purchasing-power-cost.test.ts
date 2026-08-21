import { describe, expect, it } from 'vitest';
import { formatValueByType } from '@/components/chart/utils';
import { calculateCostOfLivingBurden } from '@/lib/purchasing-power-cost';

describe('calculateCostOfLivingBurden', () => {
    it('expresses annual living costs as percentages of the reference salary', () => {
        const result = calculateCostOfLivingBurden([
            { fecha: '2020-05-01', salario_privado: 100 },
            { fecha: '2026-05-01', salario_privado: 200 },
        ], [
            ['2020-05-01', 50, 50, 50, 50, 50],
            ['2026-05-01', 100, 100, 100, 100, 100],
        ], ['2020-05-01']);

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            fecha: '2020',
            iso_fecha: '2020-05-01',
            salario_referencia: 500_000,
            alquiler: 60,
            alimentos: 18,
            transporte: 5,
            servicios: 10,
            impuestos: 17,
            alquiler_pesos: 300_000,
            alimentos_pesos: 90_000,
        });
        expect(result[0].salud).toBeCloseTo(7);
    });

    it('uses the latest available indices for a later rent observation', () => {
        const result = calculateCostOfLivingBurden([
            { fecha: '2026-05-01', salario_privado: 200 },
        ], [
            ['2026-05-01', 100, 100, 100, 100, 100],
        ], ['2026-06-01']);

        expect(result[0]).toMatchObject({ salario_referencia: 1_000_000, alquiler: 60, impuestos: 17 });
    });

    it('covers every May from 2017 through 2026 by default', () => {
        const years = Array.from({ length: 10 }, (_, index) => 2017 + index);
        const result = calculateCostOfLivingBurden(
            years.map(year => ({ fecha: `${year}-05-01`, salario_privado: year })),
            years.map(year => [`${year}-05-01`, year, year, year, year, year]),
        );

        expect(result).toHaveLength(10);
        expect(result[0].iso_fecha).toBe('2017-05-01');
        expect(result.at(-1)?.iso_fecha).toBe('2026-05-01');
    });

    it('returns no rows without the reference salary and cost indices', () => {
        expect(calculateCostOfLivingBurden([], [])).toEqual([]);
        expect(calculateCostOfLivingBurden([{ fecha: '2026-05-01', salario_privado: 100 }], [])).toEqual([]);
    });
});

describe('currency chart format', () => {
    it('formats whole Argentine pesos', () => {
        expect(formatValueByType(1253383.4, 'currency')).toBe('$1.253.383');
    });
});
