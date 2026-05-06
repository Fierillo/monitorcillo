import https from 'https';
import * as XLSX from 'xlsx';
import { getRawData, saveRawData, saveIndicatorsCatalog, replaceRawData, replaceNormalizedData, saveIndicatorPublication } from './db';
import { normalizeEmision, normalizeEmae, normalizeBma, normalizeRecaudacion, normalizePoderAdquisitivo, fechaToISO } from './normalize';
import { buildCurrentIndicatorsCatalog } from './catalog-service';
import { runSyncTasks } from './sync-runner';
import { parseEmaePublicationDate, parseEmaeWorkbook } from './emae-source';
import { buildMonthlyPbiSeries, parseLatestPbiWorkbookUrl, parsePbiWorkbook } from './pbi-source';
import { mergeRecaudacionOfficialReport, parseLatestRecaudacionWorkbookUrl, parseRecaudacionWorkbook } from './recaudacion-source';
import { parseSalaryPublicationDate } from './salary-source';
import type {
    BcraApiResponse,
    BcraVariablePage,
    BcraVariableRow,
    BmaRawRow,
    DatosGobApiResponse,
    DatosGobSeriesRow,
    EmaeRawRow,
    EmisionRawRow,
    IndicatorType,
    PbiAnchorRow,
    PoderAdquisitivoRawRow,
    RecaudacionOfficialReport,
    RecaudacionRawRow,
    SyncResult,
    SyncResults,
} from '@/types';

const WEEKLY_BALANCE_WORKBOOK_URL = 'https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas/Serieanual.xls';
const EMAE_WORKBOOK_URL = 'https://www.indec.gob.ar/ftp/cuadros/economia/sh_emae_mensual_base2004.xls';
const EMAE_PUBLICATION_PAGE_URL = 'https://www.indec.gob.ar/Nivel4/Tema/3/9/48';
const PBI_PAGE_URL = 'https://www.indec.gob.ar/Nivel4/Tema/3/9/47';
const RECAUDACION_PAGE_URL = 'https://www.argentina.gob.ar/economia/ingresospublicos/dniaf/recaudacion';
const SALARY_PUBLICATION_PAGE_URL = 'https://www.indec.gob.ar/Nivel4/Tema/4/31/61';
const WEEKLY_TREASURY_SERIES_REGEX = /DEPOSITOS DEL GOBIERNO NACIONAL Y OTROS/i;
let emaeWorkbookRowsPromise: Promise<EmaeRawRow[]> | null = null;
let pbiAnchorRowsPromise: Promise<PbiAnchorRow[]> | null = null;
const ENGLISH_MONTHS: Record<string, number> = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
};

function fetchFromUrl(url: string): Promise<DatosGobApiResponse> {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data) as DatosGobApiResponse;
                        resolve(parsed);
                    } catch {
                        resolve({ data: [] });
                    }
                } else {
                    resolve({ data: [] });
                }
            });
        }).on('error', () => resolve({ data: [] }));
    });
}

function fetchBufferFromUrl(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                reject(new Error(`Failed to download ${url}. Status ${res.statusCode}`));
                return;
            }

            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

function fetchTextFromUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                reject(new Error(`Failed to download ${url}. Status ${res.statusCode}`));
                return;
            }

            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function fetchEmaeWorkbookRows(): Promise<EmaeRawRow[]> {
    emaeWorkbookRowsPromise ??= fetchBufferFromUrl(EMAE_WORKBOOK_URL).then((buffer) => {
        const rows = parseEmaeWorkbook(buffer);
        if (rows.length === 0) {
            throw new Error('Failed to parse EMAE workbook. No data rows found. Verify INDEC workbook structure.');
        }

        return rows;
    });

    return emaeWorkbookRowsPromise;
}

async function fetchPbiAnchorRows(): Promise<PbiAnchorRow[]> {
    pbiAnchorRowsPromise ??= fetchTextFromUrl(PBI_PAGE_URL).then(async (html) => {
        const workbookUrl = parseLatestPbiWorkbookUrl(html);
        if (!workbookUrl) {
            throw new Error('Failed to find latest PBI workbook URL. Verify INDEC PBI page structure.');
        }

        const rows = parsePbiWorkbook(await fetchBufferFromUrl(workbookUrl));
        if (rows.length === 0) {
            throw new Error(`Failed to parse PBI workbook ${workbookUrl}. Verify INDEC workbook structure.`);
        }

        return rows;
    });

    return pbiAnchorRowsPromise;
}

