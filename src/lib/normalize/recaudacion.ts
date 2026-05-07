import type { RecaudacionNormalizedRow, RecaudacionRawRow } from '@/types';
import { fechaToTimestamp, MONTHS_ES } from './dates';
import { baseIpcValue, notNull, toBasePrices, toNullableNumber } from './numbers';

export function normalizeRecaudacion(rawData: RecaudacionRawRow[]): RecaudacionNormalizedRow[] {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const baseIpc = baseIpcValue(rawData);
    return rawData
        .filter((row) => row.fecha && row.fecha >= '2019-01-01' && row.recaudacion_total != null)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map((row) => {
            const recaudacionReal = toBasePrices(
                toNullableNumber(row.recaudacion_total ?? null),
                toNullableNumber(row.ipc_nucleo ?? null),
                baseIpc,
            );

            return { row, recaudacionReal };
        })
        .map(({ row, recaudacionReal }, index, rows) => {
            const year = row.year ?? Number(row.fecha.slice(0, 4));
            const monthStr = row.mes ?? row.fecha.slice(5, 7);
            const monthNum = parseInt(monthStr, 10);
            const pbiMensual = toNullableNumber(row.pbi_trimestral);
            const movingWindow = rows.slice(Math.max(0, index - 11), index + 1);
            const realValues = movingWindow.map(item => item.recaudacionReal).filter((value): value is number => value != null);
            const recaudacionRealMm12 = realValues.length === 12
                ? realValues.reduce((total, value) => total + value, 0) / 12
                : null;

            return pbiMensual && recaudacionRealMm12 != null
                ? {
                    fecha: `${MONTHS_ES[monthNum - 1]} ${String(year).slice(-2)}`,
                    iso_fecha: row.fecha,
                    mes: monthStr,
                    year,
                    pctPbi: recaudacionReal == null ? null : (recaudacionReal / pbiMensual) * 100,
                    pctPbiMm12: (recaudacionRealMm12 / pbiMensual) * 100,
                }
                : pbiMensual && recaudacionReal != null
                ? {
                    fecha: `${MONTHS_ES[monthNum - 1]} ${String(year).slice(-2)}`,
                    iso_fecha: row.fecha,
                    mes: monthStr,
                    year,
                    pctPbi: (recaudacionReal / pbiMensual) * 100,
                    pctPbiMm12: null,
                }
                : null;
        })
        .filter(notNull)
        .sort((a, b) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));
}
