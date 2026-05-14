import type { InflacionRawRow } from '@/types';
import * as XLSX from 'xlsx';
import { fetchFromUrl, fetchTextFromUrl } from './sync/http-client';

const INDEC_GENERAL_SERIES_ID = '145.3_INGNACNAL_DICI_M_15';
const INDEC_NUCLEO_SERIES_ID = '148.3_INUCLEONAL_DICI_M_19';
const INDEC_IPC_WORKBOOK_BASE_URL = 'https://www.indec.gob.ar/ftp/cuadros/economia';
const EQUILIBRA_FEED_URL = 'https://equilibra.ar/feed/?cat=19';
const IPC_ONLINE_FEED_URL = 'https://ipconlinebb.wordpress.com/feed/';

const MONTHS_ES: Record<string, number> = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const MONTHS_XLS: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    ene: 1, abr: 4, ago: 8, dic: 12,
};

type InflacionSourceReport = {
    rows: InflacionRawRow[];
    publishedAt: string | null;
    sourcePublications?: Array<{ id: string; publishedAt: string; periodDate: string | null }>;
};

type IndecIpcVariationRow = {
    fecha: string;
    ipc_indec: number | null;
    ipc_nucleo_indec: number | null;
};

type IndecIpcWorkbookReport = {
    rows: IndecIpcVariationRow[];
    publishedAt: string | null;
};

function parseDecimal(value: string): number {
    return Number(value.replace(',', '.'));
}

function parseOptionalDecimal(value: unknown): number | null {
    if (value == null || value === '') return null;
    const parsed = Number(String(value).replace('%', '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
}

function parseWorkbookMonth(value: unknown): string | null {
    const match = String(value ?? '').trim().match(/^([A-Za-zÁÉÍÓÚáéíóú]{3})-(\d{2})$/);
    if (!match) return null;
    const month = MONTHS_XLS[match[1].toLowerCase()];
    if (!month) return null;
    return `20${match[2]}-${String(month).padStart(2, '0')}-01`;
}

function isoDateFromValue(value: string | undefined): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

function latestDate(a: string | null, b: string | null): string | null {
    if (!a) return b;
    if (!b) return a;
    return a > b ? a : b;
}

export async function fetchIndecIpcRows(seriesId: string): Promise<{ fecha: string; valor: number }[]> {
    const url = `https://apis.datos.gob.ar/series/api/series/?ids=${seriesId}&format=json&limit=5000`;
    const response = await fetchFromUrl(url);
    return (response.data ?? [])
        .filter((row): row is [string, number] => typeof row[0] === 'string' && row[1] != null)
        .map(row => ({ fecha: row[0], valor: Number(row[1]) }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

function latestIndecWorkbookUrls(): string[] {
    const date = new Date();
    const urls: string[] = [];
    for (let offset = 0; offset < 12; offset++) {
        const candidate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - offset, 1));
        const month = String(candidate.getUTCMonth() + 1).padStart(2, '0');
        const year = String(candidate.getUTCFullYear()).slice(-2);
        urls.push(`${INDEC_IPC_WORKBOOK_BASE_URL}/sh_ipc_${month}_${year}.xls`);
    }
    return urls;
}

export function parseIndecIpcWorkbook(buffer: Buffer): IndecIpcVariationRow[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames.find(name => /variaci[oó]n mensual IPC nacional/i.test(name));
    if (!sheetName) return [];

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: null }) as unknown[][];
    const headerIndex = rows.findIndex(row => /^total nacional$/i.test(String(row[0] ?? '').trim()));
    if (headerIndex < 0) return [];

    const general = rows.slice(headerIndex + 1).find(row => /^nivel general$/i.test(String(row[0] ?? '').trim()));
    const nucleo = rows.slice(headerIndex + 1).find(row => /^n[uú]cleo$/i.test(String(row[0] ?? '').trim()));
    if (!general || !nucleo) return [];

    return rows[headerIndex]
        .slice(1)
        .map((value, index): IndecIpcVariationRow | null => {
            const fecha = parseWorkbookMonth(value);
            if (!fecha) return null;
            const ipcIndecVariacion = parseOptionalDecimal(general[index + 1]);
            const ipcNucleoIndecVariacion = parseOptionalDecimal(nucleo[index + 1]);
            if (ipcIndecVariacion == null && ipcNucleoIndecVariacion == null) return null;
            return {
                fecha,
                ipc_indec: ipcIndecVariacion,
                ipc_nucleo_indec: ipcNucleoIndecVariacion,
            };
        })
        .filter((row): row is IndecIpcVariationRow => row !== null);
}

function isoDateFromHttpDate(value: string | null): string | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

async function fetchIndecIpcWorkbookReport(): Promise<IndecIpcWorkbookReport> {
    for (const url of latestIndecWorkbookUrls()) {
        try {
            const response = await fetch(url);
            if (!response.ok) continue;
            const rows = parseIndecIpcWorkbook(Buffer.from(await response.arrayBuffer()));
            return { rows, publishedAt: isoDateFromHttpDate(response.headers.get('last-modified')) };
        } catch {
            continue;
        }
    }
    return { rows: [], publishedAt: null };
}

function completeIndecIndexRows(byFecha: Map<string, InflacionRawRow>, variations: IndecIpcVariationRow[]): void {
    for (const row of variations.sort((a, b) => a.fecha.localeCompare(b.fecha))) {
        const prevFecha = new Date(`${row.fecha}T00:00:00Z`);
        prevFecha.setUTCMonth(prevFecha.getUTCMonth() - 1);
        const previous = byFecha.get(prevFecha.toISOString().split('T')[0]);
        const current = byFecha.get(row.fecha) ?? { fecha: row.fecha };

        const ipcIndecGeneral = current.ipc_indec_general ?? (
            previous?.ipc_indec_general != null && row.ipc_indec != null
                ? Number(previous.ipc_indec_general) * (1 + row.ipc_indec / 100)
                : undefined
        );
        const ipcIndecNucleo = current.ipc_indec_nucleo ?? (
            previous?.ipc_indec_nucleo != null && row.ipc_nucleo_indec != null
                ? Number(previous.ipc_indec_nucleo) * (1 + row.ipc_nucleo_indec / 100)
                : undefined
        );

        byFecha.set(row.fecha, {
            ...current,
            ipc_indec_general: ipcIndecGeneral,
            ipc_indec_nucleo: ipcIndecNucleo,
        });
    }
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
    return (await fetchEquilibraIpcReport()).rows;
}

async function fetchEquilibraIpcReport(): Promise<InflacionSourceReport> {
    try {
        const apiText = await fetchTextFromUrl('https://equilibra.ar/wp-json/wp/v2/posts?categories=19&per_page=100');
        const posts = JSON.parse(apiText) as Array<{ date?: string; title?: { rendered?: string }; link?: string }>;
        const mensualPosts = posts
            .filter(p => /mensual/i.test(p.title?.rendered ?? ''))
            .map(p => ({ title: p.title?.rendered ?? '', link: p.link ?? '', publishedAt: isoDateFromValue(p.date) }));

        const rows: InflacionRawRow[] = [];
        const seenFechas = new Set<string>();
        let publishedAt: string | null = null;

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
                    return { row: { fecha, ipc_equilibra: ipc }, publishedAt: post.publishedAt };
                })
            );
            for (const result of results) {
                if (!result) continue;
                rows.push(result.row);
                publishedAt = latestDate(publishedAt, result.publishedAt);
            }
        }

        return { rows: rows.sort((a, b) => a.fecha.localeCompare(b.fecha)), publishedAt };
    } catch (error) {
        console.error('[inflacion-source] Failed to fetch Equilibra:', error);
        return { rows: [], publishedAt: null };
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
    return (await fetchIpcOnlineReport()).rows;
}

