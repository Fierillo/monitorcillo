const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];
const MONTHS_IDX: Record<string, number> = { ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AGO: 7, SEPT: 8, OCT: 9, NOV: 10, DIC: 11 };

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
        // A buscar - por ahora comento
        series: '143.2_NO_PR_2004_A_16'
    }
};

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

export function normalizeEmae(rawData: any): any[] {
    if (!rawData || !rawData.data || !Array.isArray(rawData.data)) {
        return [];
    }

    const emaeByFecha = new Map<string, { emae?: number; desest?: number; tendencia?: number }>();

    for (const row of rawData.data) {
        const fechaStr = row[0];
        if (!fechaStr || typeof fechaStr !== 'string') continue;
        if (!fechaStr.includes('-')) continue;

        let month = 0;
        try {
            const dateObj = new Date(fechaStr);
            month = dateObj.getUTCMonth();
        } catch {
            continue;
        }
        
        const fecha = `${MONTHS_ES[month]} ${fechaStr.slice(2, 4)}`;
        
        if (!emaeByFecha.has(fecha)) {
            emaeByFecha.set(fecha, {});
        }
        
        const existing = emaeByFecha.get(fecha)!;
        
        if (row[1] !== null && row[1] !== undefined) {
            if (!existing.emae) existing.emae = row[1];
            else if (!existing.desest) existing.desest = row[1];
            else if (!existing.tendencia) existing.tendencia = row[1];
        }
    }

    return Array.from(emaeByFecha.entries())
        .map(([fecha, values]) => ({
            fecha,
            emae: values.emae ?? null,
            emae_desestacionalizado: values.desest ?? null,
            emae_tendencia: values.tendencia ?? null,
        }))
        .sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));
}

export function normalizeBma(rawData: any): any[] {
    if (!rawData || !rawData.data || !Array.isArray(rawData.data)) {
        return [];
    }

    return rawData.data
        .map((row: any) => {
            if (!row[0] || typeof row[0] !== 'string' || !row[0].includes('-')) return null;
            
            let month = 0;
            try {
                const dateObj = new Date(row[0]);
                month = dateObj.getUTCMonth();
            } catch {
                return null;
            }
            
            return {
                fecha: `${MONTHS_ES[month]} ${row[0].slice(2, 4)}`,
                base: row[1],
            };
        })
        .filter((r: any) => r !== null)
        .sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));
}

export function normalizeRecaudacion(rawData: any): any[] {
    if (!rawData || !rawData.data || !Array.isArray(rawData.data)) {
        return [];
    }
    
    const result = rawData.data
        .map((row: any) => {
            if (!row[0] || typeof row[0] !== 'string') return null;
            const fecha = row[0];
            const [yyyy, mm] = fecha.split('-');
            return {
                fecha: `${MONTHS_ES[parseInt(mm) - 1]} ${yyyy.slice(-2)}`,
                mes: mm,
                year: parseInt(yyyy),
                pct_pbi: row[1],
            };
        })
        .filter((r: any) => r !== null)
        .sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));
    return result;
}

export function normalizePoderAdquisitivo(rawData: any): any[] {
    if (!rawData || !rawData.data || !Array.isArray(rawData.data)) {
        return [];
    }
    
    return rawData.data
        .map((row: any) => {
            if (!row[0] || typeof row[0] !== 'string') return null;
            return {
                fecha: row[0],
                value: row[1],
            };
        })
        .filter((r: any) => r !== null)
        .sort((a: any, b: any) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));
}