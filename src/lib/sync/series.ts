import type { DatosGobSeriesRow, EmaeRawRow } from '@/types';

export function seriesValueMap(rows: DatosGobSeriesRow[]): Map<string, number> {
    return new Map(rows
        .filter((row) => typeof row[0] === 'string' && row[1] != null)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map((row) => [row[0], Number(row[1])]));
}

export function valueAtOrBefore(valuesByFecha: Map<string, number>, fecha: string): number | null {
    let value: number | null = null;

    for (const [candidateFecha, candidateValue] of valuesByFecha) {
        if (candidateFecha > fecha) break;
        value = candidateValue;
    }

    return value;
}

export function emaeDesestacionalizadoMap(rows: EmaeRawRow[]): Map<string, number> {
    return new Map(rows
        .filter((row) => row.emae_desestacionalizado != null)
        .map((row) => [row.fecha, Number(row.emae_desestacionalizado)]));
}
