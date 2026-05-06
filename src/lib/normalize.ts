import type {
    BcraVariableRow,
    BmaMonthlyBucket,
    BmaNormalizedRow,
    BmaRawRow,
    EmaeNormalizedRow,
    EmaeRawRow,
    EmisionNormalizedRow,
    EmisionRawRow,
    NumericValue,
    PoderAdquisitivoNormalizedRow,
    PoderAdquisitivoRawRow,
    RecaudacionNormalizedRow,
    RecaudacionRawRow,
} from '@/types';

const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];
const MONTHS_IDX: Record<string, number> = { ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AGO: 7, SEPT: 8, SEP: 8, OCT: 9, NOV: 10, DIC: 11 };

function toNumber(value: NumericValue, fallback = 0): number {
    const numericValue = Number(value ?? fallback);
    return Number.isNaN(numericValue) ? fallback : numericValue;
}

function toNullableNumber(value: NumericValue): number | null {
    if (value === null || value === undefined || value === '') return null;
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? null : numericValue;
}

function notNull<T>(value: T | null): value is T {
    return value !== null;
}

function baseIpcValue(rows: Array<{ fecha: string; ipc_nucleo?: NumericValue }>): number | null {
    const baseRow = rows.find(row => row.fecha === '2017-01-01');
    return baseRow ? toNullableNumber(baseRow.ipc_nucleo ?? null) : null;
}

function toBasePrices(value: number | null, currentIpc: number | null, baseIpc: number | null): number | null {
    if (value == null || !currentIpc || !baseIpc) return null;
    return value * (baseIpc / currentIpc);
}

export function isoToFecha(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}

export function isoToMonthLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    return `${MONTHS_ES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}

export function fechaToTimestamp(fecha: string): number {
    const parts = fecha.split(' ');
    if (parts.length < 3) return 0;
    const parsedYear = parseInt(parts[2], 10);
    const year = parts[2].length === 2 ? 2000 + parsedYear : parsedYear;
    return new Date(year, MONTHS_IDX[parts[1]], parseInt(parts[0], 10)).getTime();
}

export function fechaToISO(fecha: string): string {
    const parts = fecha.split(' ');
    if (parts.length < 3) return '';
    const parsedYear = parseInt(parts[2], 10);
    const year = parts[2].length === 2 ? 2000 + parsedYear : parsedYear;
    return `${year}-${String(MONTHS_IDX[parts[1]] + 1).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
}

export function normalizeEmision(rawData: EmisionRawRow[], tcData: BcraVariableRow[] = []): EmisionNormalizedRow[] {
    const tcByFecha = new Map(tcData.map((row) => [row.fecha, row.valor]));
    const byFecha = new Map(rawData.map((row) => [row.fecha, row]));

    const merged = Array.from(byFecha.values()).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

    let runningTotal = 0;
    return merged.map((row) => {
        const tc = toNumber(row.tc ?? tcByFecha.get(row.fecha));
        const compraDolares = toNumber(row.compra_dolares ?? row.valor);
        const bcra = toNumber(row.bcra, compraDolares * tc);
        const vencimientos = toNumber(row.vencimientos);
        const licitado = toNumber(row.licitado);
        const licitaciones = vencimientos - licitado;
        const resultadoFiscal = toNumber(row.resultado_fiscal);
        const total = bcra + licitaciones + resultadoFiscal;
        runningTotal += total;

        return {
            fecha: isoToFecha(row.fecha),
            iso_fecha: row.fecha,
            BCRA: bcra,
            BCRA_POS: bcra > 0 ? bcra : null,
            BCRA_NEG: bcra < 0 ? bcra : null,
            TC: tc,
            CompraDolares: compraDolares,
            Vencimientos: vencimientos,
            Licitado: licitado,
            Licitaciones: licitaciones,
            Licitaciones_POS: licitaciones > 0 ? licitaciones : null,
            Licitaciones_NEG: licitaciones < 0 ? licitaciones : null,
            'Resultado fiscal': resultadoFiscal,
            ResultadoFiscal_POS: resultadoFiscal > 0 ? resultadoFiscal : null,
            ResultadoFiscal_NEG: resultadoFiscal < 0 ? resultadoFiscal : null,
            TOTAL: total,
            ACUMULADO: runningTotal,
        };
    });
}

