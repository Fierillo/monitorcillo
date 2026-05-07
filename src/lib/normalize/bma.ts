import type { BmaMonthlyBucket, BmaNormalizedRow, BmaRawRow, NumericValue } from '@/types';
import { fechaToTimestamp } from './dates';
import { baseIpcValue, notNull, toBasePrices, toNullableNumber } from './numbers';

const MONTHS_NAMES: Record<string, string> = {
    '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR',
    '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AGO',
    '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
};

function addAverage(value: NumericValue, apply: (numericValue: number) => void) {
    const numericValue = toNullableNumber(value);
    if (numericValue != null) apply(numericValue);
}

function emptyBucket(): BmaMonthlyBucket {
    return {
        bmTotal: 0, bmCount: 0,
        pasesTotal: 0, pasesCount: 0,
        leliqTotal: 0, leliqCount: 0,
        lefiTotal: 0, lefiCount: 0,
        otrosTotal: 0, otrosCount: 0,
        depositosTesoroTotal: 0, depositosTesoroCount: 0,
        pbi_trimestral: null,
        emae_desestacionalizado: null,
        ipc_nucleo: null,
    };
}

function average(total: number, count: number): number | null {
    return count > 0 ? total / count : null;
}

export function normalizeBma(rawData: BmaRawRow[]): BmaNormalizedRow[] {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const monthly = new Map<string, BmaMonthlyBucket>();
    const baseIpc = baseIpcValue(rawData);

    for (const row of rawData) {
        if (!row.fecha || typeof row.fecha !== 'string') continue;
        const monthKey = row.fecha.slice(0, 7);
        const bucket = monthly.get(monthKey) ?? emptyBucket();

        addAverage(row.base_monetaria, (value) => { bucket.bmTotal += value; bucket.bmCount += 1; });
        addAverage(row.pases, (value) => { bucket.pasesTotal += value; bucket.pasesCount += 1; });
        addAverage(row.leliq, (value) => { bucket.leliqTotal += value; bucket.leliqCount += 1; });
        addAverage(row.lefi, (value) => { bucket.lefiTotal += value; bucket.lefiCount += 1; });
        addAverage(row.otros, (value) => { bucket.otrosTotal += value; bucket.otrosCount += 1; });
        addAverage(row.depositos_tesoro, (value) => { bucket.depositosTesoroTotal += value; bucket.depositosTesoroCount += 1; });

        if (row.pbi_trimestral != null) bucket.pbi_trimestral = toNullableNumber(row.pbi_trimestral);
        if (row.emae_desestacionalizado != null) bucket.emae_desestacionalizado = toNullableNumber(row.emae_desestacionalizado);
        if (row.ipc_nucleo != null) bucket.ipc_nucleo = toNullableNumber(row.ipc_nucleo);
        monthly.set(monthKey, bucket);
    }

    return Array.from(monthly.entries()).map(([monthKey, bucket]) => {
        const [yyyy, mm] = monthKey.split('-');
        if (!MONTHS_NAMES[mm]) return null;
        const calcPct = (value: number | null) => {
            const realValue = toBasePrices(value, bucket.ipc_nucleo, baseIpc);
            return realValue == null || !bucket.pbi_trimestral ? null : (realValue / bucket.pbi_trimestral) * 100;
        };
        const bmRaw = average(bucket.bmTotal, bucket.bmCount);
        const pasesRaw = average(bucket.pasesTotal, bucket.pasesCount);
        const leliqRaw = average(bucket.leliqTotal, bucket.leliqCount);
        const lefiRaw = average(bucket.lefiTotal, bucket.lefiCount);
        const otrosRaw = average(bucket.otrosTotal, bucket.otrosCount);
        const depositosTesoroRaw = average(bucket.depositosTesoroTotal, bucket.depositosTesoroCount);
        const pasivosRaw = [pasesRaw, leliqRaw, lefiRaw, otrosRaw].filter((value) => value != null) as number[];
        const pasivosRemuneradosRaw = pasivosRaw.length ? pasivosRaw.reduce((total, value) => total + value, 0) : null;
        const bmAmpliaRaw = bmRaw != null && pasivosRemuneradosRaw != null && depositosTesoroRaw != null ? bmRaw + pasivosRemuneradosRaw + depositosTesoroRaw : null;

        return {
            fecha: `${MONTHS_NAMES[mm]} ${yyyy.slice(-2)}`,
            iso_fecha: `${monthKey}-01`,
            BaseMonetaria: calcPct(bmRaw),
            PasivosRemunerados: calcPct(pasivosRemuneradosRaw),
            DepositosTesoro: calcPct(depositosTesoroRaw),
            BMAmplia: calcPct(bmAmpliaRaw),
        };
    }).filter(notNull).sort((a, b) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));
}
