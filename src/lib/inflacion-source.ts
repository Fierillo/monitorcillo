import type { InflacionRawRow } from '@/types';
import * as XLSX from 'xlsx';
import { unstable_cache } from 'next/cache';
import { extractFileLinks, readWorkbook, sheetRows, type HtmlFileLink } from './protocols';
import { parsePdf } from './protocols/pdf';
import { argentinaToday } from './normalize/dates';
import { firstUsable, minLatestFromRelease, minLatestPeriod } from './sync/source-chain';
import { fetchLastIndecRelease } from './release-calendars';
import { fetchBufferFromUrl, fetchTextFromUrl } from './sync/http-client';
import { fetchTimeSeries } from './sync/time-series-client';

const INDEC_GENERAL_SERIES_ID = '145.3_INGNACNAL_DICI_M_15';
const INDEC_NUCLEO_SERIES_ID = '148.3_INUCLEONAL_DICI_M_19';
const INDEC_IPIM_SERIES_ID = '448.1_NIVEL_GENERAL_0_0_13_46';
const INDEC_ORIGIN = 'https://www.indec.gob.ar';
const INDEC_IPC_PAGE_URL = `${INDEC_ORIGIN}/Nivel4/Tema/3/5/31`;
const INDEC_IPC_CSV_URL = `${INDEC_ORIGIN}/ftp/cuadros/economia/serie_ipc_divisiones.csv`;
/** IPC for month M is published around day 13 of M+1; the day lag is only used when INDEC's calendar is unavailable. */
const INDEC_IPC_RELEASE_LAG_DAYS = 45;

/** Expected newest IPC month: the one published at INDEC's latest official release (<= today), else the day-lag rule. */
async function expectedIndecIpcPeriod(today: string): Promise<string> {
    const release = await fetchLastIndecRelease('indec-ipc', today).catch(() => null);
    return release ? minLatestFromRelease(release, 1) : minLatestPeriod(today, INDEC_IPC_RELEASE_LAG_DAYS);
}
const IPC_ONLINE_FEED_URL = 'https://ipconlinebb.wordpress.com/feed/';
const REM_BCRA_API_URL = 'https://bcra-rem-api.facujallia.workers.dev/api/ipc_general';

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
    try {
        const response = await fetchTimeSeries({ ids: [seriesId] });
        return (response.data ?? [])
            .filter((row): row is [string, number] => typeof row[0] === 'string' && row[1] != null)
            .map(row => ({ fecha: row[0], valor: Number(row[1]) }))
            .sort((a, b) => a.fecha.localeCompare(b.fecha));
    } catch (error) {
        console.error(`[inflacion-source] Failed to fetch INDEC series ${seriesId}:`, error);
        return [];
    }
}

