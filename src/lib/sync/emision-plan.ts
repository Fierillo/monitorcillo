import type { EmisionRawRow } from '@/types';
import { fechaToISO } from '../normalize';

export function normalizeEmisionStoredRow(row: EmisionRawRow): EmisionRawRow {
    return {
        fecha: typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(row.fecha),
        compra_dolares: Number(row.compra_dolares ?? 0),
        tc: row.tc === null || row.tc === undefined || row.tc === '' ? undefined : Number(row.tc),
        bcra: Number(row.bcra ?? 0),
        vencimientos: Number(row.vencimientos ?? 0),
        licitado: Number(row.licitado ?? 0),
        resultado_fiscal: Number(row.resultado_fiscal ?? 0),
    };
}

export function planEmisionRawUpserts(
    existing: readonly EmisionRawRow[],
    apiRows: readonly EmisionRawRow[],
): { upserts: Array<Partial<EmisionRawRow>>; appended: number } {
    const stored = existing.map(normalizeEmisionStoredRow);
    const existingByFecha = new Map(stored.map(row => [row.fecha, row]));
    const upserts = apiRows.flatMap((row): Array<Partial<EmisionRawRow>> => {
        const current = existingByFecha.get(row.fecha);
        if (!current) return [{ ...row, vencimientos: 0, licitado: 0, resultado_fiscal: 0 }];
        const apiChanged = current.compra_dolares !== row.compra_dolares
            || current.tc !== row.tc
            || current.bcra !== row.bcra;
        return apiChanged
            ? [{ fecha: row.fecha, compra_dolares: row.compra_dolares, tc: row.tc, bcra: row.bcra }]
            : [];
    });

    const existingFechas = new Set(stored.map(row => row.fecha));
    return {
        upserts,
        appended: apiRows.filter(row => !existingFechas.has(row.fecha)).length,
    };
}
