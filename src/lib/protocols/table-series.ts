import { parsePeriod, type PeriodFormat } from '../normalize/dates';
import { parseNumber, type NumberFormat } from '../normalize/numbers';
import { normalizeText } from '../normalize/text';
import { fetchBufferFromUrl } from '../sync/http-client';
import { firstSheetRows } from './workbook';

/** Content types official servers use for CSV files; anything else (e.g. an HTML error page) is rejected. */
const CSV_CONTENT_TYPE = /csv|text\/plain|octet-stream/i;

type RowFilter = Record<string, string>;

/** Declares one monthly series in a long CSV table: where it lives and which cells to read. */
export type TableSeriesSpec<K extends string> = {
    url: string;
    date: { column: string; format: PeriodFormat };
    numberFormat: NumberFormat;
    /** Column → cell value a row must have; compared without case or accents. */
    where?: RowFilter;
    /** Each field's value column; its own filter picks its rows in long tables (one row per series and period). */
    fields: Record<K, { column: string; where?: RowFilter }>;
};

export type TableSeriesRow<K extends string> = { fecha: string } & Record<K, number | null>;

/** Rows (header first) → one row per period with the declared fields, sorted by fecha; periods without any value are skipped. */
export function parseTableSeries<K extends string>([header = [], ...rows]: unknown[][], spec: TableSeriesSpec<K>): TableSeriesRow<K>[] {
    const headers = header.map(normalizeText);
    const column = (name: string) => {
        const index = headers.indexOf(normalizeText(name));
        if (index < 0) throw new Error(`Failed to parse table series ${spec.url}. Missing column ${name}.`);
        return index;
    };
    const filter = (where: RowFilter = {}) => Object.entries(where).map(([name, value]) => [column(name), normalizeText(value)] as const);
    const matches = (row: unknown[], conditions: ReturnType<typeof filter>) => conditions.every(([index, value]) => normalizeText(row[index]) === value);
    const dateColumn = column(spec.date.column);
    const rowFilter = filter(spec.where);
    const fields = (Object.entries(spec.fields) as Array<[K, { column: string; where?: RowFilter }]>)
        .map(([key, field]) => ({ key, index: column(field.column), where: filter(field.where) }));

    const byFecha = new Map<string, TableSeriesRow<K>>();
    for (const row of rows) {
        const fecha = parsePeriod(row[dateColumn], spec.date.format);
        const found = fecha && matches(row, rowFilter) ? fields.filter(field => matches(row, field.where)) : [];
        if (!fecha || found.length === 0) continue;
        const current = byFecha.get(fecha) ?? { fecha, ...Object.fromEntries(fields.map(field => [field.key, null])) } as TableSeriesRow<K>;
        for (const field of found) current[field.key] = parseNumber(row[field.index], spec.numberFormat) as TableSeriesRow<K>[K];
        byFecha.set(fecha, current);
    }
    return [...byFecha.values()]
        .filter(row => fields.some(field => row[field.key] != null))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Downloads the declared CSV and reads its series; the delimiter and encoding are detected by the workbook reader. */
export async function fetchTableSeries<K extends string>(spec: TableSeriesSpec<K>): Promise<TableSeriesRow<K>[]> {
    return parseTableSeries(firstSheetRows(await fetchBufferFromUrl(spec.url, { expectedContentType: CSV_CONTENT_TYPE })), spec);
}
