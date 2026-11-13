import type { RecaudacionOfficialReport, RecaudacionRawRow } from '@/types';
import { firstSheetRows } from './protocols';
import { normalizeText } from './normalize/text';
import { isoDate, monthNumber } from './normalize/dates';
import { parseNumber } from './normalize/numbers';
import { conceptToTaxField, RECAUDACION_TAX_RAW_KEYS } from './recaudacion/schema';

const ARGENTINA_GOB_BASE_URL = 'https://www.argentina.gob.ar';

function absoluteArgentinaGobUrl(url: string): string {
    return new URL(url, ARGENTINA_GOB_BASE_URL).toString();
}

function parsePublicationDate(value: unknown): string | null {
    if (value instanceof Date) return value.toISOString().split('T')[0];

    const raw = String(value ?? '').trim();
    const englishMatch = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
    if (englishMatch) {
        const month = monthNumber(englishMatch[2]);
        return month ? isoDate(Number(englishMatch[3]), month, Number(englishMatch[1])) : null;
    }

    const numericMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
    if (!numericMatch) return null;

    const parsedYear = Number(numericMatch[3]);
    const year = numericMatch[3].length === 2 ? 2000 + parsedYear : parsedYear;
    return isoDate(year, Number(numericMatch[2]), Number(numericMatch[1]));
}

function parsePeriodDate(value: unknown): string | null {
    const match = normalizeText(value).match(/recaudacion tributaria\.\s*([a-z]+)\s+de\s+(\d{4})/);
    if (!match) return null;

    const month = monthNumber(match[1]);
    return month ? isoDate(Number(match[2]), month, 1) : null;
}

function buildRecaudacionRow(periodDate: string, values: Partial<RecaudacionRawRow>): RecaudacionRawRow {
    return {
        fecha: periodDate,
        mes: periodDate.slice(5, 7),
        year: Number(periodDate.slice(0, 4)),
        ...values,
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
    const merged: RecaudacionRawRow = {
        ...existing,
        ...report.row,
        fecha: report.row.fecha,
    };

    // Prefer datos.gob tax breakdown when already present; official workbook labels are brittle.
    for (const key of RECAUDACION_TAX_RAW_KEYS) {
        const existingValue = existing?.[key];
        if (existingValue != null && existingValue !== '') {
            merged[key] = existingValue;
        }
    }

    rowsByDate.set(report.row.fecha, merged);
    return Array.from(rowsByDate.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseRecaudacionWorkbook(buffer: Buffer): RecaudacionOfficialReport | null {
    const rows = firstSheetRows(buffer);
    let publishedAt: string | null = null;
    let periodDate: string | null = null;
    const values: Partial<RecaudacionRawRow> = {};

    for (const row of rows) {
        for (const cell of row) {
            publishedAt ??= parsePublicationDate(cell);
            periodDate ??= parsePeriodDate(cell);
        }

        const field = conceptToTaxField(String(row[0] ?? ''));
        if (!field) continue;

        const amount = parseNumber(row[1], 'en');
        if (amount == null) continue;
        values[field] = amount;
    }

    if (!periodDate || values.recaudacion_total == null) return null;

    return {
        publishedAt,
        row: buildRecaudacionRow(periodDate, values),
    };
}
