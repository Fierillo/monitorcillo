const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];
const MONTHS_IDX: Record<string, number> = { ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AGO: 7, SEPT: 8, SEP: 8, OCT: 9, NOV: 10, DIC: 11 };

export function isoToFecha(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}

export function isoToMonthLabel(dateStr: string): string {
    const d = new Date(dateStr + 'T12:00:00Z');
    return `${MONTHS_ES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}

export function fechaToTimestamp(fecha: string): number {
    const parts = fecha.split(' ');
    if (parts.length < 3) return 0;
    const parsedYear = parseInt(parts[2], 10);
    const year = parts[2].length === 2 ? 2000 + parsedYear : parsedYear;
    return new Date(year, MONTHS_IDX[parts[1]], parseInt(parts[0], 10)).getTime();
}

export function fechaToISO(fecha: string): string {
    const parts = fecha.split(' ');
    if (parts.length < 3) return '';
    const parsedYear = parseInt(parts[2], 10);
    const year = parts[2].length === 2 ? 2000 + parsedYear : parsedYear;
    return `${year}-${String(MONTHS_IDX[parts[1]] + 1).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
}

export { MONTHS_ES };
