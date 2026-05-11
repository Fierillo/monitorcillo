import * as XLSX from 'xlsx';
import type { DeudaRawRow } from '@/types';

const ARGENTINA_GOB_BASE_URL = 'https://www.argentina.gob.ar';
const MONTHS: Record<string, string> = { jan: '01', ene: '01', feb: '02', mar: '03', apr: '04', abr: '04', may: '05', jun: '06', jul: '07', aug: '08', ago: '08', sep: '09', oct: '10', nov: '11', dec: '12', dic: '12' };

function absoluteArgentinaGobUrl(url: string): string {
    return new URL(url.replace(/^blank:#/, ''), ARGENTINA_GOB_BASE_URL).toString();
}

function normalizeText(value: unknown): string {
    return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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

function parseSheetRows(workbook: XLSX.WorkBook, sheetName: string): unknown[][] {
    const sheet = workbook.Sheets[sheetName];
    return sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null }) as unknown[][] : [];
}

function addMonthlyProjectedRows(workbook: XLSX.WorkBook, capitalSheet: string, interestSheet: string, rows: Map<string, DeudaRawRow>, minDate: string, maxDate: string, key: 'vencimientos' | 'vencimientos_proyectados' | 'pagos' = 'vencimientos') {
    const capitalRows = parseSheetRows(workbook, capitalSheet);
    const interestRows = parseSheetRows(workbook, interestSheet);
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
    const sheetRows = parseSheetRows(workbook, 'A.5');
    const headers = sheetRows[11] ?? [];
    const total = sheetRows.find(row => normalizeText(row[1]).startsWith('total pagado por tipo'));
    if (!total) return;

    for (let index = 2; index < headers.length; index++) {
        const fecha = monthFromHeader(headers[index]);
        if (!fecha || fecha > '2026-03-01') continue;
        putRow(rows, fecha, parseNumber(total[index]), 'pagos');
    }
}

function addMonthlyLoanDisbursementRows(workbook: XLSX.WorkBook, rows: Map<string, DeudaRawRow>) {
    const sheetRows = parseSheetRows(workbook, 'A.4');
    const headers = sheetRows.find(row => row.filter(cell => monthFromHeader(cell)).length >= 2) ?? [];
    const total = sheetRows.find(row => normalizeText(row[1]) === 'prestamos organismos internacionales');
    if (!total) return;

    for (let index = 2; index < headers.length; index++) {
        const fecha = monthFromHeader(headers[index]);
        if (!fecha || fecha > '2026-03-01') continue;
        putRow(rows, fecha, parseNumber(total[index]), 'toma_deuda_usd');
    }
}

function addMonthlyDebtStockRows(workbook: XLSX.WorkBook, rows: Map<string, DeudaRawRow>) {
    const sheetRows = parseSheetRows(workbook, 'A.4');
    const headers = sheetRows.find(row => row.filter(cell => monthFromHeader(cell)).length >= 2) ?? [];
    const total = sheetRows.find(row => normalizeText(row[1]) === 'iii - deuda bruta (i + ii)');
    if (!total) return;

    for (let index = 2; index < headers.length; index++) {
        const fecha = monthFromHeader(headers[index]);
        if (!fecha || fecha > '2026-03-01') continue;
        putRow(rows, fecha, parseNumber(total[index]), 'stock_deuda_usd');
    }
}

function addAnnualProjectedRows(workbook: XLSX.WorkBook, rows: Map<string, DeudaRawRow>) {
    const sheetRows = parseSheetRows(workbook, 'A.3.6');
    const headers = sheetRows[9] ?? [];
    const total = findRow(sheetRows, 'total');
    if (!total) return;

    for (let index = 2; index < headers.length; index++) {
        const year = Number(headers[index]);
        const annualValue = parseNumber(total[index]);
        if (!year || year < 2028 || year > 2035 || annualValue == null) continue;
        for (let month = 1; month <= 12; month++) putRow(rows, `${year}-${String(month).padStart(2, '0')}-01`, annualValue / 1000 / 12);
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
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const byMonth = new Map<string, number>();

    for (const sheetName of workbook.SheetNames.filter(name => normalizeText(name) !== 'portada')) {
        const rows = parseSheetRows(workbook, sheetName);
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
    const rows = parseSheetRows(XLSX.read(buffer, { type: 'buffer' }), 'A.1.1');
    const total = rows.find(row => normalizeText(row[1]).includes('total deuda publica bruta'));
    const stockMilesUsd = parseNumber(total?.[2]);
    return stockMilesUsd == null ? [] : [{ fecha: '2017-01-01', stock_inicial_usd: stockMilesUsd / 1000, stock_deuda_usd: stockMilesUsd / 1000 }];
}

export function parseDeudaPublicaWorkbook(buffer: Buffer): DeudaRawRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const rows = new Map<string, DeudaRawRow>();
    addMonthlyProjectedRows(workbook, 'A.3.2', 'A.3.3', rows, '2024-01-01', '2025-12-01', 'vencimientos');
    addMonthlyProjectedRows(workbook, 'A.3.2', 'A.3.3', rows, '2026-04-01', '2026-12-01', 'vencimientos_proyectados');
    addMonthlyProjectedRows(workbook, 'A.3.4', 'A.3.5', rows, '2027-01-01', '2027-12-01', 'vencimientos_proyectados');
    addAnnualProjectedRows(workbook, rows);
    return Array.from(rows.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseDeudaMonthlyPaymentsWorkbook(buffer: Buffer): DeudaRawRow[] {
    const rows = new Map<string, DeudaRawRow>();
    addMonthlyPaidRows(XLSX.read(buffer, { type: 'buffer' }), rows);
    return Array.from(rows.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseDeudaMonthlyLoanDisbursementsWorkbook(buffer: Buffer): DeudaRawRow[] {
    const rows = new Map<string, DeudaRawRow>();
    addMonthlyLoanDisbursementRows(XLSX.read(buffer, { type: 'buffer' }), rows);
    return Array.from(rows.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseDeudaMonthlyStockWorkbook(buffer: Buffer): DeudaRawRow[] {
    const rows = new Map<string, DeudaRawRow>();
    addMonthlyDebtStockRows(XLSX.read(buffer, { type: 'buffer' }), rows);
    return Array.from(rows.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseLegacyProjectedWorkbook(buffer: Buffer, year: number): DeudaRawRow[] {
    const rows = new Map<string, DeudaRawRow>();
    addMonthlyProjectedRows(XLSX.read(buffer, { type: 'buffer' }), 'A.3.2', 'A.3.3', rows, `${year}-01-01`, `${year}-12-01`, 'pagos');
    return Array.from(rows.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
