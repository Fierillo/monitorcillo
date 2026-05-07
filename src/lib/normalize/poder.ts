import type { NumericValue, PoderAdquisitivoNormalizedRow, PoderAdquisitivoRawRow } from '@/types';
import { MONTHS_ES } from './dates';
import { notNull, toNumber } from './numbers';

export function normalizePoderAdquisitivo(rawData: PoderAdquisitivoRawRow[]): PoderAdquisitivoNormalizedRow[] {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const sorted = [...rawData].sort((a, b) => a.fecha.localeCompare(b.fecha));
    const baseIdx = sorted.findIndex(row => row.fecha === '2017-01-01');
    if (baseIdx === -1) return [];

    const baseRow = sorted[baseIdx];
    const ipcBase = toNumber(baseRow.ipc_nucleo);
    if (!ipcBase) return [];

    const negroBaseRaw = sorted[baseIdx + 5]?.salario_no_registrado;
    const factors = {
        blanco: toNumber(baseRow.salario_registrado) / ipcBase,
        negro: toNumber(negroBaseRaw) / ipcBase,
        privado: toNumber(baseRow.salario_privado) / ipcBase,
        publico: toNumber(baseRow.salario_publico) / ipcBase,
        ripte: toNumber(baseRow.ripte) / ipcBase,
        jubilacion: toNumber(baseRow.jubilacion_minima) / ipcBase,
    };

    return sorted.map((row, index) => {
        const ipc = toNumber(row.ipc_nucleo);
        if (!ipc) return null;
        const calc = (value: NumericValue, factor: number) => value == null || !factor ? null : (Number(value) / ipc / factor) * 100;
        const date = new Date(row.fecha + 'T12:00:00Z');

        return {
            fecha: `${MONTHS_ES[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(-2)}`,
            iso_fecha: row.fecha,
            blanco: calc(row.salario_registrado, factors.blanco),
            negro: calc(sorted[index + 5]?.salario_no_registrado, factors.negro),
            privado: calc(row.salario_privado, factors.privado),
            publico: calc(row.salario_publico, factors.publico),
            ripte: calc(row.ripte, factors.ripte),
            jubilacion: calc(row.jubilacion_minima, factors.jubilacion),
        };
    }).filter(notNull);
}
