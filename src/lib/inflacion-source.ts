import type { InflacionRawRow } from '@/types';
import { fetchFromUrl, fetchTextFromUrl } from './sync/http-client';

const INDEC_GENERAL_SERIES_ID = '145.3_INGNACNAL_DICI_M_15';
const INDEC_NUCLEO_SERIES_ID = '148.3_INUCLEONAL_DICI_M_19';
const EQUILIBRA_FEED_URL = 'https://equilibra.ar/feed/?cat=19';
const IPC_ONLINE_FEED_URL = 'https://ipconlinebb.wordpress.com/feed/';

const MONTHS_ES: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

function parseDecimal(value: string): number {
    return Number(value.replace(',', '.'));
}

export async function fetchIndecIpcRows(seriesId: string): Promise<{ fecha: string; valor: number }[]> {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${seriesId}&format=json&limit=5000`;
    const response = await fetchFromUrl(url);
    return (response.data ?? [])
        .filter((row): row is [string, number] => typeof row[0] === 'string' && row[1] != null)
        .map(row => ({ fecha: row[0], valor: Number(row[1]) }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function extractIpcFromText(text: string): number | null {
    const patterns = [
        /inflaci[oó]n\s+nacional\s*(?:fue(?:\s+del?)?|alcanz[oó]|subi[oó]|aument[oó]|vari[oó]|trep[oó])\s*([\d.,]+)\s*%/i,
        /IPC\s*Nivel\s+General\s*(?:de|subi[oó]|aument[oó]|vari[oó]|trep[oó]|fue)\s*([\d.,]+)\s*%/i,
        /IPC\s*Nacional\s*(?:fue(?:\s+del?)?|alcanz[oó]|subi[oó]|aument[oó]|vari[oó]|trep[oó])\s*([\d.,]+)\s*%/i,
        /IPC\s*Nacional\s*([\d.,]+)\s*%/i,
        /inflaci[oó]n\s+nacional\s*([\d.,]+)\s*%/i,
        /suba\s+de\s*([\d.,]+)\s*%\s*para\s+el\s+mes/i,
        /alza\s+del\s+IPC\s*Nivel\s+General\s+de\s*([\d.,]+)\s*%/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return parseDecimal(match[1]);
    }
    return null;
}

function extractMonthYearFromTitle(title: string): { month: number; year: number } | null {
    const match = title.match(/\b([a-z]+)\s+(\d{4})\b/i);
    if (!match) return null;
    const month = MONTHS_ES[match[1].toLowerCase()];
    const year = Number(match[2]);
    if (!month || !year) return null;
    return { month, year };
}

export function parseEquilibraRssItem(xml: string): InflacionRawRow | null {
    const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
    const contentMatch = xml.match(/<content:encoded>\s*<!\[CDATA\[([\s\S]*?)\]\]>/);
    const descMatch = xml.match(/<description>\s*<!\[CDATA\[([\s\S]*?)\]\]>/);

    const title = titleMatch?.[1] ?? '';
    if (!/mensual/i.test(title)) return null;

    const content = contentMatch?.[1] ?? descMatch?.[1] ?? '';
    const text = content.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    const ipc = extractIpcFromText(text);
    if (ipc == null) return null;

    const my = extractMonthYearFromTitle(title);
    if (!my) return null;

    return { fecha: `${my.year}-${String(my.month).padStart(2, '0')}-01`, ipc_equilibra: ipc };
}

async function fetchPostHtml(link: string): Promise<string> {
    try {
        return await fetchTextFromUrl(link);
    } catch {
        return '';
    }
}

function parseEquilibraPostHtml(html: string): number | null {
    const clean = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return extractIpcFromText(clean);
}

export async function fetchEquilibraIpcRows(): Promise<InflacionRawRow[]> {
    try {
        const apiText = await fetchTextFromUrl('https://equilibra.ar/wp-json/wp/v2/posts?categories=19&per_page=100');
        const posts = JSON.parse(apiText) as Array<{ title?: { rendered?: string }; link?: string }>;
        const mensualPosts = posts
            .filter(p => /mensual/i.test(p.title?.rendered ?? ''))
            .map(p => ({ title: p.title?.rendered ?? '', link: p.link ?? '' }));

        const rows: InflacionRawRow[] = [];
        const seenFechas = new Set<string>();

        const BATCH_SIZE = 5;
        for (let i = 0; i < mensualPosts.length; i += BATCH_SIZE) {
            const batch = mensualPosts.slice(i, i + BATCH_SIZE);
            const results = await Promise.all(
                batch.map(async (post) => {
                    const my = extractMonthYearFromTitle(post.title);
                    if (!my) return null;
                    const fecha = `${my.year}-${String(my.month).padStart(2, '0')}-01`;
                    if (seenFechas.has(fecha)) return null;

                    const html = await fetchPostHtml(post.link);
                    const ipc = parseEquilibraPostHtml(html);
                    if (ipc == null) return null;

                    seenFechas.add(fecha);
                    return { fecha, ipc_equilibra: ipc };
                })
            );
            for (const row of results) {
                if (row) rows.push(row);
            }
        }

        return rows.sort((a, b) => a.fecha.localeCompare(b.fecha));
    } catch (error) {
        console.error('[inflacion-source] Failed to fetch Equilibra:', error);
        return [];
    }
}

export function parseIpcOnlineRssItem(xml: string): InflacionRawRow | null {
    const titleMatch = xml.match(/<title>([^<]+)<\/title>/);
    const descMatch = xml.match(/<description>\s*<!\[CDATA\[\s*Inflaci[oó]n:\s*([\d.,]+)%/i);
    const contentMatch = xml.match(/<content:encoded>\s*<!\[CDATA\[\s*<h2[^>]*>([\d.,]+)\s*%\s*<\/h2>/i);

    const title = titleMatch?.[1] ?? '';
    const value = descMatch?.[1] ?? contentMatch?.[1];
    if (!value) return null;

    const my = extractMonthYearFromTitle(title);
    if (!my) return null;

    return { fecha: `${my.year}-${String(my.month).padStart(2, '0')}-01`, ipc_online: parseDecimal(value) };
}

export async function fetchIpcOnlineRows(): Promise<InflacionRawRow[]> {
    try {
        const rows: InflacionRawRow[] = [];
        const seenFechas = new Set<string>();

        const pages = [IPC_ONLINE_FEED_URL, `${IPC_ONLINE_FEED_URL}?paged=2`, `${IPC_ONLINE_FEED_URL}?paged=3`, `${IPC_ONLINE_FEED_URL}?paged=4`, `${IPC_ONLINE_FEED_URL}?paged=5`, `${IPC_ONLINE_FEED_URL}?paged=6`, `${IPC_ONLINE_FEED_URL}?paged=7`, `${IPC_ONLINE_FEED_URL}?paged=8`, `${IPC_ONLINE_FEED_URL}?paged=9`, `${IPC_ONLINE_FEED_URL}?paged=10`];
        for (const url of pages) {
            const xml = await fetchTextFromUrl(url);
            const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
            if (items.length === 0) break;

            let newItems = 0;
            for (const item of items) {
                const row = parseIpcOnlineRssItem(item);
                if (!row || seenFechas.has(row.fecha)) continue;
                seenFechas.add(row.fecha);
                rows.push(row);
                newItems++;
            }
            if (newItems === 0) break;
        }

        return rows.sort((a, b) => a.fecha.localeCompare(b.fecha));
    } catch (error) {
        console.error('[inflacion-source] Failed to fetch IPC Online:', error);
        return [];
    }
}

export async function fetchInflacionRaw(): Promise<InflacionRawRow[]> {
    const [indecGeneral, indecNucleo, equilibraRows, onlineRows] = await Promise.all([
        fetchIndecIpcRows(INDEC_GENERAL_SERIES_ID),
        fetchIndecIpcRows(INDEC_NUCLEO_SERIES_ID),
        fetchEquilibraIpcRows(),
        fetchIpcOnlineRows(),
    ]);

    const byFecha = new Map<string, InflacionRawRow>();

    for (const row of indecGeneral) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), fecha: row.fecha, ipc_indec_general: row.valor });
    }
    for (const row of indecNucleo) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), fecha: row.fecha, ipc_indec_nucleo: row.valor });
    }
    for (const row of equilibraRows) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    }
    for (const row of onlineRows) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    }

    return Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}
