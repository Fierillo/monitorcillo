import type { PobrezaRawRow } from '@/types';
import { fetchFromUrl, fetchTextFromUrl } from './sync/http-client';
import { extractUtdtChartData, periodToFecha } from './pobreza-ocr';

const INDEC_POBREZA_SERIES_ID = '64.2_POBLACION_NUA_0_0_34_74';
const UTDT_POBREZA_URL = 'https://www.utdt.edu/ver_contenido.php?id_contenido=22217&id_item_menu=36605';
const UTDT_ORIGIN = 'https://www.utdt.edu';

type PobrezaSourceReport = {
    rows: PobrezaRawRow[];
    publishedAt: string | null;
    sourcePublications?: Array<{ id: string; publishedAt: string; periodDate: string | null }>;
};

function isoDateFromHttpDate(value: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

function latestDate(a: string | null, b: string | null): string | null {
    if (!a) return b;
    if (!b) return a;
    return a > b ? a : b;
}

function absoluteUtdtUrl(url: string): string {
    return url.startsWith('http') ? url : `${UTDT_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function parseUtdtChartImageUrl(html: string): string | null {
    const section = html.match(/El siguiente gr[aá]fico[\s\S]*?<img\s+src=["']([^"']+\.png)["']/i);
    const url = section?.[1] ?? Array.from(html.matchAll(/<img\s+src=["']([^"']+\.png)["']/gi)).map(match => match[1]).find(src => /\/imagen\/_\d+\.png$/i.test(src));
    return url ? absoluteUtdtUrl(url) : null;
}

export function parseLatestUtdtNowcastRow(html: string): PobrezaRawRow | null {
    const text = html.replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const match = text.match(/pobreza\s+de\s+([\d.,]+)%\s+para\s+el\s+semestre\s+([A-Za-z]{3}\d{2}[A-Za-z]{3}\d{2})/i);
    if (!match) return null;
    const fecha = periodToFecha(match[2]);
    return fecha ? { fecha, pobreza_utdt: Number(match[1].replace(',', '.')) } : null;
}

export function parseUtdtNowcastRowsFromChartData(chartData: Record<string, number>): PobrezaRawRow[] {
    return Object.entries(chartData)
        .map(([period, value]): PobrezaRawRow | null => {
            const fecha = periodToFecha(period);
            return fecha ? { fecha, pobreza_utdt: value } : null;
        })
        .filter((row): row is PobrezaRawRow => row !== null)
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function fetchIndecPobrezaRows(): Promise<PobrezaRawRow[]> {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${INDEC_POBREZA_SERIES_ID}&format=json`;
    const response = await fetchFromUrl(url);
    return (response.data ?? [])
        .filter(row => typeof row[0] === 'string' && row[1] != null)
        .map(row => ({ fecha: row[0], pobreza_indec: Number(row[1]) * 100 }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function fetchUtdtPobrezaRows(): Promise<PobrezaRawRow[]> {
    return (await fetchUtdtPobrezaReport()).rows;
}

async function fetchUtdtPublishedAt(imageUrl: string): Promise<string | null> {
    try {
        const [page, image] = await Promise.all([
            fetch(UTDT_POBREZA_URL, { method: 'HEAD' }),
            fetch(imageUrl, { method: 'HEAD' }),
        ]);
        return latestDate(isoDateFromHttpDate(page.headers.get('last-modified')), isoDateFromHttpDate(image.headers.get('last-modified')));
    } catch {
        return null;
    }
}

async function fetchUtdtPobrezaReport(): Promise<PobrezaSourceReport> {
    try {
        const html = await fetchTextFromUrl(UTDT_POBREZA_URL);
        const imageUrl = parseUtdtChartImageUrl(html);
        if (!imageUrl) throw new Error('Failed to find UTDT nowcast chart image in page HTML.');

        const chartData = await extractUtdtChartData(imageUrl);
        const publishedAt = await fetchUtdtPublishedAt(imageUrl);

        const byFecha = new Map<string, PobrezaRawRow>(parseUtdtNowcastRowsFromChartData(chartData).map(row => [row.fecha, row]));
        const latestTextRow = parseLatestUtdtNowcastRow(html);
        if (latestTextRow) byFecha.set(latestTextRow.fecha, latestTextRow);

        const rows = Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));

        return { rows, publishedAt };
    } catch (error) {
        console.error('Failed to extract UTDT nowcast from chart:', error);
        return { rows: [], publishedAt: null };
    }
}

export async function fetchPobrezaRaw(): Promise<PobrezaRawRow[]> {
    return (await fetchPobrezaRawReport()).rows;
}

export async function fetchPobrezaRawReport(): Promise<PobrezaSourceReport> {
    const [indecRows, utdtReport] = await Promise.all([
        fetchIndecPobrezaRows(),
        fetchUtdtPobrezaReport(),
    ]);

    const byFecha = new Map(indecRows.map(row => [row.fecha, row]));

    for (const row of utdtReport.rows) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    }

    const rows = Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));

    return {
        rows,
        publishedAt: utdtReport.publishedAt,
        sourcePublications: [
            { id: 'pobreza-utdt', publishedAt: utdtReport.publishedAt, periodDate: utdtReport.rows.at(-1)?.fecha ?? null },
        ].filter((source): source is { id: string; publishedAt: string; periodDate: string | null } => source.publishedAt !== null),
    };
}