function parseWorkbookWeeklyDate(value: unknown): string | null {
    if (!value) return null;
    const raw = String(value).trim();
    const match = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/);
    if (!match) return null;

    const day = Number(match[1]);
    const month = ENGLISH_MONTHS[match[2]];
    const yearShort = Number(match[3]);
    if (!month || Number.isNaN(day) || Number.isNaN(yearShort)) return null;
    const year = yearShort >= 50 ? 1900 + yearShort : 2000 + yearShort;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseWorkbookTreasuryValue(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const sanitized = String(value).trim().replace(/[,.]/g, '');
    if (!sanitized) return null;
    const numericValue = Number(sanitized);
    if (Number.isNaN(numericValue)) return null;
    return numericValue / 1000;
}

function extractWeeklyGovernmentDepositsSeries(workbookBuffer: Buffer, fromDate: string): Array<{ fecha: string; valor: number }> {
    const workbook = XLSX.read(workbookBuffer, { type: 'buffer' });
    const byFecha = new Map<string, number>();

    for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null }) as unknown[][];
        const headerRow = rows.find((row) => row.some((cell) => parseWorkbookWeeklyDate(cell)));
        const treasuryRow = rows.find((row) => WEEKLY_TREASURY_SERIES_REGEX.test(String(row[0] ?? '')));

        if (!headerRow || !treasuryRow) continue;

        for (let column = 1; column < headerRow.length; column += 1) {
            const fecha = parseWorkbookWeeklyDate(headerRow[column]);
            if (!fecha || fecha < fromDate) continue;

            const valor = parseWorkbookTreasuryValue(treasuryRow[column]);
            if (valor == null) continue;

            byFecha.set(fecha, valor);
        }
    }

    return Array.from(byFecha.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([fecha, valor]) => ({ fecha, valor }));
}

async function fetchRecaudacionOfficialReport(): Promise<RecaudacionOfficialReport> {
    const html = await fetchTextFromUrl(RECAUDACION_PAGE_URL);
    const workbookUrl = parseLatestRecaudacionWorkbookUrl(html);
    if (!workbookUrl) {
        throw new Error('Failed to find latest Recaudacion workbook URL. Verify Hacienda page structure.');
    }

    const workbook = await fetchBufferFromUrl(workbookUrl);
    const report = parseRecaudacionWorkbook(workbook);
    if (!report) {
        throw new Error(`Failed to parse Recaudacion workbook ${workbookUrl}. Verify Hacienda workbook structure.`);
    }

    return report;
}

