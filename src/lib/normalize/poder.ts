import type { NumericValue, PoderAdquisitivoNormalizedRow, PoderAdquisitivoRawRow } from '@/types';
import { MONTHS_ES } from './dates';
import { notNull, toNumber } from './numbers';

const INFORMAL_SALARY_LAG_MONTHS = 5;

function addMonths(fecha: string, offset: number): string {
    const [year, month] = fecha.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().split('T')[0];
}

export function normalizePoderAdquisitivo(rawData: PoderAdquisitivoRawRow[]): PoderAdquisitivoNormalizedRow[] {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const sorted = [...rawData].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const baseIdx = sorted.findIndex(row => row.fecha === '2017-01-01');
    if (baseIdx === -1) return [];

    const baseRow = sorted[baseIdx];
    const ipcBase = toNumber(baseRow.ipc_nucleo);
    if (!ipcBase) return [];

    const informalSalaryByFecha = new Map(
        sorted.map(row => [addMonths(row.fecha, -INFORMAL_SALARY_LAG_MONTHS), row.salario_no_registrado]),
    );

    const factors = {
        blanco: toNumber(baseRow.salario_registrado) / ipcBase,
        negro: toNumber(informalSalaryByFecha.get(baseRow.fecha)) / ipcBase,
        privado: toNumber(baseRow.salario_privado) / ipcBase,
        publico: toNumber(baseRow.salario_publico) / ipcBase,
        ripte: toNumber(baseRow.ripte) / ipcBase,
        jubilacion: toNumber(baseRow.jubilacion_minima) / ipcBase,
    };

    return sorted.map(row => {
        const ipc = toNumber(row.ipc_nucleo);
        if (!ipc) return null;
        const calc = (value: NumericValue, factor: number) => value == null || !factor ? null : (Number(value) / ipc / factor) * 100;
        const date = new Date(row.fecha + 'T12:00:00Z');

        return {
            fecha: `${MONTHS_ES[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(-2)}`,
            iso_fecha: row.fecha,
            blanco: calc(row.salario_registrado, factors.blanco),
            negro: calc(informalSalaryByFecha.get(row.fecha), factors.negro),
            privado: calc(row.salario_privado, factors.privado),
            publico: calc(row.salario_publico, factors.publico),
            ripte: calc(row.ripte, factors.ripte),
            jubilacion: calc(row.jubilacion_minima, factors.jubilacion),
        };
    }).filter(notNull);
}
