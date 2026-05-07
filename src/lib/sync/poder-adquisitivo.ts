import type { PoderAdquisitivoRawRow } from '@/types';
import { parseSalaryPublicationDate } from '../salary-source';
import { SALARY_PUBLICATION_PAGE_URL } from './constants';
import { fetchCSV, fetchFromUrl, fetchTextFromUrl } from './http-client';
import { seriesValueMap } from './series';

function buildSalaryRow(fecha: string, salaryRow: string[] | null, ipc: Map<string, number>, jubilaciones: Map<string, number>, ripte: Map<string, string>): PoderAdquisitivoRawRow {
    return {
        fecha,
        ipc_nucleo: ipc.get(fecha) ?? null,
        salario_registrado: salaryRow?.[2] ? Number(salaryRow[2]) : null,
        salario_no_registrado: salaryRow?.[5] ? Number(salaryRow[5]) : null,
        salario_privado: salaryRow?.[3] ? Number(salaryRow[3]) : null,
        salario_publico: salaryRow?.[4] ? Number(salaryRow[4]) : null,
        ripte: ripte.get(fecha) ? Number(ripte.get(fecha)) : null,
        jubilacion_minima: jubilaciones.get(fecha) ? Number(jubilaciones.get(fecha)) : null,
    };
}

export async function fetchPoderAdquisitivoRawReport(): Promise<{ rows: PoderAdquisitivoRawRow[]; publishedAt: string | null }> {
    const [ipc, jubilaciones, salariosCsv, ripteCsv, publicationHtml] = await Promise.all([
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INUCLEONAL_DICI_M_19&limit=5000'),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=58.1_MP_0_M_24&limit=5000'),
        fetchCSV('https://infra.datos.gob.ar/catalog/sspm/dataset/149/distribution/149.1/download/indice-salarios-periodicidad-mensual-base-octubre-2016.csv'),
        fetchCSV('https://infra.datos.gob.ar/catalog/sspm/dataset/158/distribution/158.1/download/remuneracion-imponible-promedio-trabajadores-estables-ripte-total-pais-pesos-serie-mensual.csv'),
        fetchTextFromUrl(SALARY_PUBLICATION_PAGE_URL),
    ]);

    const ipcByFecha = seriesValueMap(ipc.data || []);
    const jubilacionesByFecha = seriesValueMap(jubilaciones.data || []);
    const ripteByFecha = new Map(ripteCsv.slice(1).map(row => [row[0], row[1]]));
    const combinedMap = new Map<string, PoderAdquisitivoRawRow>();

    for (const row of salariosCsv.slice(1)) {
        if (row[0]) combinedMap.set(row[0], buildSalaryRow(row[0], row, ipcByFecha, jubilacionesByFecha, ripteByFecha));
    }

    for (const fecha of ipcByFecha.keys()) {
        if (!combinedMap.has(fecha)) combinedMap.set(fecha, buildSalaryRow(String(fecha), null, ipcByFecha, jubilacionesByFecha, ripteByFecha));
    }

    return {
        rows: Array.from(combinedMap.values()).sort((a, b) => a.fecha.localeCompare(b.fecha)),
        publishedAt: parseSalaryPublicationDate(publicationHtml),
    };
}

export async function fetchPoderAdquisitivoRaw(): Promise<PoderAdquisitivoRawRow[]> {
    return (await fetchPoderAdquisitivoRawReport()).rows;
}