export function normalizeEmae(rawData: EmaeRawRow[]): EmaeNormalizedRow[] {
    if (!Array.isArray(rawData) || rawData.length === 0) {
        return [];
    }

    const baseRow = rawData.find((row) => row.fecha === '2017-01-01');
    if (!baseRow) {
        return [];
    }

    const baseOriginal = toNullableNumber(baseRow.emae);
    const baseDesest = toNullableNumber(baseRow.emae_desestacionalizado);
    const baseTendencia = toNullableNumber(baseRow.emae_tendencia);

    return rawData
        .map((row) => {
            if (!row.fecha || typeof row.fecha !== 'string') return null;
            const dateObj = new Date(`${row.fecha}T00:00:00Z`);
            if (Number.isNaN(dateObj.getTime())) return null;
            const emae = toNullableNumber(row.emae);
            const emaeDesestacionalizado = toNullableNumber(row.emae_desestacionalizado);
            const emaeTendencia = toNullableNumber(row.emae_tendencia);

            return {
                fecha: `${MONTHS_ES[dateObj.getUTCMonth()]} ${String(dateObj.getUTCFullYear()).slice(-2)}`,
                iso_fecha: row.fecha,
                emae: baseOriginal && emae != null ? (emae / baseOriginal) * 100 : null,
                emae_desestacionalizado: baseDesest && emaeDesestacionalizado != null ? (emaeDesestacionalizado / baseDesest) * 100 : null,
                emae_tendencia: baseTendencia && emaeTendencia != null ? (emaeTendencia / baseTendencia) * 100 : null,
            };
        })
        .filter(notNull)
        .sort((a, b) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));
}

export function normalizeBma(rawData: BmaRawRow[]): BmaNormalizedRow[] {
    if (!Array.isArray(rawData) || rawData.length === 0) {
        return [];
    }

    const MONTHS_NAMES: Record<string, string> = {
        '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR',
        '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AGO',
        '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
    };

    const monthly = new Map<string, BmaMonthlyBucket>();
    const baseIpc = baseIpcValue(rawData);

    for (const row of rawData) {
        if (!row.fecha || typeof row.fecha !== 'string') continue;
        const monthKey = row.fecha.slice(0, 7);
        const bucket = monthly.get(monthKey) ?? {
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

        const addAverage = (value: NumericValue, apply: (numericValue: number) => void) => {
            const numericValue = toNullableNumber(value);
            if (numericValue == null) return;
            apply(numericValue);
        };

        addAverage(row.base_monetaria, (value) => { bucket.bmTotal += value; bucket.bmCount += 1; });
        addAverage(row.pases, (value) => { bucket.pasesTotal += value; bucket.pasesCount += 1; });
        addAverage(row.leliq, (value) => { bucket.leliqTotal += value; bucket.leliqCount += 1; });
        addAverage(row.lefi, (value) => { bucket.lefiTotal += value; bucket.lefiCount += 1; });
        addAverage(row.otros, (value) => { bucket.otrosTotal += value; bucket.otrosCount += 1; });

        const numericDeposito = toNullableNumber(row.depositos_tesoro);
        if (numericDeposito != null) {
            bucket.depositosTesoroTotal += numericDeposito;
            bucket.depositosTesoroCount += 1;
        }

        if (row.pbi_trimestral != null) bucket.pbi_trimestral = toNullableNumber(row.pbi_trimestral);
        if (row.emae_desestacionalizado != null) bucket.emae_desestacionalizado = toNullableNumber(row.emae_desestacionalizado);
        if (row.ipc_nucleo != null) bucket.ipc_nucleo = toNullableNumber(row.ipc_nucleo);

        monthly.set(monthKey, bucket);
    }

    const result = Array.from(monthly.entries())
        .map(([monthKey, bucket]) => {
            const [yyyy, mm] = monthKey.split('-');
            if (!MONTHS_NAMES[mm]) return null;

            const pbiMensual = bucket.pbi_trimestral;
            const ipcMensual = bucket.ipc_nucleo;

            const calcPct = (val: number | null) => {
                const realValue = toBasePrices(val, ipcMensual, baseIpc);
                if (realValue == null || !pbiMensual) return null;
                return (realValue / pbiMensual) * 100;
            };

            const bmRaw = bucket.bmCount > 0 ? bucket.bmTotal / bucket.bmCount : null;
            const pasesRaw = bucket.pasesCount > 0 ? bucket.pasesTotal / bucket.pasesCount : null;
            const leliqRaw = bucket.leliqCount > 0 ? bucket.leliqTotal / bucket.leliqCount : null;
            const lefiRaw = bucket.lefiCount > 0 ? bucket.lefiTotal / bucket.lefiCount : null;
            const otrosRaw = bucket.otrosCount > 0 ? bucket.otrosTotal / bucket.otrosCount : null;
            const depositosTesoroRaw = bucket.depositosTesoroCount > 0 ? bucket.depositosTesoroTotal / bucket.depositosTesoroCount : null;

            const pasivosComponentesRaw = [pasesRaw, leliqRaw, lefiRaw, otrosRaw].filter((value) => value != null) as number[];
            const pasivosRemuneradosRaw = pasivosComponentesRaw.length > 0 ? pasivosComponentesRaw.reduce((total, value) => total + value, 0) : null;
            const bmAmpliaRaw = bmRaw != null && pasivosRemuneradosRaw != null && depositosTesoroRaw != null
                ? bmRaw + pasivosRemuneradosRaw + depositosTesoroRaw
                : null;

            return {
                fecha: `${MONTHS_NAMES[mm]} ${yyyy.slice(-2)}`,
                iso_fecha: `${monthKey}-01`,
                BaseMonetaria: calcPct(bmRaw),
                PasivosRemunerados: calcPct(pasivosRemuneradosRaw),
                DepositosTesoro: calcPct(depositosTesoroRaw),
                BMAmplia: calcPct(bmAmpliaRaw),
            };
        })
        .filter(notNull)
        .sort((a, b) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));

    return result;
}

