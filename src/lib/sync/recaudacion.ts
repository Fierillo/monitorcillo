import type { RecaudacionOfficialReport, RecaudacionRawRow } from '@/types';
import { buildMonthlyPbiSeries } from '../pbi-source';
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
    recaudacionTotal: RecaudacionRawRow['recaudacion_total'],
    pbiByFecha: Map<string, number>,
    emaeByFecha: Map<string, number>,
    ipcByFecha: Map<string, number>,
): RecaudacionRawRow {
    return {
        fecha,
        mes: fecha.slice(5, 7),
        year: parseInt(fecha.slice(0, 4), 10),
        recaudacion_total: recaudacionTotal ?? null,
        pbi_trimestral: pbiByFecha.get(fecha) ?? null,
        emae_desestacionalizado: emaeByFecha.get(fecha) ?? null,
        ipc_nucleo: valueAtOrBefore(ipcByFecha, fecha),
    };
}

export async function fetchRecaudacionRawReport(): Promise<{ rows: RecaudacionRawRow[]; publishedAt: string | null }> {
    const [recaudacion, pbiAnchors, emae, ipc, officialReport] = await Promise.all([
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=172.3_TL_RECAION_M_0_0_17&limit=5000'),
        fetchPbiAnchorRows(),
        fetchEmaeWorkbookRows(),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INUCLEONAL_DICI_M_19&limit=5000'),
        fetchRecaudacionOfficialReport(),
    ]);

    const emaeByFecha = emaeDesestacionalizadoMap(emae);
    const ipcByFecha = seriesValueMap(ipc.data || []);
    const recaudacionRows = recaudacion.data || [];
    const targetDates = [...recaudacionRows.map(row => row[0]), officialReport.row.fecha];
    const pbiByFecha = buildMonthlyPbiSeries(pbiAnchors, emae, targetDates);
    const datosGobRows = recaudacionRows.map((row) => buildRecaudacionRawRow(row[0], row[1] ?? null, pbiByFecha, emaeByFecha, ipcByFecha));
    const officialReportWithMacroFields = {
        ...officialReport,
        row: buildRecaudacionRawRow(officialReport.row.fecha, officialReport.row.recaudacion_total ?? null, pbiByFecha, emaeByFecha, ipcByFecha),
    };

    return {
        rows: mergeRecaudacionOfficialReport(datosGobRows, officialReportWithMacroFields),
        publishedAt: officialReport.publishedAt,
    };
}

export async function fetchRecaudacionRaw(): Promise<RecaudacionRawRow[]> {
    return (await fetchRecaudacionRawReport()).rows;
}
