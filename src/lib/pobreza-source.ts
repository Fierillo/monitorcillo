import type { PobrezaRawRow } from '@/types';
import { fetchFromUrl, fetchTextFromUrl } from './sync/http-client';

const INDEC_POBREZA_SERIES_ID = '64.2_POBLACION_NUA_0_0_34_74';
const UTDT_POBREZA_URL = 'https://www.utdt.edu/ver_contenido.php?id_contenido=22217&id_item_menu=36605';
const UTDT_GITHUB_POBREZA_URL = 'https://raw.githubusercontent.com/mrozada/mrozada.github.io/master/_pages/pobreza.md';
const UTDT_REPORTS = [
    { marker: 'reporte_pobreza_q2_2025.pdf', rows: monthlyReportRows('2025-04-01', 37.3, 36.7, 37.9) },
    { marker: 'reporte_pobreza_q3_2025_final.pdf', rows: monthlyReportRows('2025-07-01', 33.2, 32.5, 33.9) },
    { marker: 'Reporte_pobreza_q4_2025_corregido.pdf', rows: monthlyReportRows('2025-10-01', 35.9, 35.2, 36.6) },
    { marker: '_177092971096373300.pdf', rows: [{ fecha: '2026-01-01', pobreza_utdt_proyectada: 31.0, pobreza_utdt_proyectada_lower: 28.8, pobreza_utdt_proyectada_upper: 31.7 }] },
    { marker: '_177334930254038900.pdf', rows: [{ fecha: '2026-02-01', pobreza_utdt_proyectada: 28.6, pobreza_utdt_proyectada_lower: 29.2, pobreza_utdt_proyectada_upper: 32.1 }] },
    { marker: '_177670649308033200.pdf', rows: [{ fecha: '2026-03-01', pobreza_utdt_proyectada: 25.6, pobreza_utdt_proyectada_lower: 27.5, pobreza_utdt_proyectada_upper: 30.4 }] },
];
const MONTHS: Record<string, number> = {
    ene: 1,
    feb: 2,
    mar: 3,
    abr: 4,
    may: 5,
    jun: 6,
    jul: 7,
    ago: 8,
    sep: 9,
    oct: 10,
    nov: 11,
    dic: 12,
};

function parseDecimal(value: string): number {
    return Number(value.replace(',', '.'));
}

function addMonths(year: number, month: number, offset: number): { year: number; month: number } {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

function addMonthsToFecha(fecha: string, offset: number): string {
    const [year, month] = fecha.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

function monthlyReportRows(start: string, pobrezaUtdt: number, pobrezaUtdtLower: number, pobrezaUtdtUpper: number): PobrezaRawRow[] {
    return [0, 1, 2].map(offset => ({
        fecha: addMonthsToFecha(start, offset),
        pobreza_utdt: pobrezaUtdt,
        pobreza_utdt_lower: pobrezaUtdtLower,
        pobreza_utdt_upper: pobrezaUtdtUpper,
    }));
}

function periodToFecha(period: string): string | null {
    const match = period.match(/([A-Za-zÁÉÍÓÚáéíóú]{3})(\d{2})([A-Za-zÁÉÍÓÚáéíóú]{3})(\d{2})/);
    if (!match) return null;

    const startMonth = MONTHS[match[1].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()];
    const startYear = 2000 + Number(match[2]);
    if (!startMonth) return null;

    const midpoint = addMonths(startYear, startMonth, 3);
    return `${midpoint.year}-${String(midpoint.month).padStart(2, '0')}-01`;
}

export function parseUtdtPobrezaNowcast(html: string): PobrezaRawRow | null {
    const text = html.replace(/\s+/g, ' ');
    const match = text.match(/tasa de pobreza de\s*([\d.,]+)%\s*para el semestre\s*([A-Za-zÁÉÍÓÚáéíóú]{3}\d{2}[A-Za-zÁÉÍÓÚáéíóú]{3}\d{2})\s*con un intervalo del 95% de confianza entre\s*\[([\d.,]+)%,\s*([\d.,]+)%\]/i);
    if (!match) return null;

    const fecha = periodToFecha(match[2]);
    if (!fecha) return null;

    const quarterlyMatch = text.match(/promedio ponderado de una tasa de pobreza de\s*([\d.,]+)\s*por ciento.*?y\s*([\d.,]+)\s*para el primer trimestre/i);

    return {
        fecha,
        pobreza_utdt_proyectada: parseDecimal(match[1]),
        pobreza_utdt_first_quarter: quarterlyMatch ? parseDecimal(quarterlyMatch[1]) : parseDecimal(match[1]),
        pobreza_utdt_second_quarter: quarterlyMatch ? parseDecimal(quarterlyMatch[2]) : parseDecimal(match[1]),
        pobreza_utdt_proyectada_lower: parseDecimal(match[3]),
        pobreza_utdt_proyectada_upper: parseDecimal(match[4]),
    };
}

export function parseUtdtGithubPobrezaRows(markdown: string): PobrezaRawRow[] {
    return UTDT_REPORTS
        .filter(report => markdown.includes(report.marker))
        .flatMap(report => report.rows);
}

export async function fetchIndecPobrezaRows(): Promise<PobrezaRawRow[]> {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${INDEC_POBREZA_SERIES_ID}&format=json`;
    const response = await fetchFromUrl(url);
    return (response.data ?? [])
        .filter(row => typeof row[0] === 'string' && row[1] != null)
        .map(row => ({ fecha: row[0], pobreza_indec: Number(row[1]) * 100 }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function fetchUtdtPobrezaRow(): Promise<PobrezaRawRow | null> {
    return parseUtdtPobrezaNowcast(await fetchTextFromUrl(UTDT_POBREZA_URL));
}

export async function fetchUtdtGithubPobrezaRows(): Promise<PobrezaRawRow[]> {
    const [githubMarkdown, utdtPage] = await Promise.all([
        fetchTextFromUrl(UTDT_GITHUB_POBREZA_URL),
        fetchTextFromUrl(UTDT_POBREZA_URL),
    ]);
    return parseUtdtGithubPobrezaRows(`${githubMarkdown}\n${utdtPage}`);
}

export async function fetchPobrezaRaw(): Promise<PobrezaRawRow[]> {
    const [indecRows, utdtRows] = await Promise.all([fetchIndecPobrezaRows(), fetchUtdtGithubPobrezaRows()]);
    const byFecha = new Map(indecRows.map(row => [row.fecha, row]));
    for (const utdtRow of utdtRows) byFecha.set(utdtRow.fecha, { ...byFecha.get(utdtRow.fecha), ...utdtRow });
    return Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
