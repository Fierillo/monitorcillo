import type { RecaudacionOfficialReport, RecaudacionRawRow } from '@/types';
import { sql } from '../db/client';
import { buildMonthlyPbiSeries } from '../pbi-source';
import {
    RECAUDACION_COMPONENT_SERIES_IDS,
    RECAUDACION_TAX_MM12_DB_COLUMNS,
    RECAUDACION_TAX_PCT_DB_COLUMNS,
    RECAUDACION_TAX_RAW_KEYS,
    RECAUDACION_TAX_TYPES,
    RECAUDACION_TOTAL_SERIES_ID,
} from '../recaudacion/schema';
import { mergeRecaudacionOfficialReport, parseLatestRecaudacionWorkbookUrl, parseRecaudacionWorkbook } from '../recaudacion-source';
import { fetchEmaeWorkbookRows, fetchPbiAnchorRows } from './cache';
import { RECAUDACION_PAGE_URL } from './constants';
import { fetchBufferFromUrl, fetchFromUrl, fetchTextFromUrl } from './http-client';
import { emaeDesestacionalizadoMap, seriesValueMap, valueAtOrBefore } from './series';

async function fetchRecaudacionOfficialReport(): Promise<RecaudacionOfficialReport> {
    const html = await fetchTextFromUrl(RECAUDACION_PAGE_URL);
    const workbookUrl = parseLatestRecaudacionWorkbookUrl(html);
    if (!workbookUrl) throw new Error('Failed to find latest Recaudacion workbook URL. Verify Hacienda page structure.');

    const report = parseRecaudacionWorkbook(await fetchBufferFromUrl(workbookUrl));
    if (!report) throw new Error(`Failed to parse Recaudacion workbook ${workbookUrl}. Verify Hacienda workbook structure.`);
    return report;
}

function buildRecaudacionRawRow(
    fecha: string,
    values: Partial<RecaudacionRawRow>,
    pbiByFecha: Map<string, number>,
    emaeByFecha: Map<string, number>,
    ipcByFecha: Map<string, number>,
    options: { includeMissingTaxFields?: boolean } = {},
): RecaudacionRawRow {
    const includeMissingTaxFields = options.includeMissingTaxFields ?? false;
    const row: RecaudacionRawRow = {
        fecha,
        mes: fecha.slice(5, 7),
        year: parseInt(fecha.slice(0, 4), 10),
        recaudacion_total: values.recaudacion_total ?? null,
        pbi_trimestral: pbiByFecha.get(fecha) ?? null,
        emae_desestacionalizado: emaeByFecha.get(fecha) ?? null,
        ipc_nucleo: valueAtOrBefore(ipcByFecha, fecha),
    };

    for (const key of RECAUDACION_TAX_RAW_KEYS) {
        if (values[key] !== undefined || includeMissingTaxFields) {
            row[key] = values[key] ?? null;
        }
    }

    return row;
}

function seriesMapAtIndex(rows: Array<readonly unknown[]>, index: number): Map<string, number> {
    return new Map(rows
        .filter((row) => typeof row[0] === 'string' && row[index] != null && row[index] !== '')
        .map((row) => [String(row[0]), Number(row[index])]));
}

export async function ensureRecaudacionTables(): Promise<void> {
    for (const column of RECAUDACION_TAX_RAW_KEYS) {
        await sql.query(`ALTER TABLE recaudacion_raw ADD COLUMN IF NOT EXISTS ${column} NUMERIC`, []);
    }
    for (const column of [...RECAUDACION_TAX_PCT_DB_COLUMNS, ...RECAUDACION_TAX_MM12_DB_COLUMNS, 'pct_pbi_mm12']) {
        await sql.query(`ALTER TABLE recaudacion_normalized ADD COLUMN IF NOT EXISTS ${column} NUMERIC`, []);
    }
}

export async function fetchRecaudacionRawReport(): Promise<{ rows: RecaudacionRawRow[]; publishedAt: string | null }> {
    const seriesIds = [RECAUDACION_TOTAL_SERIES_ID, ...RECAUDACION_COMPONENT_SERIES_IDS].join(',');
    const [recaudacion, pbiAnchors, emae, ipc, officialReport] = await Promise.all([
        fetchFromUrl(`https://apis.datos.gob.ar/series/api/series/?ids=${seriesIds}&limit=5000`),
        fetchPbiAnchorRows(),
        fetchEmaeWorkbookRows(),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INUCLEONAL_DICI_M_19&limit=5000'),
        fetchRecaudacionOfficialReport(),
    ]);

    const emaeByFecha = emaeDesestacionalizadoMap(emae);
    const ipcByFecha = seriesValueMap(ipc.data || []);
    const recaudacionRows = recaudacion.data || [];
    const totalByFecha = seriesMapAtIndex(recaudacionRows, 1);
    const taxByFecha = RECAUDACION_TAX_TYPES.map((tax, index) => ({
        rawKey: tax.rawKey,
        values: seriesMapAtIndex(recaudacionRows, index + 2),
    }));

    const allFechas = new Set<string>([
        ...totalByFecha.keys(),
        ...taxByFecha.flatMap(tax => [...tax.values.keys()]),
        officialReport.row.fecha,
    ]);
    const targetDates = [...allFechas].sort((a, b) => a.localeCompare(b));
    const pbiByFecha = buildMonthlyPbiSeries(pbiAnchors, emae, targetDates);

    const datosGobRows = targetDates.map((fecha) => {
        const taxValues = Object.fromEntries(
            taxByFecha.map(tax => [tax.rawKey, tax.values.get(fecha) ?? null]),
        ) as Partial<RecaudacionRawRow>;

        return buildRecaudacionRawRow(fecha, {
            recaudacion_total: totalByFecha.get(fecha) ?? null,
            ...taxValues,
        }, pbiByFecha, emaeByFecha, ipcByFecha, { includeMissingTaxFields: true });
    }).filter(row => row.recaudacion_total != null || RECAUDACION_TAX_RAW_KEYS.some(key => row[key] != null));

    const officialReportWithMacroFields = {
        ...officialReport,
        row: buildRecaudacionRawRow(officialReport.row.fecha, officialReport.row, pbiByFecha, emaeByFecha, ipcByFecha),
    };

    return {
        rows: mergeRecaudacionOfficialReport(datosGobRows, officialReportWithMacroFields),
        publishedAt: officialReport.publishedAt,
    };
}

export async function fetchRecaudacionRaw(): Promise<RecaudacionRawRow[]> {
    return (await fetchRecaudacionRawReport()).rows;
}
