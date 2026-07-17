// Import the implementation module directly: the package root runs a debug harness when
// `module.parent` is missing (common under Vitest / certain bundlers).
import pdf from 'pdf-parse/lib/pdf-parse.js';
import type { PobrezaRawRow } from '@/types';
import { fetchBufferFromUrl, fetchFromUrl, fetchTextFromUrl } from './sync/http-client';
import { extractUtdtChartData, periodToFecha } from './pobreza-ocr';

const INDEC_POBREZA_SERIES_ID = '64.2_POBLACION_NUA_0_0_34_74';
const UTDT_POBREZA_URL = 'https://www.utdt.edu/ver_contenido.php?id_contenido=22217&id_item_menu=36605';
const UTDT_ORIGIN = 'https://www.utdt.edu';
const PDF_FETCH_CONCURRENCY = 4;

export type UtdtPeriodPdfLink = {
    period: string;
    url: string;
};

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

function stripHtml(html: string): string {
    return html.replace(/&nbsp;/g, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parsePercentToken(token: string): number | null {
    const value = Number(token.replace(',', '.'));
    return Number.isFinite(value) ? value : null;
}

export function parseUtdtChartImageUrl(html: string): string | null {
    const section = html.match(/El siguiente gr[aá]fico[\s\S]*?<img\s+src=["']([^"']+\.(?:png|webp|jpe?g))["']/i);
    const matched = section?.[1]
        ?? Array.from(html.matchAll(/<img\s+src=["']([^"']+\.(?:png|webp|jpe?g))["']/gi))
            .map(match => match[1])
            .find(src => /\/imagen\/_\d+\.(?:png|webp|jpe?g)$/i.test(src));
    return matched ? absoluteUtdtUrl(matched) : null;
}

/** Archive of monthly nowcast reports linked on the UTDT page (period label → PDF). */
export function parseUtdtPeriodPdfLinks(html: string): UtdtPeriodPdfLink[] {
    const links: UtdtPeriodPdfLink[] = [];
    const seen = new Set<string>();

    for (const match of html.matchAll(/<a[^>]+href=["']([^"']*download\.php\?fname=[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        const period = stripHtml(match[2]);
        if (!/^[A-Za-z]{3}\d{2}[A-Za-z]{3}\d{2}$/.test(period)) continue;
        if (seen.has(period)) continue;
        seen.add(period);
        links.push({ period, url: absoluteUtdtUrl(match[1]) });
    }

    return links;
}

export function parsePovertyRateFromPdfText(text: string): number | null {
    const normalized = text.replace(/\s+/g, ' ');
    const patterns = [
        /nowcast estima una tasa de pobreza de\s*([\d.,]+)\s*(?:%|por\s*ciento)/i,
        /estima una tasa de pobreza de\s*([\d.,]+)\s*(?:%|por\s*ciento)/i,
        /tasa de pobreza de\s*([\d.,]+)\s*(?:%|por\s*ciento)/i,
    ];

    for (const pattern of patterns) {
        const match = normalized.match(pattern);
        if (!match) continue;
        const value = parsePercentToken(match[1]);
        if (value != null && value >= 15 && value <= 70) return value;
    }

    return null;
}

export function parseLatestUtdtNowcastRow(html: string): PobrezaRawRow | null {
    const text = stripHtml(html);
    const match = text.match(/pobreza\s+de\s+([\d.,]+)%\s+para\s+el\s+semestre\s+([A-Za-z]{3}\d{2}[A-Za-z]{3}\d{2})/i)
        ?? text.match(/pobreza\s+de\s+([\d.,]+)\s+por\s+ciento\s+para\s+el\s+semestre\s+([A-Za-z]{3}\d{2}[A-Za-z]{3}\d{2})/i);
    if (!match) return null;
    const fecha = periodToFecha(match[2]);
    const value = parsePercentToken(match[1]);
    return fecha && value != null ? { fecha, pobreza_utdt: value } : null;
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

export async function extractPovertyRateFromPdfBuffer(buffer: Buffer): Promise<number | null> {
    try {
        const parsed = await pdf(buffer);
        return parsePovertyRateFromPdfText(parsed.text ?? '');
    } catch (error) {
        console.error('Failed to parse UTDT poverty PDF:', error);
        return null;
    }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
    if (items.length === 0) return [];
    const results = new Array<R>(items.length);
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await mapper(items[index]);
        }
    }

    await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
    return results;
}

export async function fetchUtdtRowsFromPeriodPdfs(links: UtdtPeriodPdfLink[]): Promise<PobrezaRawRow[]> {
    const rows = await mapWithConcurrency(links, PDF_FETCH_CONCURRENCY, async (link) => {
        const fecha = periodToFecha(link.period);
        if (!fecha) return null;

        try {
            const buffer = await fetchBufferFromUrl(link.url);
            const value = await extractPovertyRateFromPdfBuffer(buffer);
            if (value == null) {
                console.warn(`UTDT PDF ${link.period}: could not extract poverty rate`);
                return null;
            }
            return { fecha, pobreza_utdt: value } satisfies PobrezaRawRow;
        } catch (error) {
            console.error(`UTDT PDF ${link.period}: download/parse failed`, error);
            return null;
        }
    });

    const byFecha = new Map<string, PobrezaRawRow>();
    for (const row of rows) {
        if (row) byFecha.set(row.fecha, row);
    }

    return Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
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

async function fetchUtdtPublishedAt(imageUrl: string | null): Promise<string | null> {
    try {
        const requests: Array<Promise<Response>> = [fetch(UTDT_POBREZA_URL, { method: 'HEAD' })];
        if (imageUrl) requests.push(fetch(imageUrl, { method: 'HEAD' }));
        const responses = await Promise.all(requests);
        return responses.reduce<string | null>((latest, response) => (
            latestDate(latest, isoDateFromHttpDate(response.headers.get('last-modified')))
        ), null);
    } catch {
        return null;
    }
}

async function fetchUtdtRowsFromChartOcr(html: string): Promise<PobrezaRawRow[]> {
    try {
        const imageUrl = parseUtdtChartImageUrl(html);
        if (!imageUrl) return [];
        const chartData = await extractUtdtChartData(imageUrl);
        return parseUtdtNowcastRowsFromChartData(chartData);
    } catch (error) {
        console.error('Failed to extract UTDT nowcast from chart OCR:', error);
        return [];
    }
}

async function fetchUtdtPobrezaReport(): Promise<PobrezaSourceReport> {
    try {
        const html = await fetchTextFromUrl(UTDT_POBREZA_URL);
        const periodLinks = parseUtdtPeriodPdfLinks(html);
        const imageUrl = parseUtdtChartImageUrl(html);
        const publishedAt = await fetchUtdtPublishedAt(imageUrl);

        const byFecha = new Map<string, PobrezaRawRow>();

        // Primary source: monthly PDF archive linked on the UTDT page.
        if (periodLinks.length > 0) {
            for (const row of await fetchUtdtRowsFromPeriodPdfs(periodLinks)) {
                byFecha.set(row.fecha, row);
            }
        }

        // Fallback / complement: OCR of the evolution chart when PDFs fail or are partial.
        if (byFecha.size < 3) {
            for (const row of await fetchUtdtRowsFromChartOcr(html)) {
                if (!byFecha.has(row.fecha)) byFecha.set(row.fecha, row);
            }
        }

        // Prefer the headline value printed on the page for the latest period.
        const latestTextRow = parseLatestUtdtNowcastRow(html);
        if (latestTextRow) byFecha.set(latestTextRow.fecha, latestTextRow);

        const rows = Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
        if (rows.length === 0) {
            console.error('UTDT nowcast: no rows extracted from PDFs, OCR, or page text.');
        }

        return { rows, publishedAt };
    } catch (error) {
        console.error('Failed to extract UTDT nowcast:', error);
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
