import { describe, expect, it } from 'vitest';
import {
    PRESUPUESTO_EXPENSE_KEYS,
    PRESUPUESTO_RESOURCE_KEYS,
    withNegativeExpenses,
} from '../lib/presupuesto/schema';
import { buildPresupuestoChartData, PRESUPUESTO_LAW_SERIES, PRESUPUESTO_PBI_BY_YEAR } from '../lib/presupuesto-source';

describe('presupuesto schema signs', () => {
    it('keeps resources positive and forces expenses negative', () => {
        const row = withNegativeExpenses({
            tributarios: 50,
            aportes_ss: 20,
            otros_ingresos: 5,
            recursos_capital: 2,
            prestaciones_ss: 30,
            consumo_operacion: 10,
            transferencias: 15,
            intereses: 8,
            gastos_capital: 4,
        });

        for (const key of PRESUPUESTO_RESOURCE_KEYS) {
            expect(row[key]).toBeGreaterThan(0);
        }
        for (const key of PRESUPUESTO_EXPENSE_KEYS) {
            expect(row[key]).toBeLessThan(0);
        }
    });

    it('preserves the budget result invariant after signing expenses', () => {
        const resources = { tributarios: 50, aportes_ss: 20, otros_ingresos: 5, recursos_capital: 2 };
        const expenses = { prestaciones_ss: 30, consumo_operacion: 10, transferencias: 15, intereses: 8, gastos_capital: 4 };
        const totalResources = Object.values(resources).reduce((sum, value) => sum + value, 0);
        const totalExpenses = Object.values(expenses).reduce((sum, value) => sum + value, 0);
        const expectedResult = totalResources - totalExpenses;

        const row = withNegativeExpenses({ ...resources, ...expenses });
        const signedResources = PRESUPUESTO_RESOURCE_KEYS.reduce((sum, key) => sum + Number(row[key]), 0);
        const signedExpenses = PRESUPUESTO_EXPENSE_KEYS.reduce((sum, key) => sum + Number(row[key]), 0);

        expect(signedResources + signedExpenses).toBeCloseTo(expectedResult);
    });
});

describe('presupuesto chart builder', () => {
    it('builds signed annual chart rows as percent of GDP', () => {
        const series = new Map([[2024, {
            tributarios: 50_000,
            aportes_ss: 20_000,
            otros_ingresos: 5_000,
            recursos_capital: 1_000,
            prestaciones_ss: 30_000,
            consumo_operacion: 10_000,
            transferencias: 15_000,
            intereses: 8_000,
            gastos_capital: 4_000,
            preliminary: true,
            proyecto: false,
        }]]);

        const row = buildPresupuestoChartData(series, new Map([[2024, 200_000]])).at(-1);

        expect(row).toMatchObject({
            fecha: '2024',
            iso_fecha: '2024-01-01',
            tributarios: 25,
            aportes_ss: 10,
            otros_ingresos: 2.5,
            recursos_capital: 0.5,
            prestaciones_ss: -15,
            consumo_operacion: -5,
            transferencias: -7.5,
            intereses: -4,
            gastos_capital: -2,
            resultado: 4.5,
            preliminary: true,
            proyecto: false,
        });
    });

    it('builds chart rows from the curated law series', () => {
        const rows = buildPresupuestoChartData(PRESUPUESTO_LAW_SERIES, PRESUPUESTO_PBI_BY_YEAR);

        expect(rows.map(row => row.fecha)).toEqual(['2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027']);
        expect(rows[0].prestaciones_ss).toBeLessThan(0);
        expect(rows[0].tributarios).toBeGreaterThan(0);
        expect(rows.find(row => row.fecha === '2024')?.preliminary).toBe(true);
        expect(rows.find(row => row.fecha === '2025')?.preliminary).toBe(true);
        expect(rows.find(row => row.fecha === '2026')?.preliminary).toBe(false);
        expect(rows.find(row => row.fecha === '2027')?.proyecto).toBe(true);
        expect(rows.find(row => row.fecha === '2027')?.preliminary).toBe(false);
        expect(rows.at(-1)?.resultado).toBeCloseTo(0, 1);
    });
});