export function parseIndecIpcWorkbook(buffer: Buffer): IndecIpcVariationRow[] {
    const workbook = readWorkbook(buffer);
    const sheetName = workbook.SheetNames.find(name => /variaci[oó]n mensual IPC nacional/i.test(name));
    if (!sheetName) return [];

    const rows = sheetRows(workbook.Sheets[sheetName]);
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

export function parseIndecIpcCsv(text: string): IndecIpcVariationRow[] {
    const byFecha = new Map<string, IndecIpcVariationRow>();
    for (const line of text.split(/\r?\n/)) {
        const [codigo, descripcion, , periodo, , variacion, , region] = line.split(';').map(cell => cell?.trim());
        if (region !== 'Nacional' || !/^\d{6}$/.test(periodo ?? '')) continue;
        const field = /^nivel general$/i.test(descripcion) ? 'ipc_indec' : /^n.cleo$/i.test(codigo) ? 'ipc_nucleo_indec' : null;
        if (!field) continue;
        const fecha = `${periodo.slice(0, 4)}-${periodo.slice(4)}-01`;
        const row = byFecha.get(fecha) ?? { fecha, ipc_indec: null, ipc_nucleo_indec: null };
        row[field] = parseOptionalDecimal(variacion);
        byFecha.set(fecha, row);
    }
    return Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseIndecIpcPressRelease(text: string): IndecIpcVariationRow[] {
    const flat = text.replace(/\s+/g, ' ');
    const general = flat.match(/alza mensual de ([\d.,]+)\s*% en ([a-záéíóú]+) de (\d{4})/i);
    const month = general ? MONTHS_ES[general[2].toLowerCase()] : undefined;
    if (!general || !month) return [];
    const nucleo = flat.match(/IPC N[uú]cleo \(([\d.,]+)\s*%\)/i);
    return [{
        fecha: `${general[3]}-${String(month).padStart(2, '0')}-01`,
        ipc_indec: parseDecimal(general[1]),
        ipc_nucleo_indec: nucleo ? parseDecimal(nucleo[1]) : null,
    }];
}

function variationsFromIndex(general: { fecha: string; valor: number }[], nucleo: { fecha: string; valor: number }[]): IndecIpcVariationRow[] {
    const change = (rows: { fecha: string; valor: number }[], index: number) => index > 0 ? ((rows[index].valor - rows[index - 1].valor) / rows[index - 1].valor) * 100 : null;
    const byFecha = new Map<string, IndecIpcVariationRow>();
    general.forEach((row, index) => byFecha.set(row.fecha, { fecha: row.fecha, ipc_indec: change(general, index), ipc_nucleo_indec: null }));
    nucleo.forEach((row, index) => byFecha.set(row.fecha, { ...(byFecha.get(row.fecha) ?? { fecha: row.fecha, ipc_indec: null }), ipc_nucleo_indec: change(nucleo, index) }));
    return Array.from(byFecha.values()).filter(row => row.ipc_indec != null || row.ipc_nucleo_indec != null).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** INDEC IPC monthly variations: datos.gob.ar API -> workbook linked from the IPC page -> CSV series -> press-release PDF linked from the page. */
export async function fetchIndecIpcVariations(
    apiGeneral: { fecha: string; valor: number }[],
    apiNucleo: { fecha: string; valor: number }[],
    today: string = argentinaToday(),
): Promise<IndecIpcVariationRow[]> {
    let pageLinks: Promise<HtmlFileLink[]> | undefined;
    const linkOnPage = async (pattern: RegExp): Promise<string> => {
        pageLinks ??= fetchTextFromUrl(INDEC_IPC_PAGE_URL).then(html => extractFileLinks(html, { origin: INDEC_ORIGIN }));
        const link = (await pageLinks).find(candidate => pattern.test(candidate.href));
        if (!link) throw new Error(`No link matching ${pattern} on ${INDEC_IPC_PAGE_URL}`);
        return link.href;
    };

    return firstUsable('INDEC IPC', [
        { name: 'api', run: async () => variationsFromIndex(apiGeneral, apiNucleo) },
        { name: 'page-workbook', run: async () => parseIndecIpcWorkbook(await fetchBufferFromUrl(await linkOnPage(/sh_ipc_\d{2}_\d{2}\.xlsx?$/i), { expectedContentType: /excel|spreadsheet|octet-stream/i })) },
        { name: 'csv', run: async () => parseIndecIpcCsv((await fetchBufferFromUrl(INDEC_IPC_CSV_URL, { expectedContentType: /csv|text\/plain|octet-stream/i })).toString('latin1')) },
        { name: 'press-release-pdf', run: async () => parseIndecIpcPressRelease((await parsePdf(await fetchBufferFromUrl(await linkOnPage(/informesdeprensa\/ipc_[^/]*\.pdf$/i), { expectedContentType: /pdf/i }))).text) },
    ], { minLatest: await expectedIndecIpcPeriod(today) });
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

/** Core IPC index (datos.gob.ar levels) extended with newer core variations from the INDEC fallback chain. */
export async function fetchIndecNucleoIndexRows(today?: string): Promise<{ fecha: string; valor: number }[]> {
    const [general, nucleo] = await Promise.all([fetchIndecIpcRows(INDEC_GENERAL_SERIES_ID), fetchIndecIpcRows(INDEC_NUCLEO_SERIES_ID)]);
    const byFecha = new Map<string, InflacionRawRow>(nucleo.map(row => [row.fecha, { fecha: row.fecha, ipc_indec_nucleo: row.valor }]));
    completeIndecIndexRows(byFecha, await fetchIndecIpcVariations(general, nucleo, today));
    const rows = Array.from(byFecha.values())
        .filter(row => row.ipc_indec_nucleo != null)
        .map(row => ({ fecha: row.fecha, valor: Number(row.ipc_indec_nucleo) }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (rows.length === 0) throw new Error('Failed to fetch the core IPC index (148.3_INUCLEONAL_DICI_M_19) and its fallbacks.');
    return rows;
}

function extractIpcFromText(text: string): number | null {
    const patterns = [
        /inflaci[oó]n\s+nacional(?:\s+de\s+[a-z]+)?\s*(?:fue(?:\s+del?)?|alcanz[oó]|subi[oó]|aument[oó]|vari[oó]|trep[oó])\s*([\d.,]+)\s*%/i,
        /inflaci[oó]n\s+nacional\s*(?:fue(?:\s+del?)?|alcanz[oó]|subi[oó]|aument[oó]|vari[oó]|trep[oó])\s*([\d.,]+)\s*%/i,
        /IPC\s+Nivel\s+General\s+como\s+el\s+IPC\s+N[uú]cleo\s+subieron\s*([\d.,]+)\s*%/i,
        /IPC\s*Nivel\s+General\s*(?:de|subi[oó]|aument[oó]|vari[oó]|trep[oó]|fue)\s*([\d.,]+)\s*%/i,
        /IPC\s*Nacional\s*(?:fue(?:\s+del?)?|alcanz[oó]|subi[oó]|aument[oó]|vari[oó]|trep[oó])\s*([\d.,]+)\s*%/i,
        /alza\s+de\s*([\d.,]+)\s*%\s+del\s+IPC\s+Nacional/i,
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

const EQUILIBRA_ORIGIN = 'https://equilibra.ar';
const EQUILIBRA_MAX_PAGES = 10;
/** Equilibra publishes month M's IPC in the first days of M+1. */
const EQUILIBRA_RELEASE_LAG_DAYS = 35;

type EquilibraRow = { fecha: string; ipc_equilibra: number; publishedAt: string | null };
type EquilibraPost = { title: string; link: string; publishedAt: string | null };

export async function fetchEquilibraIpcRows(today?: string): Promise<InflacionRawRow[]> {
    return (await fetchEquilibraIpcReport(today)).rows;
}

async function equilibraRowsFromPosts(posts: EquilibraPost[]): Promise<EquilibraRow[]> {
    const rows: EquilibraRow[] = [];
    const seenFechas = new Set<string>();
    const BATCH_SIZE = 5;
    for (let i = 0; i < posts.length; i += BATCH_SIZE) {
        const results = await Promise.all(posts.slice(i, i + BATCH_SIZE).map(async (post): Promise<EquilibraRow | null> => {
            const my = extractMonthYearFromTitle(post.title);
            if (!my) return null;
            const fecha = `${my.year}-${String(my.month).padStart(2, '0')}-01`;
            const ipc = parseEquilibraPostHtml(await fetchPostHtml(post.link));
            return ipc == null ? null : { fecha, ipc_equilibra: ipc, publishedAt: post.publishedAt };
        }));
        for (const row of results) {
            if (!row || seenFechas.has(row.fecha)) continue;
            seenFechas.add(row.fecha);
            rows.push(row);
        }
    }
    return rows;
}

async function fetchEquilibraWpJsonRows(): Promise<EquilibraRow[]> {
    const posts = JSON.parse(await fetchTextFromUrl(`${EQUILIBRA_ORIGIN}/wp-json/wp/v2/posts?categories=19&per_page=100`)) as Array<{ date?: string; title?: { rendered?: string }; link?: string }>;
    return equilibraRowsFromPosts(posts
        .filter(post => /mensual/i.test(post.title?.rendered ?? ''))
        .map(post => ({ title: post.title?.rendered ?? '', link: post.link ?? '', publishedAt: isoDateFromValue(post.date) })));
}

/** Fetches a paginated WordPress page/feed; only the first page is required, later pages end the walk when they fail or are empty. */
async function fetchPages(pageUrl: (page: number) => string, maxPages: number, extract: (text: string) => string[]): Promise<string[]> {
    const results: string[] = [];
    for (let page = 1; page <= maxPages; page++) {
        const text = await fetchTextFromUrl(pageUrl(page)).catch(error => {
            if (page === 1) throw error;
            return '';
        });
        const found = extract(text);
        if (found.length === 0) break;
        results.push(...found);
    }
    return results;
}

async function fetchEquilibraFeedRows(): Promise<EquilibraRow[]> {
    const items = await fetchPages(page => `${EQUILIBRA_ORIGIN}/category/ipc-equilibra/feed/${page > 1 ? `?paged=${page}` : ''}`, EQUILIBRA_MAX_PAGES, xml => xml.match(/<item>[\s\S]*?<\/item>/g) ?? []);
    const rows: EquilibraRow[] = [];
    for (const item of items) {
        const row = parseEquilibraRssItem(item);
        if (row?.ipc_equilibra == null || rows.some(existing => existing.fecha === row.fecha)) continue;
        rows.push({ fecha: row.fecha, ipc_equilibra: Number(row.ipc_equilibra), publishedAt: isoDateFromValue(item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1]) });
    }
    return rows;
}

async function fetchEquilibraListingRows(): Promise<EquilibraRow[]> {
    const links = await fetchPages(page => `${EQUILIBRA_ORIGIN}/category/ipc-equilibra/${page > 1 ? `page/${page}/` : ''}`, EQUILIBRA_MAX_PAGES, html => [...html.matchAll(/href="(https:\/\/equilibra\.ar\/ipc-mensual-[a-z]+-\d{4}(?:-\d+)?\/)"/gi)].map(match => match[1]));
    return equilibraRowsFromPosts([...new Set(links)].map(link => ({ title: link.replace(/.*\/(ipc-mensual-[a-z]+-\d{4}).*/i, '$1').replace(/-/g, ' '), link, publishedAt: null })));
}

async function fetchEquilibraIpcReport(today: string = argentinaToday()): Promise<InflacionSourceReport> {
    const rows = await firstUsable('Equilibra IPC', [
        { name: 'wp-json', run: fetchEquilibraWpJsonRows },
        { name: 'rss', run: fetchEquilibraFeedRows },
        { name: 'listing-html', run: fetchEquilibraListingRows },
    ], { minLatest: minLatestPeriod(today, EQUILIBRA_RELEASE_LAG_DAYS) });

    return {
        rows: rows.map(({ fecha, ipc_equilibra }) => ({ fecha, ipc_equilibra })).sort((a, b) => a.fecha.localeCompare(b.fecha)),
        publishedAt: rows.reduce<string | null>((latest, row) => latestDate(latest, row.publishedAt), null),
    };
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

type RemApiResponse = {
    datos: Array<Record<string, unknown>>;
};

export async function fetchRemRows(): Promise<InflacionRawRow[]> {
    return (await fetchRemReport()).rows;
}

async function fetchRemReport(): Promise<InflacionSourceReport> {
    try {
        const text = await fetchTextFromUrl(REM_BCRA_API_URL);
        const json = JSON.parse(text) as RemApiResponse;
        const rows: InflacionRawRow[] = [];

        for (const entry of json.datos ?? []) {
            const rawPeriodo = entry['período'];
            if (typeof rawPeriodo !== 'string') continue;
            const date = new Date(rawPeriodo);
            if (Number.isNaN(date.getTime())) continue;
            const fecha = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
            const mediana = parseOptionalDecimal(entry.mediana);
            if (mediana == null) continue;
            rows.push({ fecha, rem: mediana });
        }

        return {
            rows: rows.sort((a, b) => a.fecha.localeCompare(b.fecha)),
            publishedAt: null,
        };
    } catch (error) {
        console.error('[inflacion-source] Failed to fetch REM:', error);
        return { rows: [], publishedAt: null };
    }
}

const REM_BCRA_XLSX_BASE = 'https://www.bcra.gob.ar/archivos/Pdfs/PublicacionesEstadisticas';
const MONTH_ABBR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function remXlsxUrl(month: number, year: number): string {
    const abbr = MONTH_ABBR[month - 1];
    const path = year >= 2026 ? `${REM_BCRA_XLSX_BASE}/informes` : REM_BCRA_XLSX_BASE;
    return `${path}/tablas-relevamiento-expectativas-mercado-${abbr}-${year}.xlsx`;
}

export type RemExpectationSurvey = {
    surveyDate: string;
    surveyLabel: string;
    targets: Array<{ month: string; median: number }>;
};

function parseExcelDate(serial: number): string | null {
    if (serial < 40000) return null;
    const date = new Date((serial - 25569) * 86400 * 1000);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export function parseRemXlsx(buffer: Buffer, surveyYear: number, surveyMonth: number): RemExpectationSurvey | null {
    const workbook = readWorkbook(buffer);
    const sheetName = workbook.SheetNames.find(name => /cuadros de resultados/i.test(name));
    if (!sheetName) return null;

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: true, defval: null }) as unknown[][];

    const headerIdx = rows.findIndex(row => /precios minoristas.*ipc nivel general/i.test(String(row[0] ?? '')));
    if (headerIdx < 0) return null;

    const dataStart = headerIdx + 2;
    const targets: Array<{ month: string; median: number }> = [];

    for (let i = dataStart; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row[0] == null) break;
        if (typeof row[0] === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(row[0])) break;
        if (typeof row[0] === 'number' && row[0] < 40000) break;

        const ref = String(row[1] ?? '');
        if (!/var\. % mensual/i.test(ref)) continue;

        const fecha = typeof row[0] === 'number' ? parseExcelDate(row[0]) : (typeof row[0] === 'string' ? row[0].split(' ')[0] : null);
        const mediana = parseOptionalDecimal(row[2]);
        if (!fecha || mediana == null) continue;

        targets.push({ month: fecha, median: mediana });
    }

    if (targets.length === 0) return null;

    const surveyDate = `${surveyYear}-${String(surveyMonth).padStart(2, '0')}-01`;
    const label = `${MONTH_ABBR[surveyMonth - 1]}-${String(surveyYear).slice(-2)}`;
    return { surveyDate, surveyLabel: label, targets };
}

export async function fetchRemXlsx(month: number, year: number): Promise<RemExpectationSurvey | null> {
    const url = remXlsxUrl(month, year);
    try {
        const buffer = await fetchBufferFromUrl(url);
        return parseRemXlsx(buffer, year, month);
    } catch {
        return null;
    }
}

export async function fetchRemExpectationsHistory(monthsBack: number = 6): Promise<RemExpectationSurvey[]> {
    return unstable_cache(
        async () => {
            const now = new Date();
            const surveys = await Promise.all(Array.from({ length: monthsBack }, async (_, offset) => {
                const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
                return fetchRemXlsx(d.getUTCMonth() + 1, d.getUTCFullYear());
            }));

            return surveys
                .filter((survey): survey is RemExpectationSurvey => survey != null)
                .sort((a, b) => a.surveyDate.localeCompare(b.surveyDate));
        },
        ['rem-expectations-history', String(monthsBack)],
        { revalidate: 21600 },
    )();
}

/** The official release date, once INDEC rows include the month it published. */
function indecPublishedAt(release: string | null, byFecha: Map<string, InflacionRawRow>): string | null {
    return release && byFecha.get(minLatestFromRelease(release, 1))?.ipc_indec_general != null ? release : null;
}

export async function fetchInflacionRawReport(today = argentinaToday()): Promise<InflacionSourceReport> {
    const [indecGeneral, indecNucleo, indecIpim, equilibraReport, onlineReport, remReport, indecRelease] = await Promise.all([
        fetchIndecIpcRows(INDEC_GENERAL_SERIES_ID),
        fetchIndecIpcRows(INDEC_NUCLEO_SERIES_ID),
        fetchIndecIpcRows(INDEC_IPIM_SERIES_ID),
        fetchEquilibraIpcReport(),
        fetchIpcOnlineReport(),
        fetchRemReport(),
        fetchLastIndecRelease('indec-ipc', today).catch(() => null),
    ]);

    const indecVariations = await fetchIndecIpcVariations(indecGeneral, indecNucleo, today);
    const byFecha = new Map<string, InflacionRawRow>();

    for (const row of indecGeneral) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), fecha: row.fecha, ipc_indec_general: row.valor });
    }
    for (const row of indecNucleo) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), fecha: row.fecha, ipc_indec_nucleo: row.valor });
    }
    for (const row of indecIpim) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), fecha: row.fecha, ipim: row.valor });
    }
    completeIndecIndexRows(byFecha, indecVariations);
    for (const row of equilibraReport.rows) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    }
    for (const row of onlineReport.rows) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    }
    for (const row of remReport.rows) {
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    }

    return {
        rows: Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha)),
        // The REM forecast dates its own Próxima, never the measured headline.
        publishedAt: latestDate(indecPublishedAt(indecRelease, byFecha), latestDate(equilibraReport.publishedAt, onlineReport.publishedAt)),
        sourcePublications: [
            { id: 'inflacion-equilibra', publishedAt: equilibraReport.publishedAt, periodDate: equilibraReport.rows.at(-1)?.fecha ?? null },
            { id: 'inflacion-ipc-online', publishedAt: onlineReport.publishedAt, periodDate: onlineReport.rows.at(-1)?.fecha ?? null },
        ].filter((source): source is { id: string; publishedAt: string; periodDate: string | null } => source.publishedAt !== null),
    };
}

