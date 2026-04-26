const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];
const MONTHS_IDX: Record<string, number> = { ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AGO: 7, SEPT: 8, SEP: 8, OCT: 9, NOV: 10, DIC: 11 };

const API_CONFIG = {
    emision: {
        bcra_variables: { compra: 78, tc: 4 }
    },
    emae: {
        series: {
            original: '143.3_NO_PR_2004_A_21',
            desest: '143.3_NO_PR_2004_A_31',
            tendencia: '143.3_NO_PR_2004_A_28'
        }
    },
    bma: {
        series: '143.2_NO_PR_2004_A_16'
    }
};

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

export function normalizeEmision(rawData: any[], tcData: any[] = []): any[] {
    const tcByFecha = new Map(tcData.map((d: any) => [d.fecha, d.valor]));
    const byFecha = new Map(rawData.map((d: any) => [d.fecha, d]));

    const merged = Array.from(byFecha.values()).sort((a: any, b: any) => String(a.fecha).localeCompare(String(b.fecha)));

    let runningTotal = 0;
    return merged.map((row: any) => {
        const tc = Number(row.tc ?? tcByFecha.get(row.fecha) ?? 0);
        const compraDolares = Number(row.compra_dolares ?? row.valor ?? 0);
        const bcra = Number(row.bcra ?? (compraDolares * tc));
        const vencimientos = Number(row.vencimientos ?? 0);
        const licitado = Number(row.licitado ?? 0);
        const licitaciones = vencimientos - licitado;
        const resultadoFiscal = Number(row.resultado_fiscal ?? 0);
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

export function normalizeEmae(rawData: any[]): any[] {
    if (!Array.isArray(rawData) || rawData.length === 0) {
        return [];
    }

    const baseRow = rawData.find((row: any) => row.fecha === '2017-01-01');
    if (!baseRow) {
        return [];
    }

    const baseOriginal = baseRow.emae;
    const baseDesest = baseRow.emae_desestacionalizado;
    const baseTendencia = baseRow.emae_tendencia;

    return rawData
        .map((row: any) => {
            if (!row.fecha || typeof row.fecha !== 'string') return null;
            const dateObj = new Date(`${row.fecha}T00:00:00Z`);
            if (Number.isNaN(dateObj.getTime())) return null;

            return {
                fecha: `${MONTHS_ES[dateObj.getUTCMonth()]} ${String(dateObj.getUTCFullYear()).slice(-2)}`,
                iso_fecha: row.fecha,
                emae: baseOriginal ? (row.emae / baseOriginal) * 100 : null,
                emae_desestacionalizado: baseDesest && row.emae_desestacionalizado ? (row.emae_desestacionalizado / baseDesest) * 100 : null,
                emae_tendencia: baseTendencia && row.emae_tendencia ? (row.emae_tendencia / baseTendencia) * 100 : null,
            };
        })
        .filter((row: any) => row !== null)
        .sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));
}

export function normalizeBma(rawData: any[]): any[] {
    if (!Array.isArray(rawData) || rawData.length === 0) {
        return [];
    }

    const MONTHS_NAMES: Record<string, string> = {
        '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR',
        '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AGO',
        '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
    };

    const monthly = new Map<string, {
        bmTotal: number; bmCount: number;
        pasesTotal: number; pasesCount: number;
        leliqTotal: number; leliqCount: number;
        lefiTotal: number; lefiCount: number;
        otrosTotal: number; otrosCount: number;
        depositosTesoroTotal: number; depositosTesoroCount: number;
        pbi_trimestral: number | null;
        emae_desestacionalizado: number | null;
        ipc_nucleo: number | null;
    }>();

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

        const addAverage = (value: any, totalKey: string, countKey: string) => {
            if (value === null || value === undefined) return;
            const numericValue = Number(value);
            if (Number.isNaN(numericValue)) return;
            (bucket as any)[totalKey] += numericValue;
            (bucket as any)[countKey] += 1;
        };

        addAverage(row.base_monetaria, 'bmTotal', 'bmCount');
        addAverage(row.pases, 'pasesTotal', 'pasesCount');
        addAverage(row.leliq, 'leliqTotal', 'leliqCount');
        addAverage(row.lefi, 'lefiTotal', 'lefiCount');
        addAverage(row.otros, 'otrosTotal', 'otrosCount');

        if (row.depositos_tesoro !== null && row.depositos_tesoro !== undefined) {
            const numericDeposito = Number(row.depositos_tesoro);
            if (!Number.isNaN(numericDeposito)) {
                bucket.depositosTesoroTotal += numericDeposito;
                bucket.depositosTesoroCount += 1;
            }
        }

        if (row.pbi_trimestral != null) bucket.pbi_trimestral = Number(row.pbi_trimestral);
        if (row.emae_desestacionalizado != null) bucket.emae_desestacionalizado = Number(row.emae_desestacionalizado);
        if (row.ipc_nucleo != null) bucket.ipc_nucleo = Number(row.ipc_nucleo);

        monthly.set(monthKey, bucket);
    }

    const emaeMap: Record<string, number> = {};
    const ipcMap: Record<string, number> = {};
    for (const row of rawData) {
        if (row.fecha && row.emae_desestacionalizado != null) {
            emaeMap[row.fecha] = Number(row.emae_desestacionalizado);
        }
        if (row.fecha && row.ipc_nucleo != null) {
            ipcMap[row.fecha] = Number(row.ipc_nucleo);
        }
    }

    const pivotRow = [...rawData].reverse().find(r => r.pbi_trimestral != null);
    const pivotPbi = pivotRow ? Number(pivotRow.pbi_trimestral) : null;
    const pivotEmae = pivotRow ? Number(pivotRow.emae_desestacionalizado) : null;
    const pivotIpc = pivotRow ? Number(pivotRow.ipc_nucleo) : null;

    const fallbackEmae = Object.values(emaeMap).slice(-1)[0] || null;
    const fallbackIpc = Object.values(ipcMap).slice(-1)[0] || null;

    let lastKnownPbi: number | null = null;

    const result = Array.from(monthly.entries())
        .map(([monthKey, bucket]) => {
            const [yyyy, mm] = monthKey.split('-');
            if (!MONTHS_NAMES[mm]) return null;

            const year = parseInt(yyyy, 10);
            const emaeBase = emaeMap[`${year}-01-01`] || fallbackEmae;
            const ipcBase = ipcMap[`${year}-01-01`] || fallbackIpc;
            
            if (bucket.pbi_trimestral != null) lastKnownPbi = bucket.pbi_trimestral;
            const pbiTrimestral = bucket.pbi_trimestral ?? lastKnownPbi;
            
            const emaeActual = bucket.emae_desestacionalizado ?? fallbackEmae;
            const ipcActual = bucket.ipc_nucleo ?? fallbackIpc;

            let pbiAnualizado = pbiTrimestral;

            if (!pbiAnualizado && pivotPbi && pivotEmae && pivotIpc && emaeActual && ipcActual) {
                pbiAnualizado = pivotPbi * (emaeActual / pivotEmae) * (ipcActual / pivotIpc);
            } else if (pbiTrimestral && emaeBase && emaeActual && ipcBase && ipcActual) {
                pbiAnualizado = pbiTrimestral * (emaeActual / emaeBase) * (ipcActual / ipcBase);
            }

            const calcPct = (val: number | null) => {
                if (val == null || !pbiAnualizado) return null;
                return (val / pbiAnualizado) * 100;
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
        .filter((r: any) => r !== null)
        .sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));

    return result;
}

export function normalizeRecaudacion(rawData: any[]): any[] {
    if (!Array.isArray(rawData) || rawData.length === 0) {
        return [];
    }

    const emaeMap: Record<string, number> = {};
    const ipcMap: Record<string, number> = {};
    for (const row of rawData) {
        if (row.fecha && row.emae_desestacionalizado != null) {
            emaeMap[row.fecha] = Number(row.emae_desestacionalizado);
        }
        if (row.fecha && row.ipc_nucleo != null) {
            ipcMap[row.fecha] = Number(row.ipc_nucleo);
        }
    }
    const fallbackEmaeBase = emaeMap['2024-01-01'] || Object.values(emaeMap)[0] || null;
    const fallbackIpcBase = ipcMap['2024-01-01'] || Object.values(ipcMap)[0] || null;

    let lastKnownPbi: number | null = null;

    return rawData
        .filter((row: any) => row.fecha && row.fecha >= '2019-01-01' && row.recaudacion_total != null)
        .map((row: any) => {
            const year = row.year;
            const monthStr = row.mes;
            const monthNum = parseInt(monthStr, 10);
            const emaeBase = emaeMap[`${year}-01-01`] || fallbackEmaeBase;
            const ipcBase = ipcMap[`${year}-01-01`] || fallbackIpcBase;
            
            if (row.pbi_trimestral != null) lastKnownPbi = row.pbi_trimestral;

            const pbiTrimestral = row.pbi_trimestral ?? lastKnownPbi;
            const emaeDesest = row.emae_desestacionalizado ?? Object.values(emaeMap).slice(-1)[0];
            const ipcActual = row.ipc_nucleo ?? Object.values(ipcMap).slice(-1)[0];

            const pbiAnualizado = pbiTrimestral && emaeBase && emaeDesest && ipcBase && ipcActual
                ? pbiTrimestral * (emaeDesest / emaeBase) * (ipcActual / ipcBase)
                : pbiTrimestral;

            const pbiMensual = pbiAnualizado ? pbiAnualizado / 12 : null;

            return pbiMensual
                ? {
                    fecha: `${MONTHS_ES[monthNum - 1]} ${String(year).slice(-2)}`,
                    iso_fecha: row.fecha,
                    mes: monthStr,
                    year,
                    pctPbi: (row.recaudacion_total / pbiMensual) * 100,
                }
                : null;
        })
        .filter((row: any) => row !== null)
        .sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));
}

