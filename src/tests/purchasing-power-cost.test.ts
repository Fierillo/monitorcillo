import { describe, expect, it } from 'vitest';
import { formatValueByType } from '@/components/chart/utils';
import { calculateRentSalaryBurden } from '@/lib/purchasing-power-cost';

describe('calculateRentSalaryBurden', () => {
    it('adjusts observed rents with nominal registered and informal salaries', () => {
        const result = calculateRentSalaryBurden([
            { fecha: '2020-06-01', salario_registrado: '100', salario_no_registrado: '50' },
            { fecha: '2021-06-01', salario_registrado: 200, salario_no_registrado: 150 },
            { fecha: '2022-05-01', salario_registrado: 400, salario_no_registrado: 300 },
            { fecha: '2022-06-01', salario_registrado: null, salario_no_registrado: null },
        ], [
            { date: '2020-06-01', value: 1000 },
            { date: '2021-06-01', value: 2000 },
            { date: '2022-06-01', value: 3000 },
        ]);

        expect(result).toHaveLength(3);
        expect(result[0]).toMatchObject({ iso_fecha: '2020-06-01', alquiler_registrado: 4000, alquiler_informal: 6000 });
        expect(result[1]).toMatchObject({ iso_fecha: '2021-06-01', alquiler_registrado: 4000, alquiler_informal: 4000 });
        expect(result[2]).toMatchObject({ iso_fecha: '2022-06-01', alquiler_registrado: 3000, alquiler_informal: 3000, salario_fecha: '2022-05-01' });
    });

    it('omits rents without matching salary data', () => {
        expect(calculateRentSalaryBurden([])).toEqual([]);
        expect(calculateRentSalaryBurden([{ fecha: '2020-06-01', salario_registrado: 100, salario_no_registrado: null }])).toEqual([]);
        expect(calculateRentSalaryBurden([
            { fecha: '2020-05-01', salario_registrado: 100, salario_no_registrado: 100 },
            { fecha: '2021-05-01', salario_registrado: 200, salario_no_registrado: 200 },
        ], [{ date: '2020-06-01', value: 1000 }])).toEqual([]);
    });
});

describe('currency chart format', () => {
    it('formats whole Argentine pesos', () => {
        expect(formatValueByType(1253383.4, 'currency')).toBe('$1.253.383');
    });
});