async function fetchIpcOnlineReport(): Promise<InflacionSourceReport> {
    try {
        const rows: InflacionRawRow[] = [];
        const seenFechas = new Set<string>();
        let publishedAt: string | null = null;

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
                publishedAt = latestDate(publishedAt, isoDateFromValue(item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1]));
                newItems++;
            }
            if (newItems === 0) break;
        }

        return { rows: rows.sort((a, b) => a.fecha.localeCompare(b.fecha)), publishedAt };
    } catch (error) {
        console.error('[inflacion-source] Failed to fetch IPC Online:', error);
        return { rows: [], publishedAt: null };
    }
}

export async function fetchInflacionRaw(): Promise<InflacionRawRow[]> {
    return (await fetchInflacionRawReport()).rows;
}

export async function fetchInflacionRawReport(): Promise<InflacionSourceReport> {
    const [indecGeneral, indecNucleo, indecWorkbookReport, equilibraReport, onlineReport] = await Promise.all([
        fetchIndecIpcRows(INDEC_GENERAL_SERIES_ID),
        fetchIndecIpcRows(INDEC_NUCLEO_SERIES_ID),
        fetchIndecIpcWorkbookReport(),
        fetchEquilibraIpcReport(),
        fetchIpcOnlineReport(),
    ]);

    const byFecha = new Map<string, InflacionRawRow>();

    for (const row of indecGeneral) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), fecha: row.fecha, ipc_indec_general: row.valor });
    }
    for (const row of indecNucleo) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), fecha: row.fecha, ipc_indec_nucleo: row.valor });
    }
    completeIndecIndexRows(byFecha, indecWorkbookReport.rows);
    for (const row of equilibraReport.rows) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    }
    for (const row of onlineReport.rows) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    }

    return {
        rows: Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha)),
        publishedAt: latestDate(indecWorkbookReport.publishedAt, latestDate(equilibraReport.publishedAt, onlineReport.publishedAt)),
        sourcePublications: [
            { id: 'inflacion-indec', publishedAt: indecWorkbookReport.publishedAt, periodDate: indecWorkbookReport.rows.at(-1)?.fecha ?? null },
            { id: 'inflacion-equilibra', publishedAt: equilibraReport.publishedAt, periodDate: equilibraReport.rows.at(-1)?.fecha ?? null },
            { id: 'inflacion-ipc-online', publishedAt: onlineReport.publishedAt, periodDate: onlineReport.rows.at(-1)?.fecha ?? null },
        ].filter((source): source is { id: string; publishedAt: string; periodDate: string | null } => source.publishedAt !== null),
    };
}
