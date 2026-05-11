import type { DeudaRawRow } from '@/types';
import { parseDebtPlacementExcelUrls, parseDebtPlacementsWorkbook, parseDeudaMonthlyLoanDisbursementsWorkbook, parseDeudaMonthlyPaymentsWorkbook, parseDeudaMonthlyStockWorkbook, parseDeudaPublicaWorkbook, parseInitialDebtStockWorkbook, parseLatestDeudaPublicaExcelUrl, parseLatestMonthlyDebtExcelUrl, parseLegacyProjectedWorkbook } from '../deuda-source';
import { sql } from '../db/client';
import { getRawData } from '../db/raw';
import { buildMonthlyPbiSeries } from '../pbi-source';
import { fetchBcraVariable } from './bcra';
import { fetchEmaeWorkbookRows, fetchPbiAnchorRows } from './cache';
import { fetchBufferFromUrl, fetchFromUrl, fetchTextFromUrl } from './http-client';
import { emaeDesestacionalizadoMap, seriesValueMap, valueAtOrBefore } from './series';

const DEUDA_TRIMESTRAL_URL = 'https://www.argentina.gob.ar/economia/finanzas/datos-trimestrales-de-la-deuda';
const DEUDA_MENSUAL_URL = 'https://www.argentina.gob.ar/economia/finanzas/datos-mensuales';
const DEUDA_COLOCACIONES_URL = 'https://www.argentina.gob.ar/economia/finanzas/deudapublica/colocacionesdedeuda';
const DEUDA_COLOCACIONES_ARCHIVE_URL = 'https://www.argentina.gob.ar/economia/finanzas/archivo-de-colocaciones-de-deuda';
const LEGACY_PROJECTED_WORKBOOKS = [
    { year: 2017, url: 'https://www.argentina.gob.ar/sites/default/files/deuda_publica_31-12-2016.xlsx' },
    { year: 2018, url: 'https://www.argentina.gob.ar/sites/default/files/deuda_publica_31-12-2017_1.xlsx' },
];

function mergeRows(groups: DeudaRawRow[][]): DeudaRawRow[] {
    const byFecha = new Map<string, DeudaRawRow>();
    for (const row of groups.flat()) byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    return Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function mergeMacroData(rows: DeudaRawRow[], reportMonth: string, tcByFecha: Map<string, number>, pbiByFecha: Map<string, number>, ipcByFecha: Map<string, number>, emaeByFecha: Map<string, number>): DeudaRawRow[] {
    const reportTc = valueAtOrBefore(tcByFecha, reportMonth);
    const reportPbi = pbiByFecha.get(reportMonth) ?? null;
    const reportIpc = valueAtOrBefore(ipcByFecha, reportMonth);
    const mergedRows = rows.map(row => ({
        ...row,
        tc: valueAtOrBefore(tcByFecha, monthEnd(row.fecha)) ?? reportTc,
        pbi_trimestral: pbiByFecha.get(row.fecha) ?? reportPbi,
        emae_desestacionalizado: emaeByFecha.get(row.fecha) ?? emaeByFecha.get(reportMonth) ?? null,
        ipc_nucleo: valueAtOrBefore(ipcByFecha, row.fecha) ?? reportIpc,
    }));
    const baseIpc = ipcByFecha.get('2017-01-01') ?? null;
    return baseIpc == null ? mergedRows : [{ fecha: '2017-01-01', ipc_nucleo: baseIpc }, ...mergedRows];
}

function reportDateFromUrl(url: string): string {
    const match = url.match(/(\d{2})-(\d{2})-(\d{4})/);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : new Date().toISOString().split('T')[0];
}

function monthEnd(date: string): string {
    const [year, month] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month, 0)).toISOString().split('T')[0];
}

async function fetchMonthlyDebtIssuanceRows(): Promise<DeudaRawRow[]> {
    const rows = await getRawData('emision');
    const byMonth = new Map<string, number>();

    for (const row of rows) {
        const licitado = Number(row.licitado ?? 0);
        if (!row.fecha || !Number.isFinite(licitado) || licitado === 0) continue;
        const month = `${row.fecha.slice(0, 7)}-01`;
        byMonth.set(month, (byMonth.get(month) ?? 0) + licitado);
    }

    return Array.from(byMonth.entries()).map(([fecha, toma_deuda]) => ({ fecha, toma_deuda }));
}

async function fetchDebtPlacementRows(urls: string[]): Promise<DeudaRawRow[]> {
    const rows: DeudaRawRow[] = [];
    for (const url of urls) rows.push(...parseDebtPlacementsWorkbook(await fetchBufferFromUrl(url)));
    return rows;
}