const MONTHS_ES_REV = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];

export function normalizeRemExpectations(
    surveys: RemExpectationSurvey[],
    actualIpcByMonth: Map<string, number>,
): Array<Record<string, unknown>> {
    if (surveys.length === 0) return [];

    const allMonths = new Set<string>();
    for (const survey of surveys) {
        for (const t of survey.targets) allMonths.add(t.month);
    }
    for (const month of actualIpcByMonth.keys()) allMonths.add(month);
    const sortedMonths = Array.from(allMonths).sort();

    return sortedMonths.map(month => {
        const d = new Date(month + 'T12:00:00Z');
        const row: Record<string, unknown> = {
            fecha: `${MONTHS_ES_REV[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`,
            iso_fecha: month,
        };

        row.ipc_indec = actualIpcByMonth.get(month) ?? null;

        for (const survey of surveys) {
            const key = `enc_${survey.surveyDate}`;
            const isFirstTarget = survey.targets[0]?.month === month;

            if (isFirstTarget) {
                row[key] = actualIpcByMonth.get(month) ?? survey.targets[0]?.median ?? null;
                continue;
            }

            if (month < survey.surveyDate) {
                row[key] = null;
                continue;
            }

            const target = survey.targets.find(t => t.month === month);
            row[key] = target?.median ?? null;
        }

        return row;
    });
}
