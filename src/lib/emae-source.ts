import type { EmaeRawRow } from '@/types';
import { readWorkbook, sheetRows, type TableSeriesRow, type TableSeriesSpec } from './protocols';
import { EMAE_SECTORS } from './emae/schema';
import { normalizeText } from './normalize/text';
import { isoDate, monthNumber } from './normalize/dates';
import { parseNumber } from './normalize/numbers';

function normalizedIncludes(value: unknown, expected: string): boolean {
    return normalizeText(value).includes(normalizeText(expected));
}

export function parseEmaeWorkbook(buffer: Buffer): EmaeRawRow[] {
    const workbook = readWorkbook(buffer);
    const rows = sheetRows(workbook.Sheets.EMAE ?? workbook.Sheets[workbook.SheetNames[0]]);
    const parsedRows: EmaeRawRow[] = [];
    let year: number | null = null;

    for (const row of rows) {
        const yearValue = String(row[0] ?? '').trim();
        if (/^\d{4}$/.test(yearValue)) year = Number(yearValue);

        const month = monthNumber(row[1]);
        if (!year || !month) continue;

        const emae = parseNumber(row[2], 'en');
        const emaeDesestacionalizado = parseNumber(row[4], 'en');
        const emaeTendencia = parseNumber(row[6], 'en');

        if (emae == null && emaeDesestacionalizado == null && emaeTendencia == null) continue;

        parsedRows.push({
            fecha: isoDate(year, month, 1),
            emae,
            emae_desestacionalizado: emaeDesestacionalizado,
            emae_tendencia: emaeTendencia,
        });
    }

    return parsedRows.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** datos.gob.ar EMAE base 1993: seasonally adjusted index since 1993, linked to the INDEC workbook by prependHistoricalEmae. */
export const EMAE_HISTORICAL_CSV: TableSeriesSpec<'emae_desestacionalizado'> = {
    url: 'https://infra.datos.gob.ar/catalog/sspm/dataset/10/distribution/10.3/download/emae-valores-mensuales-indice-base-1993.csv',
    date: { column: 'indice_tiempo', format: 'iso' },
    numberFormat: 'en',
    fields: { emae_desestacionalizado: { column: 'indice_serie_desestacionalizada' } },
};

export function prependHistoricalEmae(currentRows: EmaeRawRow[], historicalRows: TableSeriesRow<'emae_desestacionalizado'>[]): EmaeRawRow[] {
    const sortedCurrentRows = [...currentRows].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const firstCurrentRow = sortedCurrentRows.find(row => typeof row.emae_desestacionalizado === 'number');
    if (!firstCurrentRow) return sortedCurrentRows;

    const historicalByDate = new Map(historicalRows.flatMap(row => row.emae_desestacionalizado == null ? [] : [[row.fecha, row.emae_desestacionalizado] as const]));
    const overlapValue = historicalByDate.get(firstCurrentRow.fecha);
    const currentValue = firstCurrentRow.emae_desestacionalizado;
    if (!overlapValue || typeof currentValue !== 'number' || currentValue === 0) return sortedCurrentRows;

    const linkFactor = currentValue / overlapValue;
    const earlierRows: EmaeRawRow[] = Array.from(historicalByDate)
        .filter(([date]) => date < firstCurrentRow.fecha)
        .map(([fecha, value]) => ({ fecha, emae_desestacionalizado: value * linkFactor }));

    return [...earlierRows, ...sortedCurrentRows];
}

export function parseEmaeSectorWorkbook(buffer: Buffer): EmaeRawRow[] {
    const rows = sheetRows(readWorkbook(buffer).Sheets['Tabla Letras']);
    const headerRow = rows.find(row => EMAE_SECTORS.some(sector => row.some(cell => normalizedIncludes(cell, sector.header))));
    if (!headerRow) return [];

    const columnByKey = new Map<string, number>();
    for (const sector of EMAE_SECTORS) {
        const index = headerRow.findIndex(cell => normalizedIncludes(cell, sector.header));
        if (index >= 0) columnByKey.set(sector.key, index);
    }

    const parsedRows: EmaeRawRow[] = [];
    let year: number | null = null;

    for (const row of rows) {
        const yearValue = String(row[0] ?? '').trim();
        if (/^\d{4}$/.test(yearValue)) year = Number(yearValue);

        const month = monthNumber(row[1]);
        if (!year || !month) continue;

        const parsedRow: EmaeRawRow = { fecha: isoDate(year, month, 1) };
        for (const sector of EMAE_SECTORS) {
            const column = columnByKey.get(sector.key);
            if (column == null) continue;
            parsedRow[sector.key] = parseNumber(row[column], 'en');
        }

        if (EMAE_SECTORS.some(sector => parsedRow[sector.key] != null)) parsedRows.push(parsedRow);
    }

    return parsedRows.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseEmaePublicationDate(html: string): string | null {
    const match = html.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\.\s*Estimador mensual de actividad/i);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const parsedYear = Number(match[3]);
    if (!day || !month || Number.isNaN(parsedYear)) return null;

    const year = match[3].length === 2 ? 2000 + parsedYear : parsedYear;
    return isoDate(year, month, day);
}
