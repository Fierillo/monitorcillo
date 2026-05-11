import type { InflacionNormalizedRow, InflacionRawRow } from '@/types';
import { MONTHS_ES } from './dates';
import { toNullableNumber } from './numbers';

export function normalizeInflacion(rawData: InflacionRawRow[]): InflacionNormalizedRow[] {
    if (!Array.isArray(rawData) || rawData.length === 0) return [];

    const sorted = [...rawData]
        .filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.fecha))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));

    const indecGeneralByFecha = new Map<string, number>();
    const indecNucleoByFecha = new Map<string, number>();
    const equilibraByFecha = new Map<string, number>();
    const onlineByFecha = new Map<string, number>();

    for (const row of sorted) {
        if (row.ipc_indec_general != null) indecGeneralByFecha.set(row.fecha, Number(row.ipc_indec_general));
        if (row.ipc_indec_nucleo != null) indecNucleoByFecha.set(row.fecha, Number(row.ipc_indec_nucleo));
        if (row.ipc_equilibra != null) equilibraByFecha.set(row.fecha, Number(row.ipc_equilibra));
        if (row.ipc_online != null) onlineByFecha.set(row.fecha, Number(row.ipc_online));
    }

    const allFechas = Array.from(new Set(sorted.map(r => r.fecha))).sort();
    const normalizedRows: InflacionNormalizedRow[] = [];

    for (let i = 0; i < allFechas.length; i++) {
        const fecha = allFechas[i];
        const prevFecha = i > 0 ? allFechas[i - 1] : null;

        const currentGeneral = indecGeneralByFecha.get(fecha);
        const prevGeneral = prevFecha ? indecGeneralByFecha.get(prevFecha) : null;
        const ipcIndec = currentGeneral != null && prevGeneral != null
            ? ((currentGeneral - prevGeneral) / prevGeneral) * 100
            : null;

        const currentNucleo = indecNucleoByFecha.get(fecha);
        const prevNucleo = prevFecha ? indecNucleoByFecha.get(prevFecha) : null;
        const ipcNucleoIndec = currentNucleo != null && prevNucleo != null
            ? ((currentNucleo - prevNucleo) / prevNucleo) * 100
            : null;

        const ipcEquilibra = toNullableNumber(equilibraByFecha.get(fecha) ?? null);
        const ipcOnline = toNullableNumber(onlineByFecha.get(fecha) ?? null);

        const ipc = ipcIndec ?? ipcEquilibra ?? ipcOnline ?? null;

        const date = new Date(`${fecha}T00:00:00Z`);
        if (Number.isNaN(date.getTime())) continue;

        normalizedRows.push({
            fecha: `${MONTHS_ES[date.getUTCMonth()]} ${String(date.getUTCFullYear()).slice(-2)}`,
            iso_fecha: fecha,
            ipc_indec: ipcIndec != null ? Number(ipcIndec.toFixed(2)) : null,
            ipc_nucleo_indec: ipcNucleoIndec != null ? Number(ipcNucleoIndec.toFixed(2)) : null,
            ipc_equilibra: ipcEquilibra != null ? Number(ipcEquilibra.toFixed(2)) : null,
            ipc_online: ipcOnline != null ? Number(ipcOnline.toFixed(2)) : null,
            ipc: ipc != null ? Number(ipc.toFixed(2)) : null,
        });
    }

    return normalizedRows;
}
