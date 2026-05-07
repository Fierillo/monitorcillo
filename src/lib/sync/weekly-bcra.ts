import * as XLSX from 'xlsx';
import { ENGLISH_MONTHS } from './constants';

const WEEKLY_TREASURY_SERIES_REGEX = /DEPOSITOS DEL GOBIERNO NACIONAL Y OTROS/i;

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
    return Number.isNaN(numericValue) ? null : numericValue / 1000;
}

export function extractWeeklyGovernmentDepositsSeries(workbookBuffer: Buffer, fromDate: string): Array<{ fecha: string; valor: number }> {
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
            if (valor != null) byFecha.set(fecha, valor);
        }
    }

    return Array.from(byFecha.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([fecha, valor]) => ({ fecha, valor }));
}