export function normalizeRecaudacion(rawData: RecaudacionRawRow[]): RecaudacionNormalizedRow[] {
    if (!Array.isArray(rawData) || rawData.length === 0) {
        return [];
    }

    const baseIpc = baseIpcValue(rawData);

    return rawData
        .filter((row) => row.fecha && row.fecha >= '2019-01-01' && row.recaudacion_total != null)
        .map((row) => {
            const year = row.year ?? Number(row.fecha.slice(0, 4));
            const monthStr = row.mes ?? row.fecha.slice(5, 7);
            const monthNum = parseInt(monthStr, 10);
            const pbiMensual = toNullableNumber(row.pbi_trimestral);
            const recaudacionReal = toBasePrices(
                toNullableNumber(row.recaudacion_total ?? null),
                toNullableNumber(row.ipc_nucleo ?? null),
                baseIpc,
            );

            return pbiMensual && recaudacionReal != null
                ? {
                    fecha: `${MONTHS_ES[monthNum - 1]} ${String(year).slice(-2)}`,
                    iso_fecha: row.fecha,
                    mes: monthStr,
                    year,
                    pctPbi: (recaudacionReal / pbiMensual) * 100,
                }
                : null;
        })
        .filter(notNull)
        .sort((a, b) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));
}

export function normalizePoderAdquisitivo(rawData: PoderAdquisitivoRawRow[]): PoderAdquisitivoNormalizedRow[] {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const sorted = [...rawData].sort((a, b) => a.fecha.localeCompare(b.fecha));
    
    const baseIdx = sorted.findIndex(r => r.fecha === '2017-01-01');
    if (baseIdx === -1) return [];

    const baseRow = sorted[baseIdx];
    const ipcBase = toNumber(baseRow.ipc_nucleo);
    if (!ipcBase) return [];

    // Salario informal (negro) reportado 5 meses después corresponde al mes base
    const negroBaseRaw = sorted[baseIdx + 5]?.salario_no_registrado;

    const factors = {
        blanco: toNumber(baseRow.salario_registrado) / ipcBase,
        negro: toNumber(negroBaseRaw) / ipcBase,
        privado: toNumber(baseRow.salario_privado) / ipcBase,
        publico: toNumber(baseRow.salario_publico) / ipcBase,
        ripte: toNumber(baseRow.ripte) / ipcBase,
        jubilacion: toNumber(baseRow.jubilacion_minima) / ipcBase,
    };

    return sorted.map((row, i) => {
        const ipc = toNumber(row.ipc_nucleo);
        if (!ipc) return null;

        const calc = (val: NumericValue, factor: number) => {
            if (val == null || !factor) return null;
            return (Number(val) / ipc / factor) * 100;
        };

        const date = new Date(row.fecha + 'T12:00:00Z');
        return {
            fecha: `${MONTHS_ES[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(-2)}`,
            iso_fecha: row.fecha,
            blanco: calc(row.salario_registrado, factors.blanco),
            negro: calc(sorted[i + 5]?.salario_no_registrado, factors.negro),
            privado: calc(row.salario_privado, factors.privado),
            publico: calc(row.salario_publico, factors.publico),
            ripte: calc(row.ripte, factors.ripte),
            jubilacion: calc(row.jubilacion_minima, factors.jubilacion),
        };
    }).filter(notNull);
}

const normalize = {
    isoToFecha,
    isoToMonthLabel,
    fechaToTimestamp,
    fechaToISO,
    normalizeEmision,
    normalizeEmae,
    normalizeBma,
    normalizeRecaudacion,
    normalizePoderAdquisitivo
};

export default normalize;