export async function fetchDeudaRaw(): Promise<DeudaRawRow[]> {
    const [quarterlyHtml, monthlyHtml, placementsHtml, placementsArchiveHtml] = await Promise.all([
        fetchTextFromUrl(DEUDA_TRIMESTRAL_URL),
        fetchTextFromUrl(DEUDA_MENSUAL_URL),
        fetchTextFromUrl(DEUDA_COLOCACIONES_URL),
        fetchTextFromUrl(DEUDA_COLOCACIONES_ARCHIVE_URL),
    ]);
    const quarterlyWorkbookUrl = parseLatestDeudaPublicaExcelUrl(quarterlyHtml);
    const monthlyWorkbookUrl = parseLatestMonthlyDebtExcelUrl(monthlyHtml);
    const placementWorkbookUrls = parseDebtPlacementExcelUrls(`${placementsHtml}\n${placementsArchiveHtml}`);
    if (!quarterlyWorkbookUrl) throw new Error(`Failed to find latest debt Excel at ${DEUDA_TRIMESTRAL_URL}`);
    if (!monthlyWorkbookUrl) throw new Error(`Failed to find latest monthly debt Excel at ${DEUDA_MENSUAL_URL}`);

    const reportDate = reportDateFromUrl(quarterlyWorkbookUrl);
    const reportMonth = `${reportDate.slice(0, 7)}-01`;
    const [quarterlyWorkbook, monthlyWorkbook, legacyWorkbooks, debtIssuanceRows, placementRows, pbiAnchors, emae, ipc, tcRows] = await Promise.all([
        fetchBufferFromUrl(quarterlyWorkbookUrl),
        fetchBufferFromUrl(monthlyWorkbookUrl),
        Promise.all(LEGACY_PROJECTED_WORKBOOKS.map(item => fetchBufferFromUrl(item.url).then(buffer => ({ ...item, buffer })))),
        fetchMonthlyDebtIssuanceRows(),
        fetchDebtPlacementRows(placementWorkbookUrls),
        fetchPbiAnchorRows(),
        fetchEmaeWorkbookRows(),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INUCLEONAL_DICI_M_19&limit=5000'),
        fetchBcraVariable(4, '2017-01-01', reportDate),
    ]);

    const rawRows = mergeRows([
        legacyWorkbooks.find(item => item.year === 2017)?.buffer ? parseInitialDebtStockWorkbook(legacyWorkbooks.find(item => item.year === 2017)!.buffer) : [],
        legacyWorkbooks.map(item => parseLegacyProjectedWorkbook(item.buffer, item.year)).flat(),
        debtIssuanceRows,
        placementRows,
        parseDeudaMonthlyStockWorkbook(monthlyWorkbook),
        parseDeudaMonthlyLoanDisbursementsWorkbook(monthlyWorkbook),
        parseDeudaMonthlyPaymentsWorkbook(monthlyWorkbook),
        parseDeudaPublicaWorkbook(quarterlyWorkbook),
    ]).filter(row => row.fecha >= '2017-01-01' && row.fecha <= '2035-12-01');
    const fechas = rawRows.map(row => row.fecha);
    const pbiByFecha = buildMonthlyPbiSeries(pbiAnchors, emae, [...fechas, reportMonth]);
    const emaeByFecha = emaeDesestacionalizadoMap(emae);
    const ipcByFecha = seriesValueMap(ipc.data || []);
    const tcByFecha = seriesValueMap(tcRows.map(row => [row.fecha, row.valor]));

    return mergeMacroData(rawRows, reportMonth, tcByFecha, pbiByFecha, ipcByFecha, emaeByFecha);
}

export async function ensureDeudaTables(): Promise<void> {
    await sql.query(`CREATE TABLE IF NOT EXISTS deuda_raw (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, stock_inicial_usd DECIMAL, stock_deuda_usd DECIMAL, toma_deuda DECIMAL, toma_deuda_usd DECIMAL, vencimientos DECIMAL, vencimientos_proyectados DECIMAL, pagos DECIMAL, tc DECIMAL, ipc_nucleo DECIMAL, pbi_trimestral DECIMAL, emae_desestacionalizado DECIMAL, fetched_at TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`CREATE TABLE IF NOT EXISTS deuda_normalized (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, toma_deuda DECIMAL, vencimientos DECIMAL, vencimientos_proyectados DECIMAL, pagos DECIMAL, deuda_pbi DECIMAL, deuda_proyectada DECIMAL, acumulado DECIMAL, total DECIMAL, last_update TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`ALTER TABLE deuda_raw ADD COLUMN IF NOT EXISTS stock_inicial_usd DECIMAL`, []);
    await sql.query(`ALTER TABLE deuda_raw ADD COLUMN IF NOT EXISTS stock_deuda_usd DECIMAL`, []);
    await sql.query(`ALTER TABLE deuda_raw ADD COLUMN IF NOT EXISTS toma_deuda DECIMAL`, []);
    await sql.query(`ALTER TABLE deuda_raw ADD COLUMN IF NOT EXISTS toma_deuda_usd DECIMAL`, []);
    await sql.query(`ALTER TABLE deuda_raw ADD COLUMN IF NOT EXISTS vencimientos DECIMAL`, []);
    await sql.query(`ALTER TABLE deuda_raw ADD COLUMN IF NOT EXISTS vencimientos_proyectados DECIMAL`, []);
    await sql.query(`ALTER TABLE deuda_normalized ADD COLUMN IF NOT EXISTS toma_deuda DECIMAL`, []);
    await sql.query(`ALTER TABLE deuda_normalized ADD COLUMN IF NOT EXISTS vencimientos DECIMAL`, []);
    await sql.query(`ALTER TABLE deuda_normalized ADD COLUMN IF NOT EXISTS vencimientos_proyectados DECIMAL`, []);
    await sql.query(`ALTER TABLE deuda_normalized ADD COLUMN IF NOT EXISTS deuda_pbi DECIMAL`, []);
    await sql.query(`ALTER TABLE deuda_normalized ADD COLUMN IF NOT EXISTS deuda_proyectada DECIMAL`, []);
    await sql.query(`ALTER TABLE deuda_normalized ADD COLUMN IF NOT EXISTS acumulado DECIMAL`, []);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_deuda_fecha ON deuda_raw(fecha)`, []);
}
