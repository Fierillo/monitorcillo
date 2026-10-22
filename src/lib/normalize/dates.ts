/** Spanish month names, the single month list of the site. */
export const MONTH_NAMES_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_ES = MONTH_NAMES_ES.map(name => name === 'septiembre' ? 'SEPT' : name.slice(0, 3).toUpperCase());
const MONTHS_IDX: Record<string, number> = { ...Object.fromEntries(MONTHS_ES.map((label, index) => [label, index])), SEP: 8 };

/** YYYY-MM-DD from a year, a 1-based month and a day. */
export function isoDate(year: number, month: number, day: number): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)}`;
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
