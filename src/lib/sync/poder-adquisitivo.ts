import type { PoderAdquisitivoRawRow } from '@/types';
import { parseSalaryPublicationDate } from '../salary-source';
import { SALARY_PUBLICATION_PAGE_URL } from './constants';
import { fetchCSV, fetchFromUrl, fetchTextFromUrl } from './http-client';
import { seriesValueMap } from './series';

const OFFICIAL_SALARY_CSV_URL = 'https://www.indec.gob.ar/ftp/cuadros/sociedad/indice_salarios.csv';

function parseDecimal(value: string | undefined): number | null {
    if (!value || value === 'NA') return null;
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
}

function parseSalaryDate(value: string | undefined): string | null {
    const match = value?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return null;
    return `${match[3]}-${String(Number(match[2])).padStart(2, '0')}-01`;
}

export function parseOfficialSalaryCsvRows(csv: string): Map<string, Pick<PoderAdquisitivoRawRow, 'salario_registrado' | 'salario_no_registrado' | 'salario_privado' | 'salario_publico'>> {
    const rows = new Map<string, Pick<PoderAdquisitivoRawRow, 'salario_registrado' | 'salario_no_registrado' | 'salario_privado' | 'salario_publico'>>();
    for (const line of csv.trim().split('\n').slice(1)) {
        const [periodo, privado, publico, registrado, noRegistrado] = line.trim().split(';');
        const fecha = parseSalaryDate(periodo);
        if (!fecha) continue;
        rows.set(fecha, {
            salario_registrado: parseDecimal(registrado),
            salario_no_registrado: parseDecimal(noRegistrado),
            salario_privado: parseDecimal(privado),
            salario_publico: parseDecimal(publico),
        });
    }
    return rows;
}

function buildSalaryRow(fecha: string, salaryRow: Partial<PoderAdquisitivoRawRow> | null, ipc: Map<string, number>, jubilaciones: Map<string, number>, ripte: Map<string, string>): PoderAdquisitivoRawRow {
    return {
        fecha,
        ipc_nucleo: ipc.get(fecha) ?? null,
        salario_registrado: salaryRow?.salario_registrado ?? null,
        salario_no_registrado: salaryRow?.salario_no_registrado ?? null,
        salario_privado: salaryRow?.salario_privado ?? null,
        salario_publico: salaryRow?.salario_publico ?? null,
        ripte: ripte.get(fecha) ? Number(ripte.get(fecha)) : null,
        jubilacion_minima: jubilaciones.get(fecha) ? Number(jubilaciones.get(fecha)) : null,
    };
}

export async function fetchPoderAdquisitivoRawReport(): Promise<{ rows: PoderAdquisitivoRawRow[]; publishedAt: string | null }> {
    const [ipc, jubilaciones, salariosCsv, ripteCsv, publicationHtml] = await Promise.all([
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=148.3_INUCLEONAL_DICI_M_19&limit=5000'),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=58.1_MP_0_M_24&limit=5000'),
        fetchTextFromUrl(OFFICIAL_SALARY_CSV_URL),
        fetchCSV('https://infra.datos.gob.ar/catalog/sspm/dataset/158/distribution/158.1/download/remuneracion-imponible-promedio-trabajadores-estables-ripte-total-pais-pesos-serie-mensual.csv'),
        fetchTextFromUrl(SALARY_PUBLICATION_PAGE_URL),
    ]);

    const ipcByFecha = seriesValueMap(ipc.data || []);
    const jubilacionesByFecha = seriesValueMap(jubilaciones.data || []);
    const salariosByFecha = parseOfficialSalaryCsvRows(salariosCsv);
    const ripteByFecha = new Map(ripteCsv.slice(1).map(row => [row[0], row[1]]));
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

export async function fetchPoderAdquisitivoRaw(): Promise<PoderAdquisitivoRawRow[]> {
    return (await fetchPoderAdquisitivoRawReport()).rows;
}
