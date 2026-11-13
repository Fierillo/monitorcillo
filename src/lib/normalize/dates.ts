import { normalizeText } from './text';

/** Spanish month names, the single month list of the site. */
export const MONTH_NAMES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_ES = MONTH_NAMES_ES.map(name => name === 'septiembre' ? 'SEPT' : name.slice(0, 3).toUpperCase());
const MONTHS_IDX: Record<string, number> = { ...Object.fromEntries(MONTHS_ES.map((label, index) => [label, index])), SEP: 8 };

const MONTH_ABBREVIATIONS_EN = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** 1-based month of each name a source may write: Spanish names and abbreviations, plus the English abbreviations SheetJS formats dates with. */
const MONTH_NUMBERS: Record<string, number> = Object.fromEntries([
    ...MONTH_NAMES_ES.flatMap((name, index) => [[name, index + 1], [name.slice(0, 3), index + 1]]),
    ...MONTH_ABBREVIATIONS_EN.map((name, index) => [name, index + 1]),
    ['setiembre', 9], ['set', 9], ['sept', 9],
]);

/** 1-based month of a month name cell ('Enero', 'setiembre', 'Aug', 'DIC*'), allowing one footnote letter ('Septiembree' = estimated); null when it is not a month. */
export function monthNumber(value: unknown): number | null {
    const letters = normalizeText(value).replace(/[^a-z]/g, '');
    return MONTH_NUMBERS[letters] ?? MONTH_NUMBERS[letters.slice(0, -1)] ?? null;
}

/** YYYY-MM-DD from a year, a 1-based month and a day. */
export function isoDate(year: number, month: number, day: number): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)}`;
}

/** First day of the month `offset` months after (or before) a YYYY-MM-DD date. */
export function addMonths(fecha: string, offset: number): string {
    const [year, month] = fecha.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().split('T')[0];
}

/** How a source writes its period: a pattern and the capture groups holding its year (2 digits pivot at 80) and month (number or name). A trailing provisional mark ('*', '(*)') is allowed. */
const PERIOD_FORMATS = {
    iso: { pattern: /^(\d{4})-(\d{2})-\d{2}$/, year: 1, month: 2 },
    yyyymm: { pattern: /^(\d{4})(\d{2})$/, year: 1, month: 2 },
    'd/m/yyyy': { pattern: /^\d{1,2}\/(\d{1,2})\/(\d{4})$/, year: 2, month: 1 },
    'm/d/yy': { pattern: /^(\d{1,2})\/\d{1,2}\/(\d{2}|\d{4})$/, year: 2, month: 1 },
    'mmm-yy': { pattern: /^([a-z]{3})-(\d{2}|\d{4})\s*(?:\*|\(\*\))?$/i, year: 2, month: 1 },
};
export type PeriodFormat = keyof typeof PERIOD_FORMATS;

/** First day of the month (YYYY-MM-01) of a source period cell; null when it does not match the format. */
export function parsePeriod(value: unknown, format: PeriodFormat): string | null {
    const { pattern, year, month } = PERIOD_FORMATS[format];
    const match = String(value ?? '').trim().match(pattern);
    if (!match) return null;
    const monthValue = /^\d+$/.test(match[month]) ? Number(match[month]) : monthNumber(match[month]);
    const yearValue = Number(match[year]);
    const fullYear = match[year].length === 2 ? (yearValue >= 80 ? 1900 : 2000) + yearValue : yearValue;
    return monthValue && monthValue >= 1 && monthValue <= 12 ? isoDate(fullYear, monthValue, 1) : null;
}

/** Today's date (YYYY-MM-DD) in Argentina: the single day boundary for the whole site. */
export function argentinaToday(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Buenos_Aires' }).format(new Date());
}

export function isoToFecha(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}

export function isoToMonthLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    return `${MONTHS_ES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}

export function fechaToTimestamp(fecha: string): number {
    const parts = fecha.replace(/^([A-Za-z]+)-(\d{2,4})$/, '$1 $2').toUpperCase().split(' ');
    if (parts.length === 1 && /^\d{4}$/.test(parts[0])) return Date.UTC(Number(parts[0]), 0, 1);
    if (parts.length < 2) return 0;

    const [dayValue, monthValue, yearValue] = parts.length === 2
        ? ['1', parts[0], parts[1]]
        : parts;
    const month = MONTHS_IDX[monthValue] ?? MONTHS_IDX[monthValue.slice(0, 3)];
    const parsedYear = parseInt(yearValue, 10);
    const year = yearValue.length === 2 ? 2000 + parsedYear : parsedYear;
    const day = parseInt(dayValue, 10);
    return Number.isFinite(year) && Number.isFinite(day) && month !== undefined
        ? Date.UTC(year, month, day)
        : 0;
}

export function fechaToISO(fecha: string): string {
    const parts = fecha.split(' ');
    if (parts.length < 3) return '';
    const parsedYear = parseInt(parts[2], 10);
    const year = parts[2].length === 2 ? 2000 + parsedYear : parsedYear;
    return `${year}-${String(MONTHS_IDX[parts[1]] + 1).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
}

export { MONTHS_ES };
