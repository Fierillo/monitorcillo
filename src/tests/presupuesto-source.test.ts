import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import {
    PRESUPUESTO_EXPENSE_KEYS,
    PRESUPUESTO_RESOURCE_KEYS,
    withNegativeExpenses,
} from '../lib/presupuesto/schema';
import { buildPresupuestoAgregadoChartData, buildPresupuestoChartData, parsePresupuestoDatasetLinks, parsePresupuestoSerieAnualCsv, parsePresupuestoWorkbook, PRESUPUESTO_LAW_SERIES, PRESUPUESTO_PBI_BY_YEAR } from '../lib/presupuesto-source';

function presupuestoWorkbook(rows: unknown[][]): Uint8Array {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'presupuesto');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

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

describe('presupuesto workbook parsing', () => {
    it('parses annual law rubros from a minimal workbook format', () => {
        const buffer = presupuestoWorkbook([
            ['ejercicio', 'rubro', 'millones'],
            [2024, 'tributarios', 58_000],
            [2024, 'aportes_ss', 25_000],
            [2024, 'otros_ingresos', 6_000],
            [2024, 'recursos_capital', 200],
            [2024, 'prestaciones_ss', 36_000],
            [2024, 'consumo_operacion', 14_000],
            [2024, 'transferencias', 31_000],
            [2024, 'intereses', 10_000],
            [2024, 'gastos_capital', 2_500],
            [2026, 'tributarios', 90_000],
            [2026, 'aportes_ss', 40_000],
            [2026, 'otros_ingresos', 8_000],
            [2026, 'recursos_capital', 1_000],
            [2026, 'prestaciones_ss', 55_000],
            [2026, 'consumo_operacion', 20_000],
            [2026, 'transferencias', 40_000],
            [2026, 'intereses', 15_000],
            [2026, 'gastos_capital', 5_000],
        ]);

        const series = parsePresupuestoWorkbook(buffer);

        expect(series.get(2024)).toMatchObject({
            tributarios: 58_000,
            aportes_ss: 25_000,
            otros_ingresos: 6_000,
            recursos_capital: 200,
            prestaciones_ss: 36_000,
            consumo_operacion: 14_000,
            transferencias: 31_000,
            intereses: 10_000,
            gastos_capital: 2_500,
            preliminary: true,
            proyecto: false,
        });
        expect(series.get(2026)?.tributarios).toBe(90_000);
        expect(series.size).toBe(2);
    });
});

describe('presupuesto chart builder', () => {
    it('builds signed annual chart rows as percent of GDP', () => {
        const series = parsePresupuestoWorkbook(presupuestoWorkbook([
            ['ejercicio', 'rubro', 'millones'],
            [2024, 'tributarios', 50_000],
            [2024, 'aportes_ss', 20_000],
            [2024, 'otros_ingresos', 5_000],
            [2024, 'recursos_capital', 1_000],
            [2024, 'prestaciones_ss', 30_000],
            [2024, 'consumo_operacion', 10_000],
            [2024, 'transferencias', 15_000],
            [2024, 'intereses', 8_000],
            [2024, 'gastos_capital', 4_000],
        ]));

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

describe('presupuesto dataset discovery', () => {
    it('finds presupuesto workbook links from an open-data page', () => {
        const html = `
            <a href="/dataset/sspre-presupuesto-2024/resource/presupuesto.xlsx">Presupuesto ley 2024</a>
            <a href="https://www.mecon.gob.ar/onp/documentos/presutexto/proy2026/ley/pdf/proy2026.pdf">Ley PDF</a>
            <a href="https://datos.gob.ar/dataset/sspre-presupuesto-2026/download/presupuesto_nacional.xlsx">Presupuesto nacional 2026</a>
        `;

        expect(parsePresupuestoDatasetLinks(html, 'https://datos.gob.ar')).toEqual([
            'https://datos.gob.ar/dataset/sspre-presupuesto-2024/resource/presupuesto.xlsx',
            'https://datos.gob.ar/dataset/sspre-presupuesto-2026/download/presupuesto_nacional.xlsx',
        ]);
    });
});

describe('presupuesto serie anual datos.gob.ar', () => {
    it('parses the official annual income-expense-GDP csv format', () => {
        const csv = [
            'ejercicio_presupuestario,ingreso,gasto,PIB',
            '2019-01-01,4500000,4800000,30000000',
            '2020-01-01,4200000,5100000,28000000',
            '2024-01-01,89968549,96086046,603000000',
        ].join('\n');

        const parsed = parsePresupuestoSerieAnualCsv(csv);

        expect(parsed.get(2019)).toEqual({ ingreso: 4_500_000, gasto: 4_800_000, pbi: 30_000_000 });
        expect(parsed.get(2020)).toEqual({ ingreso: 4_200_000, gasto: 5_100_000, pbi: 28_000_000 });
        expect(parsed.get(2024)?.ingreso).toBe(89_968_549);
        expect(parsed.size).toBe(3);
    });

    it('builds diverging aggregate bars as percent of GDP', () => {
        const series = parsePresupuestoSerieAnualCsv([
            'ejercicio_presupuestario,ingreso,gasto,PIB',
            '2019-01-01,4500000,4800000,30000000',
        ].join('\n'));

        expect(buildPresupuestoAgregadoChartData(series)).toEqual([{
            fecha: '2019',
            iso_fecha: '2019-01-01',
            ingreso: 15,
            gasto: -16,
            resultado: -1,
            preliminary: false,
        }]);
    });

    it('can rebuild an aggregate series from curated law rubros and GDP', () => {
        const ingreso2024 = 58_459_188 + 25_297_497 + 6_053_970 + 157_895;
        const gasto2024 = 36_317_103 + 14_109_785 + 31_504_322 + 10_229_287 + 3_923_010;
        const series = new Map([[2024, { ingreso: ingreso2024, gasto: gasto2024, pbi: 603_000_000 }]]);
        const row = buildPresupuestoAgregadoChartData(series)[0];

        expect(row.fecha).toBe('2024');
        expect(row.ingreso).toBeCloseTo((ingreso2024 / 603_000_000) * 100, 5);
        expect(row.gasto).toBeCloseTo(-(gasto2024 / 603_000_000) * 100, 5);
    });
});
