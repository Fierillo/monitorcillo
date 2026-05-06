import * as XLSX from 'xlsx';
import type { RecaudacionOfficialReport, RecaudacionRawRow } from '@/types';

const ARGENTINA_GOB_BASE_URL = 'https://www.argentina.gob.ar';

const MONTHS_ES: Record<string, string> = {
    enero: '01',
    febrero: '02',
    marzo: '03',
    abril: '04',
    mayo: '05',
    junio: '06',
    julio: '07',
    agosto: '08',
    septiembre: '09',
    setiembre: '09',
    octubre: '10',
    noviembre: '11',
    diciembre: '12',
};

const MONTHS_EN: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
};

function normalizeText(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function absoluteArgentinaGobUrl(url: string): string {
    return new URL(url, ARGENTINA_GOB_BASE_URL).toString();
}

function parseNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;

    const raw = String(value).trim().replace(/\s/g, '');
    const isNegative = raw.startsWith('(') && raw.endsWith(')');
    const unsigned = raw.replace(/[()]/g, '');
    const normalized = unsigned.includes(',') && unsigned.includes('.')
        ? unsigned.replace(/\./g, '').replace(',', '.')
        : unsigned.replace(/,/g, '');
    const parsed = Number(normalized);

    if (!Number.isFinite(parsed)) return null;
    return isNegative ? -parsed : parsed;
}

function parsePublicationDate(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString().split('T')[0];

    const raw = String(value ?? '').trim();
    const englishMatch = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (englishMatch) {
        const month = MONTHS_EN[englishMatch[2].toLowerCase()];
        if (!month) return null;
        return `${englishMatch[3]}-${month}-${englishMatch[1].padStart(2, '0')}`;
    }

    const numericMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (!numericMatch) return null;

    const parsedYear = Number(numericMatch[3]);
    const year = numericMatch[3].length === 2 ? 2000 + parsedYear : parsedYear;
    return `${year}-${numericMatch[2].padStart(2, '0')}-${numericMatch[1].padStart(2, '0')}`;
}

function parsePeriodDate(value: unknown): string | null {
    const match = normalizeText(value).match(/recaudacion tributaria\.\s*([a-z]+)\s+de\s+(\d{4})/);
    if (!match) return null;

    const month = MONTHS_ES[match[1]];
    if (!month) return null;

    return `${match[2]}-${month}-01`;
}

function buildRecaudacionRow(periodDate: string, recaudacionTotal: number): RecaudacionRawRow {
    return {
        fecha: periodDate,
        mes: periodDate.slice(5, 7),
        year: Number(periodDate.slice(0, 4)),
        recaudacion_total: recaudacionTotal,
    };
}

export function parseLatestRecaudacionWorkbookUrl(html: string): string | null {
    const links = html.matchAll(/<a\b[^>]*href=["']([^"']+\.xlsx)["'][^>]*>([\s\S]*?)<\/a>/gi);

    for (const match of links) {
        if (normalizeText(match[2]).includes('ultimo:')) return absoluteArgentinaGobUrl(match[1]);
    }

    const markdownMatch = html.match(/\[\s*(?:Ultimo|Último):[^\]]*\]\(([^)]+\.xlsx)\)/i);
    return markdownMatch ? absoluteArgentinaGobUrl(markdownMatch[1]) : null;
}

export function mergeRecaudacionOfficialReport(
    rows: RecaudacionRawRow[],
    report: RecaudacionOfficialReport | null,
): RecaudacionRawRow[] {
    if (!report) return [...rows].sort((a, b) => a.fecha.localeCompare(b.fecha));

    const rowsByDate = new Map(rows.map(row => [row.fecha, { ...row }]));
    const existing = rowsByDate.get(report.row.fecha);
    rowsByDate.set(report.row.fecha, { ...existing, ...report.row });

    return Array.from(rowsByDate.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseRecaudacionWorkbook(buffer: Buffer): RecaudacionOfficialReport | null {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return null;

    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: null }) as unknown[][];
    let publishedAt: string | null = null;
    let periodDate: string | null = null;
    let recaudacionTotal: number | null = null;

    for (const row of rows) {
        for (const cell of row) {
            publishedAt ??= parsePublicationDate(cell);
            periodDate ??= parsePeriodDate(cell);
        }

        if (normalizeText(row[0]) === 'total recursos tributarios') {
            recaudacionTotal = parseNumber(row[1]);
        }
    }

    if (!periodDate || recaudacionTotal === null) return null;

    return {
        publishedAt,
        row: buildRecaudacionRow(periodDate, recaudacionTotal),
    };
}
