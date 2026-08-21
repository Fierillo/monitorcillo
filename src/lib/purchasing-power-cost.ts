import type { ChartDataRow, DatosGobSeriesRow, PoderAdquisitivoRawRow } from '@/types';
import { fetchTimeSeries } from './sync/time-series-client';

export const COST_OF_LIVING_MODEL = {
    referenceDate: '2026-05-01',
    referenceSalary: 1_000_000,
    currentCosts: {
        alquiler: 600_000,
        alimentos: 180_000,
        transporte: 50_000,
        servicios: 100_000,
        salud: 70_000,
    },
    taxRate: 0.17,
} as const;

const COST_INDEX_IDS = [
    '146.3_IALIMENNAL_DICI_M_45',
    '146.3_ITRANSPNAL_DICI_M_23',
    '146.3_IVIVIENNAL_DICI_M_52',
    '146.3_ISALUDNAL_DICI_M_18',
    '104.1_I2RE_2016_M_25',
];

const ANNUAL_DATES = Array.from({ length: 10 }, (_, index) => `${2017 + index}-05-01`);

export function calculateCostOfLivingBurden(
    salaryData: PoderAdquisitivoRawRow[],
    costIndexData: DatosGobSeriesRow[],
    dates: readonly string[] = ANNUAL_DATES,
): ChartDataRow[] {
    const salaries = new Map(salaryData
        .filter(row => positiveNumber(row.salario_privado) !== null)
        .map(row => [row.fecha, Number(row.salario_privado)]));
    const indices = new Map(costIndexData
        .filter(row => row.length === COST_INDEX_IDS.length + 1 && row.slice(1).every(value => positiveNumber(value) !== null))
        .map(row => [row[0], row.slice(1).map(Number)]));
    const referenceSalaryIndex = salaries.get(COST_OF_LIVING_MODEL.referenceDate);
    const referenceCostIndices = indices.get(COST_OF_LIVING_MODEL.referenceDate);
    if (!referenceSalaryIndex || !referenceCostIndices) return [];

    return dates.flatMap(date => {
        const salaryIndex = valueAtOrBefore(salaries, date);
        const costIndices = valueAtOrBefore(indices, date);
        if (!salaryIndex || !costIndices) return [];

        const salary = COST_OF_LIVING_MODEL.referenceSalary * salaryIndex / referenceSalaryIndex;
        const costs = {
            alquiler: COST_OF_LIVING_MODEL.currentCosts.alquiler * costIndices[4] / referenceCostIndices[4],
            alimentos: COST_OF_LIVING_MODEL.currentCosts.alimentos * costIndices[0] / referenceCostIndices[0],
            transporte: COST_OF_LIVING_MODEL.currentCosts.transporte * costIndices[1] / referenceCostIndices[1],
            servicios: COST_OF_LIVING_MODEL.currentCosts.servicios * costIndices[2] / referenceCostIndices[2],
            salud: COST_OF_LIVING_MODEL.currentCosts.salud * costIndices[3] / referenceCostIndices[3],
            impuestos: salary * COST_OF_LIVING_MODEL.taxRate,
        };

        return [{
            fecha: date.slice(0, 4),
            iso_fecha: date,
            salario_referencia: salary,
            ...Object.fromEntries(Object.entries(costs).map(([key, value]) => [key, value / salary * 100])),
            ...Object.fromEntries(Object.entries(costs).map(([key, value]) => [`${key}_pesos`, value])),
        }];
    });
}

export async function fetchCostOfLivingIndices(): Promise<DatosGobSeriesRow[]> {
    return (await fetchTimeSeries({ ids: COST_INDEX_IDS })).data ?? [];
}

function valueAtOrBefore<T>(values: Map<string, T>, date: string): T | null {
    let result: T | null = null;
    for (const [candidateDate, value] of [...values].sort(([first], [second]) => first.localeCompare(second))) {
        if (candidateDate > date) break;
        result = value;
    }
    return result;
}

function positiveNumber(value: unknown): number | null {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
}
