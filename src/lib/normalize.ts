const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];
const MONTHS_IDX: Record<string, number> = { ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AGO: 7, SEPT: 8, OCT: 9, NOV: 10, DIC: 11 };

export function isoToFecha(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}

export function fechaToTimestamp(fecha: string): number {
    const parts = fecha.split(' ');
    if (parts.length < 3) return 0;
    return new Date(2000 + parseInt(parts[2]), MONTHS_IDX[parts[1]], parseInt(parts[0])).getTime();
}

export function fechaToISO(fecha: string): string {
    const parts = fecha.split(' ');
    if (parts.length < 3) return '';
    return `20${parts[2]}-${String(MONTHS_IDX[parts[1]] + 1).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
}

export function normalizeEmision(rawData: any[], tcData: any[] = []): any[] {
    const tcByFecha = new Map(tcData.map((d: any) => [d.fecha, d.valor]));
    const byFecha = new Map(rawData.map((d: any) => [d.fecha, d]));

    const merged = Array.from(byFecha.values()).sort((a: any, b: any) => 
        fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha)
    );

    let runningTotal = 0;
    const result = merged.map((r: any) => {
        const tc = tcByFecha.get(r.fecha) ?? 0;
        const compraDolares = r.valor ?? 0;
        const bcra = compraDolares * tc;

        if (r.acumulado !== undefined && r.acumulado !== null) {
            runningTotal = r.acumulado;
        } else {
            runningTotal += bcra ?? 0;
            r.acumulado = runningTotal;
        }

        return {
            fecha: isoToFecha(r.fecha),
            value: bcra,
            acumulado: r.acumulado,
            tc,
            compra_dolares: compraDolares,
            bcra,
        };
    });

    return result;
}

export function normalizeEmae(rawData: any[]): any[] {
    const months: Record<string, string> = {
        '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR', '05': 'MAY', '06': 'JUN',
        '07': 'JUL', '08': 'AGO', '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
    };

    const emaeByFecha = new Map<string, { emae: number; desest?: number; tendencia?: number }>();

    for (const s of rawData) {
        const fecha = `${months[s.fecha.slice(5, 7)]} ${s.fecha.slice(2, 4)}`;
        
        if (s.indice === 'tcm_2006.4_m_23_37') {
            emaeByFecha.set(fecha, { emae: s.valor });
        } else if (s.indice === 'tcm_2006.4_m_23_38' && emaeByFecha.has(fecha)) {
            emaeByFecha.get(fecha)!.desest = s.valor;
        } else if (s.indice === 'tcm_2006.4_m_23_39' && emaeByFecha.has(fecha)) {
            emaeByFecha.get(fecha)!.tendencia = s.valor;
        }
    }

    const result = Array.from(emaeByFecha.entries())
        .map(([fecha, values]) => ({
            fecha,
            emae: values.emae,
            emae_desestacionalizado: values.desest,
            emae_tendencia: values.tendencia,
        }))
        .sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));

    return result;
}

export function normalizeBma(rawData: any[]): any[] {
    const months: Record<string, string> = {
        '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR', '05': 'MAY', '06': 'JUN',
        '07': 'JUL', '08': 'AGO', '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
    };

    const result = rawData
        .map((s: any) => ({
            fecha: `${months[s.fecha.slice(5, 7)]} ${s.fecha.slice(2, 4)}`,
            base: s.valor,
        }))
        .sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));

    return result;
}

export function normalizeRecaudacion(rawData: any[]): any[] {
    const months: Record<string, string> = {
        '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR', '05': 'MAY', '06': 'JUN',
        '07': 'JUL', '08': 'AGO', '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
    };

    const result = rawData
        .map((r: any) => ({
            fecha: `${months[r.mes]} ${String(r.year).slice(-2)}`,
            mes: r.mes,
            year: r.year,
            pct_pbi: r.pctPbi,
        }))
        .sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));

    return result;
}

export function normalizePoderAdquisitivo(rawData: any[]): any[] {
    const result = rawData
        .map((r: any) => ({
            fecha: r.fecha,
            blanco: r.blanco,
            negro: r.negro,
            privado: r.privado,
            publico: r.publico,
            ripte: r.ripte,
            jubilacion: r.jubilacion,
        }))
        .sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));

    return result;
}