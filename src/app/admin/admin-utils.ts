import type { EmisionAdminEditableField, EmisionAdminNumericField, EmisionAdminRow, Indicator } from '@/types';
import { fechaToISO } from '@/lib/normalize/dates';

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];

export function canEditRollover(row: EmisionAdminRow) {
    const date = row.iso_fecha ?? fechaToISO(row.fecha);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= '2026-10-14';
}

export function formatNumber(val: number | string) {
    if (val === '-') return '-';
    if (val === 0 || !val) return '0';
    return Number(val).toLocaleString('es-AR');
}

export function formatRollover(value: number | string = 0) {
    return typeof value === 'string' ? value : value.toLocaleString('es-AR', { useGrouping: false, maximumFractionDigits: 20 });
}

export function withEmisionTotals(rows: EmisionAdminRow[]): EmisionAdminRow[] {
    let runningSum = 0;
    return rows.map((row) => {
        const total = (Number(row.BCRA) || 0) + (Number(row.Licitaciones) || 0) + (Number(row['Resultado fiscal']) || 0);
        runningSum += total;
        return {
            ...row,
            CompraDolares: row.CompraDolares || 0,
            TC: row.TC || 0,
            Vencimientos: row.Vencimientos || 0,
            Licitado: row.Licitado || 0,
            Rollover: Number(row.Vencimientos) > 0 ? Number(row.Licitado) / Number(row.Vencimientos) * 100 : 0,
            TOTAL: total,
            ACUMULADO: runningSum,
        };
    });
}

export function getNextWorkingDate(prevDateStr: string) {
    if (!prevDateStr) return '';
    const parts = prevDateStr.toUpperCase().split(/[\s-]+/);
    if (parts.length < 2) return '';

    const day = parseInt(parts[0], 10);
    const monthStr = parts[1];
    let month = MONTHS.indexOf(monthStr);
    if (month === -1 && monthStr === 'SEP') month = 8;
    if (month === -1) return '';

    const parsedYear = parts.length === 3 ? parseInt(parts[2], 10) : NaN;
    const year = Number.isNaN(parsedYear) ? 2026 : parsedYear < 100 ? 2000 + parsedYear : parsedYear;
    const date = new Date(year, month, day);
    do {
        date.setDate(date.getDate() + 1);
    } while (date.getDay() === 0 || date.getDay() === 6 || isHoliday(date));

    return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear().toString().slice(-2)}`;
}

function isHoliday(date: Date) {
    const dayNum = date.getDate();
    const monthNum = date.getMonth();
    const yearNum = date.getFullYear();
    return yearNum === 2026 && monthNum === 1 && (dayNum === 16 || dayNum === 17);
}

export function newIndicatorRow(): Indicator {
    return {
        id: Date.now().toString(),
        fecha: '',
        fuente: '',
        indicador: '',
        referencia: '',
        dato: '',
        trend: 'neutral',
        hasDetails: false,
    };
}

export function newEmisionRow(rows: EmisionAdminRow[]): EmisionAdminRow {
    return {
        fecha: rows.length > 0 ? getNextWorkingDate(rows[rows.length - 1].fecha) : '',
        TOTAL: 0,
        CompraDolares: 0,
        TC: 0,
        BCRA: 0,
        Vencimientos: 0,
        Licitado: 0,
        Licitaciones: 0,
        'Resultado fiscal': 0,
    };
}

export function updateEmisionCell(rows: EmisionAdminRow[], index: number, field: EmisionAdminEditableField, value: string) {
    if (field === 'Rollover' && !canEditRollover(rows[index])) return rows;
    const newData = [...rows];
    if (field === 'fecha') {
        newData[index] = { ...newData[index], [field]: value };
        return newData;
    }

    const numericField: EmisionAdminNumericField = field;
    const cleaned = field === 'Rollover' ? value.replace(',', '.') : value.replace(/\./g, '');
    const fieldValue = value === '-' ? '-' : Number.isNaN(Number(cleaned)) ? 0 : Number(cleaned);
    newData[index] = { ...newData[index], [numericField]: fieldValue };
    if (field === 'Rollover' && /[,.]/.test(value)) newData[index].Rollover = value;
    const rollover = Number(String(newData[index].Rollover).replace(',', '.'));
    if (canEditRollover(newData[index]) && (field === 'Rollover' || field === 'Licitado') && Number.isFinite(rollover) && rollover > 0) {
        newData[index].Vencimientos = Math.round((Number(newData[index].Licitado) || 0) * 100 / rollover);
    }
    if (field === 'Licitado' && !canEditRollover(newData[index])) {
        newData[index].Rollover = Number(newData[index].Vencimientos) > 0 ? Number(newData[index].Licitado) / Number(newData[index].Vencimientos) * 100 : 0;
    }
    newData[index].BCRA = (Number(newData[index].CompraDolares) || 0) * (Number(newData[index].TC) || 0);
    newData[index].Licitaciones = (Number(newData[index].Vencimientos) || 0) - (Number(newData[index].Licitado) || 0);
    newData[index].TOTAL = (Number(newData[index].BCRA) || 0) + (Number(newData[index].Licitaciones) || 0) + (Number(newData[index]['Resultado fiscal']) || 0);
    return withRunningTotal(newData);
}

function withRunningTotal(rows: EmisionAdminRow[]) {
    let runningSum = 0;
    return rows.map(row => {
        runningSum += (Number(row.TOTAL) || 0);
        return { ...row, ACUMULADO: runningSum };
    });
}
