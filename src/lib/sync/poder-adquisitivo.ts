import { fetchIpcNucleoSeries } from './cache';
import type { PoderAdquisitivoRawRow } from '@/types';
import { parseSalaryPublicationDate } from '../salary-source';
import { fetchTableSeries, type TableSeriesSpec } from '../protocols';
import { SALARY_PUBLICATION_PAGE_URL } from './constants';
import { fetchTextFromUrl } from './http-client';
import { fetchTimeSeries } from './time-series-client';
import { seriesValueMap } from './series';

/** INDEC salary index by sector (1/m/yyyy periods, decimal commas, NA for missing). */
export const INDEC_SALARIES_CSV: TableSeriesSpec<'salario_privado' | 'salario_publico' | 'salario_registrado' | 'salario_no_registrado'> = {
    url: 'https://www.indec.gob.ar/ftp/cuadros/sociedad/indice_salarios.csv',
    date: { column: 'periodo', format: 'd/m/yyyy' },
    numberFormat: 'es-AR',
    fields: {
        salario_privado: { column: 'IS_sector_privado_registrado' },
        salario_publico: { column: 'IS_sector_publico' },
        salario_registrado: { column: 'IS_total_registrado' },
        salario_no_registrado: { column: 'IS_sector_no_registrado' },
    },
};

/** Average taxable pay of stable workers (RIPTE), pesos per month. */
export const RIPTE_CSV: TableSeriesSpec<'ripte'> = {
    url: 'https://infra.datos.gob.ar/catalog/sspm/dataset/158/distribution/158.1/download/remuneracion-imponible-promedio-trabajadores-estables-ripte-total-pais-pesos-serie-mensual.csv',
    date: { column: 'indice_tiempo', format: 'iso' },
    numberFormat: 'en',
    fields: { ripte: { column: 'ripte' } },
};

function buildSalaryRow(fecha: string, salaryRow: Partial<PoderAdquisitivoRawRow> | null, ipc: Map<string, number>, jubilaciones: Map<string, number>, ripte: Map<string, number | null>): PoderAdquisitivoRawRow {
    return {
        fecha,
        ipc_nucleo: ipc.get(fecha) ?? null,
        salario_registrado: salaryRow?.salario_registrado ?? null,
        salario_no_registrado: salaryRow?.salario_no_registrado ?? null,
        salario_privado: salaryRow?.salario_privado ?? null,
        salario_publico: salaryRow?.salario_publico ?? null,
        ripte: ripte.get(fecha) ?? null,
        jubilacion_minima: jubilaciones.get(fecha) ? Number(jubilaciones.get(fecha)) : null,
    };
}

export async function fetchPoderAdquisitivoRawReport(): Promise<{ rows: PoderAdquisitivoRawRow[]; publishedAt: string | null }> {
    const [ipc, jubilaciones, salaryRows, ripteRows, publicationHtml] = await Promise.all([
        fetchIpcNucleoSeries(),
        fetchTimeSeries({ ids: ['58.1_MP_0_M_24'] }),
        fetchTableSeries(INDEC_SALARIES_CSV),
        fetchTableSeries(RIPTE_CSV),
        fetchTextFromUrl(SALARY_PUBLICATION_PAGE_URL),
    ]);

    const ipcByFecha = seriesValueMap(ipc.data || []);
    const jubilacionesByFecha = seriesValueMap(jubilaciones.data || []);
    const salariosByFecha = new Map(salaryRows.map(({ fecha, ...salary }) => [fecha, salary]));
    const ripteByFecha = new Map(ripteRows.map(row => [row.fecha, row.ripte]));
    const combinedMap = new Map<string, PoderAdquisitivoRawRow>();

    for (const [fecha, salaryRow] of salariosByFecha) {
        combinedMap.set(fecha, buildSalaryRow(fecha, salaryRow, ipcByFecha, jubilacionesByFecha, ripteByFecha));
    }

    for (const fecha of ipcByFecha.keys()) {
        if (!combinedMap.has(fecha)) combinedMap.set(fecha, buildSalaryRow(String(fecha), null, ipcByFecha, jubilacionesByFecha, ripteByFecha));
    }

    return {
        rows: Array.from(combinedMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha)),
        publishedAt: parseSalaryPublicationDate(publicationHtml),
    };
}
