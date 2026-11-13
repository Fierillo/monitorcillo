import type { ChartDataRow } from '@/types';
import { unstable_cache } from 'next/cache';
import {
    PRESUPUESTO_RUBRO_KEYS,
    withNegativeExpenses,
    type PresupuestoRubroKey,
} from './presupuesto/schema';

export type PresupuestoYearRow = Record<PresupuestoRubroKey, number> & {
    preliminary: boolean;
    proyecto: boolean;
};

export type PresupuestoSeries = Map<number, PresupuestoYearRow>;

export const PRESUPUESTO_LAW_SERIES: PresupuestoSeries = new Map([
    [2020, {
        tributarios: 2_746_484,
        aportes_ss: 1_330_424,
        otros_ingresos: 2_100_164,
        recursos_capital: 146_055,
        prestaciones_ss: 2_682_272,
        consumo_operacion: 817_396,
        transferencias: 2_880_166,
        intereses: 962_232,
        gastos_capital: 419_258,
        preliminary: false,
        proyecto: false,
    }],
    [2021, {
        tributarios: 4_681_814,
        aportes_ss: 2_044_419,
        otros_ingresos: 1_868_744,
        recursos_capital: 13_742,
        prestaciones_ss: 3_716_367,
        consumo_operacion: 1_332_045,
        transferencias: 3_883_388,
        intereses: 771_262,
        gastos_capital: 1_296_798,
        preliminary: false,
        proyecto: false,
    }],
    [2022, {
        tributarios: 8_558_438,
        aportes_ss: 3_672_470,
        otros_ingresos: 581_779,
        recursos_capital: 63_428,
        prestaciones_ss: 6_369_566,
        consumo_operacion: 2_279_787,
        transferencias: 6_420_776,
        intereses: 1_586_325,
        gastos_capital: 1_469_203,
        preliminary: false,
        proyecto: false,
    }],
    [2023, {
        tributarios: 17_268_020,
        aportes_ss: 8_295_265,
        otros_ingresos: 2_663_045,
        recursos_capital: 155_456,
        prestaciones_ss: 13_087_571,
        consumo_operacion: 5_602_573,
        transferencias: 14_214_607,
        intereses: 4_430_069,
        gastos_capital: 3_075_367,
        preliminary: false,
        proyecto: false,
    }],
    [2024, {
        tributarios: 58_459_188,
        aportes_ss: 25_297_497,
        otros_ingresos: 6_053_970,
        recursos_capital: 157_895,
        prestaciones_ss: 36_317_103,
        consumo_operacion: 14_109_785,
        transferencias: 31_504_322,
        intereses: 10_229_287,
        gastos_capital: 3_923_010,
        preliminary: true,
        proyecto: false,
    }],
    [2025, {
        tributarios: 73_767_309,
        aportes_ss: 40_720_625,
        otros_ingresos: 20_957_970,
        recursos_capital: 394_755,
        prestaciones_ss: 56_900_221,
        consumo_operacion: 17_875_924,
        transferencias: 38_731_319,
        intereses: 12_160_850,
        gastos_capital: 2_898_400,
        preliminary: true,
        proyecto: false,
    }],
    [2026, {
        tributarios: 90_308_958,
        aportes_ss: 47_652_940,
        otros_ingresos: 8_245_468,
        recursos_capital: 357_466,
        prestaciones_ss: 67_178_856,
        consumo_operacion: 20_179_300,
        transferencias: 43_368_172,
        intereses: 12_322_351,
        gastos_capital: 3_286_766,
        preliminary: false,
        proyecto: false,
    }],
    [2027, {
        tributarios: 122_592_339,
        aportes_ss: 62_336_428,
        otros_ingresos: 13_521_530,
        recursos_capital: 514_644,
        prestaciones_ss: 98_075_904,
        consumo_operacion: 28_354_431,
        transferencias: 53_347_675,
        intereses: 15_167_107,
        gastos_capital: 3_768_279,
        preliminary: false,
        proyecto: true,
    }],
]);

export const PRESUPUESTO_PBI_BY_YEAR = new Map([
    [2020, 42_380_207],
    [2021, 57_699_183],
    [2022, 86_300_992],
    [2023, 190_226_441],
    [2024, 603_000_000],
    [2025, 910_460_188],
    [2026, 1_032_146_706],
    [2027, 1_421_178_148],
]);

function toPctPbi(value: number, pbi: number): number {
    return (value / pbi) * 100;
}

export function buildPresupuestoChartData(
    series: PresupuestoSeries,
    pbiByYear: Map<number, number>,
): ChartDataRow[] {
    return [...series.entries()]
        .sort(([left], [right]) => left - right)
        .flatMap(([year, yearRow]) => {
            const pbi = pbiByYear.get(year);
            if (!pbi || pbi <= 0) return [];

            const nominal = Object.fromEntries(
                PRESUPUESTO_RUBRO_KEYS.map(key => [key, yearRow[key]]),
            ) as Record<PresupuestoRubroKey, number>;
            const signed = withNegativeExpenses(
                Object.fromEntries(
                    PRESUPUESTO_RUBRO_KEYS.map(key => [key, toPctPbi(nominal[key], pbi)]),
                ),
            );
            const resultado = PRESUPUESTO_RUBRO_KEYS.reduce((sum, key) => sum + Number(signed[key] ?? 0), 0);

            return [{
                fecha: String(year),
                iso_fecha: `${year}-01-01`,
                ...signed,
                resultado,
                preliminary: yearRow.preliminary,
                proyecto: yearRow.proyecto,
            }];
        });
}

export const fetchPresupuestoRubrosChartData = unstable_cache(
    async (): Promise<ChartDataRow[]> => buildPresupuestoChartData(PRESUPUESTO_LAW_SERIES, PRESUPUESTO_PBI_BY_YEAR),
    ['presupuesto-nacional-rubros-chart', 'v5-proyecto-2027'],
    { revalidate: 86400 },
);
