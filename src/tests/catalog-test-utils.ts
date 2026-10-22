import type { CatalogIndicatorRow } from '@/types';
import { argentinaToday } from '../lib/normalize/dates';

export const baseCatalogRow: CatalogIndicatorRow = {
    id: '',
    indicador: '',
    referencia: '',
    dato: '-',
    fecha: '-',
    fuente: '',
    trend: 'neutral',
    category: 'default',
    has_details: true,
    source_url: null,
};

const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];

export function addMonthsFromDate(date: string, months: number): string {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().split('T')[0];
}

export function futureDate(baseDate: string, step: (date: string) => string): string {
    const today = argentinaToday();
    let date = step(baseDate);
    while (date <= today) date = step(date);
    return date;
}

export const futureMonthly = (baseDate: string) => futureDate(baseDate, date => addMonthsFromDate(date, 1));

export function formatDay(date: string): string {
    const d = new Date(`${date}T12:00:00Z`);
    return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}
