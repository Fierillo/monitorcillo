import type { RecaudacionNormalizedRow, RecaudacionRawRow } from '@/types';
import { RECAUDACION_RESIDUAL, RECAUDACION_TAX_TYPES } from '../recaudacion/schema';
import { fechaToTimestamp, MONTHS_ES } from './dates';
import { baseIpcValue, notNull, toBasePrices, toNullableNumber } from './numbers';

function toPctPbi(realValue: number | null, pbiMensual: number | null): number | null {
    if (realValue == null || pbiMensual == null || pbiMensual === 0) return null;
    return (realValue / pbiMensual) * 100;
}

function movingAverage(values: Array<number | null>, windowSize: number): number | null {
    if (values.length < windowSize) return null;
    const window = values.slice(-windowSize);
    if (window.some(value => value == null)) return null;
    return window.reduce<number>((total, value) => total + (value as number), 0) / windowSize;
}

function residualReal(totalReal: number | null, taxReals: Record<string, number | null>): number | null {
    if (totalReal == null) return null;
    if (RECAUDACION_TAX_TYPES.some(tax => taxReals[tax.key] == null)) return null;

    return totalReal - RECAUDACION_TAX_TYPES.reduce((sum, tax) => sum + (taxReals[tax.key] as number), 0);
}

export function normalizeRecaudacion(rawData: RecaudacionRawRow[]): RecaudacionNormalizedRow[] {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const baseIpc = baseIpcValue(rawData);
    return rawData
        .filter((row) => row.fecha && row.fecha >= '2019-01-01' && row.recaudacion_total != null)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map((row) => {
            const ipc = toNullableNumber(row.ipc_nucleo ?? null);
            const recaudacionReal = toBasePrices(toNullableNumber(row.recaudacion_total ?? null), ipc, baseIpc);
            const taxReals = Object.fromEntries(
                RECAUDACION_TAX_TYPES.map(tax => [
                    tax.key,
                    toBasePrices(toNullableNumber(row[tax.rawKey] ?? null), ipc, baseIpc),
                ]),
            ) as Record<string, number | null>;
            const otrosReal = residualReal(recaudacionReal, taxReals);

            return { row, recaudacionReal, taxReals, otrosReal };
        })
        .map(({ row, recaudacionReal, taxReals, otrosReal }, index, rows) => {
            const year = row.year ?? Number(row.fecha.slice(0, 4));
            const monthStr = row.mes ?? row.fecha.slice(5, 7);
            const monthNum = parseInt(monthStr, 10);
            const pbiMensual = toNullableNumber(row.pbi_trimestral);
            if (!pbiMensual) return null;

            const movingWindow = rows.slice(Math.max(0, index - 11), index + 1);
            const recaudacionRealMm12 = movingAverage(movingWindow.map(item => item.recaudacionReal), 12);
            const taxPctEntries = RECAUDACION_TAX_TYPES.flatMap(tax => {
                const realValues = movingWindow.map(item => item.taxReals[tax.key] ?? null);
                return [
                    [tax.pctKey, toPctPbi(taxReals[tax.key] ?? null, pbiMensual)],
                    [tax.mm12Key, toPctPbi(movingAverage(realValues, 12), pbiMensual)],
                ] as const;
            });
            const otrosValues = movingWindow.map(item => item.otrosReal);

            return {
                fecha: `${MONTHS_ES[monthNum - 1]} ${String(year).slice(-2)}`,
                iso_fecha: row.fecha,
                mes: monthStr,
                year,
                pctPbi: toPctPbi(recaudacionReal, pbiMensual),
                pctPbiMm12: toPctPbi(recaudacionRealMm12, pbiMensual),
                ...Object.fromEntries(taxPctEntries),
                [RECAUDACION_RESIDUAL.pctKey]: toPctPbi(otrosReal, pbiMensual),
                [RECAUDACION_RESIDUAL.mm12Key]: toPctPbi(movingAverage(otrosValues, 12), pbiMensual),
            } satisfies RecaudacionNormalizedRow;
        })
        .filter(notNull)
        .sort((a, b) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));
}
