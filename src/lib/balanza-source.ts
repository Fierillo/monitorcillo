import * as XLSX from 'xlsx';
import type { BalanzaRawRow } from '@/types';
import type { BalanzaSeriesKey } from './balanza/schema';

const MONTHS = new Map([
    ['ene', 1], ['enero', 1],
    ['feb', 2], ['febrero', 2],
    ['mar', 3], ['marzo', 3],
    ['abr', 4], ['abril', 4],
    ['may', 5], ['mayo', 5],
    ['jun', 6], ['junio', 6],
    ['jul', 7], ['julio', 7],
    ['ago', 8], ['agosto', 8],
    ['sep', 9], ['septiembre', 9],
    ['oct', 10], ['octubre', 10],
    ['nov', 11], ['noviembre', 11],
    ['dic', 12], ['diciembre', 12],
]);

type IcaWorkbookUrls = {
    exports: string | null;
    imports: string | null;
};

function workbookRows(buffer: Buffer): unknown[][] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null }) as unknown[][];
}

function numericValue(value: unknown): number | null {
    const cleaned = String(value ?? '').replaceAll(',', '').trim();
    if (!cleaned) return null;
    const numeric = Number(cleaned);
    return Number.isFinite(numeric) ? numeric : null;
}

function normalizedText(value: unknown): string {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function monthNumber(value: unknown): number | null {
    const normalized = normalizedText(value).replace(/[^a-z]/g, '');
    for (const [name, month] of MONTHS) {
        if (normalized.startsWith(name)) return month;
    }
    return null;
}

function toFecha(year: number, month: number): string {
    return `${year}-${String(month).padStart(2, '0')}-01`;
}

function headerColumns(rows: unknown[][], labels: Record<string, string>): { rowIndex: number; columns: Record<string, number> } {
    for (const [rowIndex, row] of rows.entries()) {
        const cells = row.map(normalizedText);
        const columns = Object.fromEntries(Object.entries(labels).map(([key, label]) => [
            key,
            cells.findIndex(cell => cell === label || cell.startsWith(`${label} (`)),
        ]));
        if (Object.values(columns).every(column => column >= 0)) return { rowIndex, columns };
    }

    throw new Error(`Failed to parse ICA workbook. Required headers not found: ${Object.values(labels).join(', ')}. Verify whether INDEC changed the workbook labels.`);
}

function latestAggregateRow(buffer: Buffer): BalanzaRawRow {
    const rows = workbookRows(buffer);
    const { columns } = headerColumns(rows, {
        exportaciones: 'exportaciones',
        importaciones: 'importaciones',
        saldo: 'saldo',
    });
    let year: number | null = null;
    let latest: BalanzaRawRow | null = null;

    for (const row of rows) {
        const rowYear = row.map(value => String(value ?? '').match(/^(\d{4})/)).find(Boolean);
        if (rowYear) year = Number(rowYear[1]);
        const month = row.map(monthNumber).find(value => value != null);
        const exportaciones = numericValue(row[columns.exportaciones]);
        const importaciones = numericValue(row[columns.importaciones]);
        if (!year || !month || exportaciones == null || importaciones == null) continue;

        latest = {
            fecha: toFecha(year, month),
            exportaciones,
            importaciones,
            saldo: numericValue(row[columns.saldo]) ?? exportaciones - importaciones,
        };
    }

    if (latest) return latest;
    throw new Error('Failed to parse ICA aggregate workbook. No complete monthly rows were found. Verify whether INDEC changed the period or value format.');
}

function reportYear(rows: unknown[][]): number {
    const years = rows.slice(0, 10).flatMap(row => row.flatMap(value => Array.from(String(value ?? '').matchAll(/Año\s+(\d{4})/gi), match => Number(match[1]))));
    if (years.length > 0) return Math.max(...years);
    throw new Error('Failed to parse ICA breakdown workbook. The report year was not found. Verify whether INDEC changed the year headers.');
}

function latestBreakdownRow(buffer: Buffer, labels: Partial<Record<BalanzaSeriesKey, string>>): BalanzaRawRow {
    const rows = workbookRows(buffer);
    const year = reportYear(rows);
    const header = headerColumns(rows, labels);
    const starts = Object.values(header.columns).sort((a, b) => a - b);
    const columns = Object.fromEntries(Object.entries(header.columns).map(([key, start]) => {
        const end = starts.find(column => column > start) ?? rows[header.rowIndex].length;
        for (const row of rows.slice(header.rowIndex + 1, header.rowIndex + 8)) {
            for (let column = start; column < end; column += 1) {
                if (normalizedText(row[column]).startsWith(`ano ${year}`)) return [key, column];
            }
        }
        throw new Error(`Failed to parse ICA breakdown workbook. Column for ${labels[key as BalanzaSeriesKey]} in ${year} was not found. Verify whether INDEC changed the year layout.`);
    }));

    let latest: BalanzaRawRow | null = null;
    for (const row of rows) {
        const month = row.map(monthNumber).find(value => value != null);
        if (!month || Object.values(columns).some(column => numericValue(row[column]) == null)) continue;
        latest = { fecha: toFecha(year, month) };
        for (const [key, column] of Object.entries(columns)) latest[key as BalanzaSeriesKey] = numericValue(row[column]);
    }

    if (latest) return latest;
    throw new Error('Failed to parse ICA breakdown workbook. No complete monthly rows were found. Verify whether INDEC changed the period or value format.');
}

function assertTotal(total: unknown, row: BalanzaRawRow, keys: BalanzaSeriesKey[], label: string): void {
    const parts = keys.map(key => Number(row[key]));
    if (parts.some(value => !Number.isFinite(value)) || Math.abs(Number(total) - parts.reduce((sum, value) => sum + value, 0)) > 2) {
        throw new Error(`Failed to validate ICA ${label} breakdown. Its categories do not match the aggregate total. Verify whether INDEC changed the workbook structure.`);
    }
}

export function parseIcaPublicationDate(html: string): string | null {
    const match = html.match(/(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\.\s*Intercambio comercial/i);
    if (!match) return null;

    const day = Number(match[1]);
    const month = Number(match[2]);
    const parsedYear = Number(match[3]);
    if (!day || !month || Number.isNaN(parsedYear)) return null;

    const year = match[3].length === 2 ? 2000 + parsedYear : parsedYear;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseIcaWorkbookUrls(html: string): IcaWorkbookUrls {
    const urls = Array.from(html.matchAll(/href=["']([^"']+\.xls)["']/gi), match => new URL(match[1], 'https://www.indec.gob.ar').toString());
    return {
        exports: urls.find(url => /expo_grandes_rubros_\d{4}_\d{4}\.xls$/i.test(url)) ?? null,
        imports: urls.find(url => /impo_uso_economico_\d{4}_\d{4}\.xls$/i.test(url)) ?? null,
    };
}

export function parseLatestIcaReport(aggregateBuffer: Buffer, exportsBuffer: Buffer, importsBuffer: Buffer): BalanzaRawRow[] {
    const aggregate = latestAggregateRow(aggregateBuffer);
    const exports = latestBreakdownRow(exportsBuffer, {
        expo_pp: 'productos primarios',
        expo_moa: 'manufacturas de origen agropecuario',
        expo_moi: 'manufacturas de origen industrial',
        expo_combustibles: 'combustibles y energia',
    });
    const imports = latestBreakdownRow(importsBuffer, {
        impo_bienes_capital: 'bienes de capital',
        impo_bienes_intermedios: 'bienes intermedios',
        impo_combustibles: 'combustibles y lubricantes basicos y elaborados',
        impo_piezas: 'piezas y accesorios para bienes de capital',
        impo_bienes_consumo: 'bienes de consumo',
        impo_vehiculos: 'vehiculos automotores de pasajeros',
        impo_resto: 'resto',
    });

    if (exports.fecha !== aggregate.fecha || imports.fecha !== aggregate.fecha) {
        throw new Error(`Failed to combine ICA workbooks. Aggregate period is ${aggregate.fecha}, exports period is ${exports.fecha}, and imports period is ${imports.fecha}. Verify that INDEC published matching files.`);
    }
    assertTotal(aggregate.exportaciones, exports, ['expo_pp', 'expo_moa', 'expo_moi', 'expo_combustibles'], 'exports');
    assertTotal(aggregate.importaciones, imports, ['impo_bienes_capital', 'impo_bienes_intermedios', 'impo_combustibles', 'impo_piezas', 'impo_bienes_consumo', 'impo_vehiculos', 'impo_resto'], 'imports');

    return [{
        ...aggregate,
        ...exports,
        ...imports,
        fecha: aggregate.fecha,
    }];
}

export function mergeLatestIcaReport(rows: BalanzaRawRow[], officialRows: BalanzaRawRow[]): BalanzaRawRow[] {
    const byFecha = new Map(rows.map(row => [row.fecha, { ...row }]));
    for (const row of officialRows) byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    return [...byFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}