export function normalizePoderAdquisitivo(rawData: any[]): any[] {
    if (!Array.isArray(rawData) || rawData.length === 0) {
        return [];
    }

    const baseRow = rawData.find((row: any) => row.fecha === '2017-01-01');
    if (!baseRow || !baseRow.ipc_nucleo) {
        return [];
    }

    const baseFactor = (value: number | null | undefined) => {
        if (value == null || baseRow.ipc_nucleo === 0) return null;
        return value / baseRow.ipc_nucleo;
    };

    const baseRegistrado = baseFactor(baseRow.salario_registrado);
    const baseNoRegistrado = baseFactor(baseRow.salario_no_registrado);
    const basePrivado = baseFactor(baseRow.salario_privado);
    const basePublico = baseFactor(baseRow.salario_publico);
    const baseRipte = baseFactor(baseRow.ripte);
    const baseJubilacion = baseFactor(baseRow.jubilacion_minima);

    const normalized = rawData
        .map((row: any) => {
            if (!row.fecha || row.ipc_nucleo == null || row.ipc_nucleo === 0) return null;
            const dateObj = new Date(`${row.fecha}T00:00:00Z`);
            if (Number.isNaN(dateObj.getTime())) return null;

            const calc = (value: number | null | undefined, base: number | null) => {
                if (value == null || base == null) return null;
                return ((value / row.ipc_nucleo) / base) * 100;
            };

            return {
                fecha: `${MONTHS_ES[dateObj.getUTCMonth()]} ${String(dateObj.getUTCFullYear()).slice(-2)}`,
                iso_fecha: row.fecha,
                blanco: calc(row.salario_registrado, baseRegistrado),
                negro: calc(row.salario_no_registrado, baseNoRegistrado),
                privado: calc(row.salario_privado, basePrivado),
                publico: calc(row.salario_publico, basePublico),
                ripte: calc(row.ripte, baseRipte),
                jubilacion: calc(row.jubilacion_minima, baseJubilacion),
            };
        })
        .filter((row: any) => row !== null)
        .sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));

    return normalized.map((row: any, index: number) => ({
        ...row,
        negro: normalized[index + 5]?.negro ?? null,
    }));
}

export default {
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
