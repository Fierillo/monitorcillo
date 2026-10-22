import * as XLSX from 'xlsx';
import type { DeudaRawRow } from '@/types';
import { readWorkbook, sheetRows } from './protocols';
import { normalizeText } from './normalize/text';

const ARGENTINA_GOB_BASE_URL = 'https://www.argentina.gob.ar';
const MONTHS: Record<string, string> = { jan: '01', ene: '01', feb: '02', mar: '03', apr: '04', abr: '04', may: '05', jun: '06', jul: '07', aug: '08', ago: '08', sep: '09', oct: '10', nov: '11', dec: '12', dic: '12' };

function absoluteArgentinaGobUrl(url: string): string {
    return new URL(url.replace(/^blank:#/, ''), ARGENTINA_GOB_BASE_URL).toString();
}

function parseNumber(value: unknown): number | null {
    const normalized = String(value ?? '').replace(/\s/g, '').replace(/,/g, '');
    if (!normalized || normalized === '-') return null;
    const parsed = Number(normalized.replace(/[()]/g, ''));
    if (!Number.isFinite(parsed)) return null;
    return normalized.startsWith('(') && normalized.endsWith(')') ? -parsed : parsed;
}

function monthFromHeader(value: unknown): string | null {
    const raw = normalizeText(value);
    const year = raw.match(/(\d{2})/)?.[1];
    const month = MONTHS[raw.slice(0, 3)];
    return month && year ? `20${year}-${month}-01` : null;
}

function monthFromDate(value: unknown): string | null {
    const raw = String(value ?? '').trim();
    const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (!match) return null;
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${match[1].padStart(2, '0')}-01`;
}

function putRow(rows: Map<string, DeudaRawRow>, fecha: string, value: number | null, key: 'stock_deuda_usd' | 'toma_deuda_usd' | 'vencimientos' | 'vencimientos_proyectados' | 'pagos' = 'vencimientos') {
    if (value == null || value === 0) return;
    rows.set(fecha, { ...rows.get(fecha), fecha, [key]: value });
}

function findRow(rows: unknown[][], label: string): unknown[] | null {
    return rows.find(row => normalizeText(row[1]) === label) ?? null;
}

function addMonthlyProjectedRows(workbook: XLSX.WorkBook, capitalSheet: string, interestSheet: string, rows: Map<string, DeudaRawRow>, minDate: string, maxDate: string, key: 'vencimientos' | 'vencimientos_proyectados' | 'pagos' = 'vencimientos') {
    const capitalRows = sheetRows(workbook.Sheets[capitalSheet]);
    const interestRows = sheetRows(workbook.Sheets[interestSheet]);
    const headers = capitalRows.find(row => row.filter(cell => monthFromHeader(cell)).length >= 6) ?? [];
    const capital = findRow(capitalRows, 'total');
    const interest = findRow(interestRows, 'total');
    if (!capital || !interest) return;

    for (let index = 2; index < headers.length; index++) {
        const fecha = monthFromHeader(headers[index]);
        if (!fecha || fecha < minDate || fecha > maxDate) continue;
        putRow(rows, fecha, (parseNumber(capital[index]) ?? 0) + (parseNumber(interest[index]) ?? 0), key);
    }
}

function addMonthlyPaidRows(workbook: XLSX.WorkBook, rows: Map<string, DeudaRawRow>) {
    const paymentRows = sheetRows(workbook.Sheets['A.5']);
    const headers = paymentRows[11] ?? [];
    const total = paymentRows.find(row => normalizeText(row[1]).startsWith('total pagado por tipo'));
    if (!total) return;

    for (let index = 2; index < headers.length; index++) {
        const fecha = monthFromHeader(headers[index]);
        if (fecha) putRow(rows, fecha, parseNumber(total[index]), 'pagos');
    }
}

function addMonthlyLoanDisbursementRows(workbook: XLSX.WorkBook, rows: Map<string, DeudaRawRow>) {
    const loanRows = sheetRows(workbook.Sheets['A.4']);
    const headers = loanRows.find(row => row.filter(cell => monthFromHeader(cell)).length >= 2) ?? [];
    const total = loanRows.find(row => normalizeText(row[1]) === 'prestamos organismos internacionales');
    if (!total) return;

    for (let index = 2; index < headers.length; index++) {
        const fecha = monthFromHeader(headers[index]);
        if (fecha) putRow(rows, fecha, parseNumber(total[index]), 'toma_deuda_usd');
    }
}

/** Bulletin A.1 row "A- DEUDA BRUTA (I + II + III)": end-of-month gross debt, millions of USD. */
function addMonthlyDebtStockRows(workbook: XLSX.WorkBook, rows: Map<string, DeudaRawRow>) {
    const stockRows = sheetRows(workbook.Sheets['A.1']);
    const headers = stockRows.find(row => row.filter(cell => monthFromHeader(cell)).length >= 2) ?? [];
    const total = stockRows.find(row => normalizeText(row[1]).startsWith('a- deuda bruta'));
    if (!total) return;

    for (let index = 2; index < headers.length; index++) {
        const fecha = monthFromHeader(headers[index]);
        if (fecha) putRow(rows, fecha, parseNumber(total[index]), 'stock_deuda_usd');
    }
}

function yearHeaderRow(rows: unknown[][]): unknown[] {
    return rows.find(row => row.slice(2).some(cell => /^\d{4}$/.test(String(cell ?? '').trim()))) ?? [];
}

/** A.3.6 annual totals for the years after the monthly sheets, spread evenly over their months. */
function addAnnualProjectedRows(workbook: XLSX.WorkBook, rows: Map<string, DeudaRawRow>, afterYear: number) {
    const projectionRows = sheetRows(workbook.Sheets['A.3.6']);
    const headers = yearHeaderRow(projectionRows);
    const total = findRow(projectionRows, 'total');
    if (!total) return;

    for (let index = 2; index < headers.length; index++) {
        const header = String(headers[index] ?? '').trim();
        const annualValue = parseNumber(total[index]);
        if (!/^\d{4}$/.test(header) || Number(header) <= afterYear || annualValue == null) continue;
        for (let month = 1; month <= 12; month++) putRow(rows, `${header}-${String(month).padStart(2, '0')}-01`, annualValue / 1000 / 12);
    }
}

export function parseLatestDeudaPublicaExcelUrl(html: string): string | null {
    const match = html.match(/href=["'](?:blank:#)?([^"']*deuda(?:_|%5F)publica[^"']*\.xlsx)["']/i);
    return match ? absoluteArgentinaGobUrl(match[1]) : null;
}

export function parseLatestMonthlyDebtExcelUrl(html: string): string | null {
    const match = html.match(/href=["'](?:blank:#)?([^"']*boletin(?:_|%5F)mensual[^"']*\.xlsx)["']/i);
    return match ? absoluteArgentinaGobUrl(match[1]) : null;
}

export function parseDebtPlacementExcelUrls(html: string): string[] {
    const urls = Array.from(html.matchAll(/href=["'](?:blank:#)?([^"']*coloc[^"']*\.xlsx?)["']/gi)).map(match => absoluteArgentinaGobUrl(match[1]));
    return [...new Set(urls)].filter(url => /(2017|2018|2019|202\d|31[-_%5F]3[-_%5F]26|31[-_%5F]12[-_%5F]1[789])/i.test(url));
}

export function parseDebtPlacementsWorkbook(buffer: Buffer): DeudaRawRow[] {
    const workbook = readWorkbook(buffer);
    const byMonth = new Map<string, number>();

    for (const sheetName of workbook.SheetNames.filter(name => normalizeText(name) !== 'portada')) {
        const rows = sheetRows(workbook.Sheets[sheetName]);
        const headers = rows.find(row => row.some(cell => normalizeText(cell).startsWith('fecha colocacion')));
        if (!headers) continue;
        const dateIndex = headers.findIndex(cell => normalizeText(cell).startsWith('fecha colocacion'));
        const valueIndex = headers.findIndex(cell => normalizeText(cell) === 'valor efectivo');
        const fallbackValueIndex = headers.findIndex(cell => normalizeText(cell) === 'valor nominal');
        const amountIndex = valueIndex >= 0 ? valueIndex : fallbackValueIndex;
        if (dateIndex < 0 || amountIndex < 0) continue;

        for (const row of rows.slice(rows.indexOf(headers) + 1)) {
            const fecha = monthFromDate(row[dateIndex]);
            const value = parseNumber(row[amountIndex]);
            if (!fecha || value == null || fecha < '2017-01-01') continue;
            byMonth.set(fecha, (byMonth.get(fecha) ?? 0) + value);
        }
    }

    return Array.from(byMonth.entries()).map(([fecha, toma_deuda]) => ({ fecha, toma_deuda })).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseInitialDebtStockWorkbook(buffer: Buffer): DeudaRawRow[] {
    const rows = sheetRows(readWorkbook(buffer).Sheets['A.1.1']);
    const total = rows.find(row => normalizeText(row[1]).includes('total deuda publica bruta'));
    const stockMilesUsd = parseNumber(total?.[2]);
    return stockMilesUsd == null ? [] : [{ fecha: '2017-01-01', stock_inicial_usd: stockMilesUsd / 1000, stock_deuda_usd: stockMilesUsd / 1000 }];
}

/** Quarterly workbook maturities: months up to the report month are paid, later ones projected; A.3.6 covers the later years. */
export function parseDeudaPublicaWorkbook(buffer: Buffer, reportMonth: string): DeudaRawRow[] {
    const workbook = readWorkbook(buffer);
    const rows = new Map<string, DeudaRawRow>();
    const nextMonth = `${reportMonth.slice(0, 8)}02`;
    for (const [capital, interest] of [['A.3.2', 'A.3.3'], ['A.3.4', 'A.3.5']]) {
        addMonthlyProjectedRows(workbook, capital, interest, rows, '0000-01-01', reportMonth, 'vencimientos');
        addMonthlyProjectedRows(workbook, capital, interest, rows, nextMonth, '9999-12-01', 'vencimientos_proyectados');
    }
    const lastMonthlyYear = Math.max(Number(reportMonth.slice(0, 4)), ...Array.from(rows.keys()).map(fecha => Number(fecha.slice(0, 4))));
    addAnnualProjectedRows(workbook, rows, lastMonthlyYear);
    return Array.from(rows.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function rowsAfter(rows: unknown[][], label: string): { total: unknown[]; capital: unknown[]; interest: unknown[] } | null {
    const start = rows.findIndex(row => normalizeText(row[1]) === label);
    if (start < 0) return null;
    const after = rows.slice(start + 1);
    const capital = after.find(row => normalizeText(row[1]) === 'capital');
    const interest = after.find(row => normalizeText(row[1]) === 'interes');
    return capital && interest ? { total: rows[start], capital, interest } : null;
}

const thousandsToMillions = (value: unknown) => (parseNumber(value) ?? 0) / 1000;

export type DeudaMaturities = {
    anuales: { periodo: string; capital_usd: number; interes_usd: number }[];
    proximos12m: { capital_usd: number; interes_usd: number } | null;
};

/** A.3.6 capital/interest per year (last bucket like "2036/2089" kept as a range) and the A.3.1 next-12-month total, millions of USD. */
export function parseDeudaMaturitiesWorkbook(buffer: Buffer): DeudaMaturities {
    const workbook = readWorkbook(buffer);
    const annualRows = sheetRows(workbook.Sheets['A.3.6']);
    const headers = yearHeaderRow(annualRows);
    const annual = rowsAfter(annualRows, 'total');
    const anuales = annual ? headers.flatMap((cell, index) => {
        const header = String(cell ?? '').trim();
        if (index < 2 || !/^\d{4}(\/\d{4})?$/.test(header)) return [];
        return [{ periodo: header.replace('/', '-'), capital_usd: thousandsToMillions(annual.capital[index]), interes_usd: thousandsToMillions(annual.interest[index]) }];
    }) : [];
    const next = rowsAfter(sheetRows(workbook.Sheets['A.3.1']), 'total');
    const lastValue = (row: unknown[]) => [...row].reverse().find(cell => parseNumber(cell) != null);
    const proximos12m = next ? { capital_usd: thousandsToMillions(lastValue(next.capital)), interes_usd: thousandsToMillions(lastValue(next.interest)) } : null;
    return { anuales, proximos12m };
}

/** A.4.7 "Deuda Bruta de la Administración Central" as % of GDP: years at December, quarters at their last month. */
export function parseDebtToGdpWorkbook(buffer: Buffer): DeudaRawRow[] {
    const rows = sheetRows(readWorkbook(buffer).Sheets['A.4.7']);
    const headers = rows.find(row => normalizeText(row[2]) === 'indicadores') ?? [];
    const ratio = rows.find(row => normalizeText(row[2]) === 'deuda bruta de la administracion central');
    if (!ratio) return [];
    return headers.flatMap((cell, index) => {
        const header = normalizeText(cell);
        const quarter = header.match(/^(\d)\D*trim\D*(\d{4})/);
        const year = header.match(/^(\d{4})/);
        const fecha = quarter ? `${quarter[2]}-${String(Number(quarter[1]) * 3).padStart(2, '0')}-01` : year ? `${year[1]}-12-01` : null;
        const value = Number.parseFloat(String(ratio[index] ?? '').replace('%', ''));
        return fecha && Number.isFinite(value) ? [{ fecha, deuda_pbi_oficial: value }] : [];
    });
}

export function parseDeudaMonthlyPaymentsWorkbook(buffer: Buffer): DeudaRawRow[] {
    const rows = new Map<string, DeudaRawRow>();
    addMonthlyPaidRows(readWorkbook(buffer), rows);
    return Array.from(rows.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseDeudaMonthlyLoanDisbursementsWorkbook(buffer: Buffer): DeudaRawRow[] {
    const rows = new Map<string, DeudaRawRow>();
    addMonthlyLoanDisbursementRows(readWorkbook(buffer), rows);
    return Array.from(rows.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseDeudaMonthlyStockWorkbook(buffer: Buffer): DeudaRawRow[] {
    const rows = new Map<string, DeudaRawRow>();
    addMonthlyDebtStockRows(readWorkbook(buffer), rows);
    return Array.from(rows.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseLegacyProjectedWorkbook(buffer: Buffer, year: number): DeudaRawRow[] {
    const rows = new Map<string, DeudaRawRow>();
    addMonthlyProjectedRows(readWorkbook(buffer), 'A.3.2', 'A.3.3', rows, `${year}-01-01`, `${year}-12-01`, 'pagos');
    return Array.from(rows.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