function fetchBcraVariablePage(idVariable: number, from: string, to: string, offset: number): Promise<BcraVariablePage> {
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${idVariable}?Desde=${from}&Hasta=${to}&limit=3000&offset=${offset}`;

    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data) as BcraApiResponse;
                        resolve({
                            detalle: parsed.results?.[0]?.detalle || [],
                            count: parsed.metadata?.resultset?.count || 0,
                            limit: parsed.metadata?.resultset?.limit || 3000,
                        });
                    } catch {
                        resolve({ detalle: [], count: 0, limit: 3000 });
                    }
                } else {
                    resolve({ detalle: [], count: 0, limit: 3000 });
                }
            });
        }).on('error', () => resolve({ detalle: [], count: 0, limit: 3000 }));
    });
}

async function fetchBcraVariable(idVariable: number, from: string, to: string): Promise<BcraVariableRow[]> {
    const allRows: BcraVariableRow[] = [];
    let offset = 0;
    let count = 0;
    let limit = 3000;

    do {
        const page = await fetchBcraVariablePage(idVariable, from, to, offset);
        allRows.push(...page.detalle);
        count = page.count;
        limit = page.limit;
        offset += limit;
    } while (offset < count);

    return allRows;
}

export async function fetchEmisionRaw(from: string, to: string): Promise<{ compraData: BcraVariableRow[]; tcData: BcraVariableRow[] }> {
    const [compraData, tcData] = await Promise.all([
        fetchBcraVariable(78, from, to),
        fetchBcraVariable(4, from, to),
    ]);

    return { compraData, tcData };
}

export async function fetchEmaeRaw(): Promise<{ rows: EmaeRawRow[]; publishedAt: string | null }> {
    const [rows, publicationHtml] = await Promise.all([
        fetchEmaeWorkbookRows(),
        fetchTextFromUrl(EMAE_PUBLICATION_PAGE_URL),
    ]);

    const publishedAt = parseEmaePublicationDate(publicationHtml);
    if (!publishedAt) {
        throw new Error('Failed to parse EMAE publication date. Verify INDEC publication page structure.');
    }

    return { rows, publishedAt };
}

export async function fetchBmaRaw(): Promise<BmaRawRow[]> {
    const today = new Date();
    const toDate = today.toISOString().split('T')[0];
    const fromDate = '2017-01-01';

    const [baseMonetaria, pases, leliq, lefi, otros, weeklyWorkbook, pbiAnchors, emae, ipc] = await Promise.all([
        fetchBcraVariable(15, fromDate, toDate),
        fetchBcraVariable(152, fromDate, toDate),
        fetchBcraVariable(155, fromDate, toDate),
        fetchBcraVariable(196, fromDate, toDate),
        fetchBcraVariable(198, fromDate, toDate),
        fetchBufferFromUrl(WEEKLY_BALANCE_WORKBOOK_URL),
        fetchPbiAnchorRows(),
        fetchEmaeWorkbookRows(),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INUCLEONAL_DICI_M_19&limit=5000'),
    ]);

    const depositosTesoro = extractWeeklyGovernmentDepositsSeries(weeklyWorkbook, fromDate);

    const byFecha = new Map<string, BmaRawRow>();

    const mergeSeries = (items: BcraVariableRow[], field: Exclude<keyof BmaRawRow, 'fecha'>) => {
        for (const item of items) {
            if (!item?.fecha) continue;
            const row = byFecha.get(item.fecha) ?? { fecha: item.fecha };
            row[field] = item.valor == null ? null : Number(item.valor);
            byFecha.set(item.fecha, row);
        }
    };

    mergeSeries(baseMonetaria, 'base_monetaria');
    mergeSeries(pases, 'pases');
    mergeSeries(leliq, 'leliq');
    mergeSeries(lefi, 'lefi');
    mergeSeries(otros, 'otros');
    mergeSeries(depositosTesoro, 'depositos_tesoro');

    const emaeByFecha = emaeDesestacionalizadoMap(emae);
    const ipcByFecha = seriesValueMap(ipc.data || []);

    const monthPrefixes = new Set<string>();
    for (const fecha of byFecha.keys()) {
        monthPrefixes.add(fecha.slice(0, 7));
    }

    const firstOfMonthDates = Array.from(monthPrefixes).map(monthPrefix => `${monthPrefix}-01`);
    const pbiByFecha = buildMonthlyPbiSeries(pbiAnchors, emae, firstOfMonthDates);

    for (const monthPrefix of monthPrefixes) {
        const firstOfMonth = `${monthPrefix}-01`;
        const pbiVal = pbiByFecha.get(firstOfMonth);
        const emaeVal = emaeByFecha.get(firstOfMonth);
        const ipcVal = valueAtOrBefore(ipcByFecha, firstOfMonth);
        
        if (pbiVal != null || emaeVal != null || ipcVal != null) {
            const row = byFecha.get(firstOfMonth) ?? { fecha: firstOfMonth };
            if (pbiVal != null) row.pbi_trimestral = pbiVal;
            if (emaeVal != null) row.emae_desestacionalizado = emaeVal;
            if (ipcVal != null) row.ipc_nucleo = ipcVal;
            byFecha.set(firstOfMonth, row);
        }
    }

    return Array.from(byFecha.values()).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

function seriesValueMap(rows: DatosGobSeriesRow[]): Map<string, number> {
    return new Map(rows
        .filter((row) => typeof row[0] === 'string' && row[1] != null)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map((row) => [row[0], Number(row[1])]));
}

function valueAtOrBefore(valuesByFecha: Map<string, number>, fecha: string): number | null {
    let value: number | null = null;

    for (const [candidateFecha, candidateValue] of valuesByFecha) {
        if (candidateFecha > fecha) break;
        value = candidateValue;
    }

    return value;
}

function emaeDesestacionalizadoMap(rows: EmaeRawRow[]): Map<string, number> {
    return new Map(rows
        .filter((row) => row.emae_desestacionalizado != null)
        .map((row) => [row.fecha, Number(row.emae_desestacionalizado)]));
}

function fetchCSV(url: string): Promise<string[][]> {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    const rows = data.split('\n')
                        .map(line => line.trim().split(','))
                        .filter(row => row.length > 1);
                    resolve(rows);
                } else {
                    resolve([]);
                }
            });
        }).on('error', () => resolve([]));
    });
}

async function fetchPoderAdquisitivoRawReport(): Promise<{ rows: PoderAdquisitivoRawRow[]; publishedAt: string | null }> {
    const [ipc, jubilaciones, salariosCsv, ripteCsv, publicationHtml] = await Promise.all([
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INUCLEONAL_DICI_M_19&limit=5000'),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=58.1_MP_0_M_24&limit=5000'),
        fetchCSV('https://infra.datos.gob.ar/catalog/sspm/dataset/149/distribution/149.1/download/indice-salarios-periodicidad-mensual-base-octubre-2016.csv'),
        fetchCSV('https://infra.datos.gob.ar/catalog/sspm/dataset/158/distribution/158.1/download/remuneracion-imponible-promedio-trabajadores-estables-ripte-total-pais-pesos-serie-mensual.csv'),
        fetchTextFromUrl(SALARY_PUBLICATION_PAGE_URL),
    ]);

    const ipcByFecha = seriesValueMap(ipc.data || []);
    const jubilacionesByFecha = seriesValueMap(jubilaciones.data || []);
    const ripteByFecha = new Map(ripteCsv.slice(1).map(row => [row[0], row[1]]));

    const combinedMap = new Map<string, PoderAdquisitivoRawRow>();

    // Use salaries CSV as base for dates since it's the primary series
    salariosCsv.slice(1).forEach(row => {
        const fecha = row[0];
        if (!fecha) return;
        combinedMap.set(fecha, {
            fecha,
            ipc_nucleo: ipcByFecha.get(fecha) ?? null,
            salario_registrado: row[2] ? Number(row[2]) : null,
            salario_no_registrado: row[5] ? Number(row[5]) : null,
            salario_privado: row[3] ? Number(row[3]) : null,
            salario_publico: row[4] ? Number(row[4]) : null,
            ripte: ripteByFecha.get(fecha) ? Number(ripteByFecha.get(fecha)) : null,
            jubilacion_minima: jubilacionesByFecha.get(fecha) ? Number(jubilacionesByFecha.get(fecha)) : null,
        });
    });

    // Ensure we also have rows that might only exist in IPC or Jubilaciones (though unlikely for recent data)
    ipcByFecha.forEach((val, fechaKey) => {
        const fecha = String(fechaKey);
        if (!combinedMap.has(fecha)) {
            combinedMap.set(fecha, {
                fecha,
                ipc_nucleo: val,
                salario_registrado: null,
                salario_no_registrado: null,
                salario_privado: null,
                salario_publico: null,
                ripte: ripteByFecha.get(fecha) ? Number(ripteByFecha.get(fecha)) : null,
                jubilacion_minima: jubilacionesByFecha.get(fecha) ? Number(jubilacionesByFecha.get(fecha)) : null,
            });
        }
    });

    return {
        rows: Array.from(combinedMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha)),
        publishedAt: parseSalaryPublicationDate(publicationHtml),
    };
}

export async function fetchPoderAdquisitivoRaw(): Promise<PoderAdquisitivoRawRow[]> {
    return (await fetchPoderAdquisitivoRawReport()).rows;
}

function buildRecaudacionRawRow(
    fecha: string,
    recaudacionTotal: RecaudacionRawRow['recaudacion_total'],
    pbiByFecha: Map<string, number>,
    emaeByFecha: Map<string, number>,
    ipcByFecha: Map<string, number>,
): RecaudacionRawRow {
    const year = parseInt(fecha.slice(0, 4), 10);
    const month = fecha.slice(5, 7);

    return {
        fecha,
        mes: month,
        year,
        recaudacion_total: recaudacionTotal ?? null,
        pbi_trimestral: pbiByFecha.get(fecha) ?? null,
        emae_desestacionalizado: emaeByFecha.get(fecha) ?? null,
        ipc_nucleo: valueAtOrBefore(ipcByFecha, fecha),
    };
}

async function fetchRecaudacionRawReport(): Promise<{ rows: RecaudacionRawRow[]; publishedAt: string | null }> {
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

    const datosGobRows = recaudacionRows.map((row) => (
        buildRecaudacionRawRow(row[0], row[1] ?? null, pbiByFecha, emaeByFecha, ipcByFecha)
    ));
    const officialReportWithMacroFields = {
        ...officialReport,
        row: buildRecaudacionRawRow(
            officialReport.row.fecha,
            officialReport.row.recaudacion_total ?? null,
            pbiByFecha,
            emaeByFecha,
            ipcByFecha,
        ),
    };

    return {
        rows: mergeRecaudacionOfficialReport(datosGobRows, officialReportWithMacroFields),
        publishedAt: officialReport.publishedAt,
    };
}

export async function fetchRecaudacionRaw(): Promise<RecaudacionRawRow[]> {
    return (await fetchRecaudacionRawReport()).rows;
}

export async function syncEmision(): Promise<SyncResult> {
    const type: IndicatorType = 'emision';
    const existingData = ((await getRawData(type)) ?? []).map((row) => ({
        fecha: typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(row.fecha),
        compra_dolares: Number(row.compra_dolares ?? 0),
        tc: Number(row.tc ?? 0),
        bcra: Number(row.bcra ?? 0),
        vencimientos: Number(row.vencimientos ?? 0),
        licitado: Number(row.licitado ?? 0),
        resultado_fiscal: Number(row.resultado_fiscal ?? 0),
    }));
    const existingFechas = new Set(existingData.map((row) => row.fecha));

    const fromDate = '2026-01-01';
    const toDate = new Date().toISOString().split('T')[0];

    const { compraData, tcData } = await fetchEmisionRaw(fromDate, toDate);

    const tcByIso = new Map(tcData.map((row) => [row.fecha, Number(row.valor ?? 0)]));

    const apiRows: EmisionRawRow[] = compraData.map((row) => {
        const compra = Number(row.valor ?? 0);
        const tc = tcByIso.get(row.fecha) ?? 0;

        return {
            fecha: row.fecha,
            compra_dolares: compra,
            tc,
            bcra: compra * tc,
        };
    });

    const existingByFecha = new Map(existingData.map((row) => [row.fecha, row]));
    const rowsToUpsert = apiRows
        .map((row): Partial<EmisionRawRow> | null => {
            const existing = existingByFecha.get(row.fecha);

            if (!existing) {
                return {
                    ...row,
                    vencimientos: 0,
                    licitado: 0,
                    resultado_fiscal: 0,
                };
            }

            const apiChanged =
                existing.compra_dolares !== row.compra_dolares ||
                existing.tc !== row.tc ||
                existing.bcra !== row.bcra;

            if (!apiChanged) {
                return null;
            }

            // ONLY return API columns for existing rows to protect manual ones
            return {
                fecha: row.fecha,
                compra_dolares: row.compra_dolares,
                tc: row.tc,
                bcra: row.bcra,
            };
        })
        .filter((row): row is Partial<EmisionRawRow> => row !== null);

    if (rowsToUpsert.length > 0) {
        await saveRawData(type, rowsToUpsert);
    }

    const persistedRaw = ((await getRawData(type)) ?? [])
        .map((row) => ({
            fecha: typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(row.fecha),
            compra_dolares: Number(row.compra_dolares ?? 0),
            tc: Number(row.tc ?? 0),
            bcra: Number(row.bcra ?? 0),
            vencimientos: Number(row.vencimientos ?? 0),
            licitado: Number(row.licitado ?? 0),
            resultado_fiscal: Number(row.resultado_fiscal ?? 0),
        }))
        .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

    const normalized = normalizeEmision(persistedRaw);
    await replaceNormalizedData(type, normalized);

    const appended = apiRows.filter((row) => !existingFechas.has(row.fecha)).length;
    return { appended, total: persistedRaw.length };
}

export async function syncEmae(): Promise<SyncResult> {
    const type: IndicatorType = 'emae';
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((row) => row.fecha));

    const { rows: rawRows, publishedAt } = await fetchEmaeRaw();

    const appended = rawRows.filter((row) => !existingFechas.has(row.fecha)).length;
    await replaceRawData(type, rawRows);

    const normalized = normalizeEmae(rawRows);
    await replaceNormalizedData(type, normalized);

    if (publishedAt) {
        await saveIndicatorPublication('emae', publishedAt, rawRows.at(-1)?.fecha ?? null);
    }

    return { appended, total: rawRows.length };
}

export async function syncBma(): Promise<SyncResult> {
    const type: IndicatorType = 'bma';
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((row) => row.fecha));

    const components = await fetchBmaRaw();

    const appended = components.filter((row) => !existingFechas.has(row.fecha)).length;
    await replaceRawData(type, components);

    const normalized = normalizeBma(components);
    await replaceNormalizedData(type, normalized);

    return { appended, total: components.length };
}

export async function syncIndicatorsCatalog(): Promise<SyncResult> {
    const catalog = await buildCurrentIndicatorsCatalog();
    await saveIndicatorsCatalog(catalog);
    return { appended: catalog.length, total: catalog.length };
}

export async function syncRecaudacion(): Promise<SyncResult> {
    const type: IndicatorType = 'reca';
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((row) => row.fecha));

    const { rows: rawData, publishedAt } = await fetchRecaudacionRawReport();
    const appended = rawData.filter((row) => !existingFechas.has(row.fecha)).length;

    await replaceRawData(type, rawData);

    const normalized = normalizeRecaudacion(rawData);
    await replaceNormalizedData(type, normalized);

    if (publishedAt) {
        await saveIndicatorPublication('recaudacion', publishedAt, rawData.at(-1)?.fecha ?? null);
    }

    return { appended, total: rawData.length };
}

export async function syncPoderAdquisitivo(): Promise<SyncResult> {
    const type: IndicatorType = 'poder';
    const existingData = (await getRawData(type)) ?? [];
    const existingFechas = new Set(existingData.map((row) => row.fecha));

    const { rows: rawData, publishedAt } = await fetchPoderAdquisitivoRawReport();
    const appended = rawData.filter((row) => !existingFechas.has(row.fecha)).length;

    await replaceRawData(type, rawData);

    const normalized = normalizePoderAdquisitivo(rawData);
    await replaceNormalizedData(type, normalized);

    if (publishedAt) {
        await saveIndicatorPublication('poder-adquisitivo', publishedAt, normalized.at(-1)?.iso_fecha ?? rawData.at(-1)?.fecha ?? null);
    }

    return { appended, total: rawData.length };
}

export async function runSync(): Promise<SyncResults> {
    const indicatorResults = await runSyncTasks([
        { key: 'emision', run: syncEmision },
        { key: 'emae', run: syncEmae },
        { key: 'bma', run: syncBma },
        { key: 'recaudacion', run: syncRecaudacion },
        { key: 'poder_adquisitivo', run: syncPoderAdquisitivo },
    ]);
    const catalogResults = await runSyncTasks([{ key: 'catalog', run: syncIndicatorsCatalog }]);

    return { ...indicatorResults, ...catalogResults };
}

const sync = {
    fetchEmisionRaw,
    fetchEmaeRaw,
    fetchBmaRaw,
    fetchPoderAdquisitivoRaw,
    fetchRecaudacionRaw,
    syncEmision,
    syncEmae,
    syncBma,
    syncIndicatorsCatalog,
    syncRecaudacion,
    syncPoderAdquisitivo,
    runSync
};

export default sync;
