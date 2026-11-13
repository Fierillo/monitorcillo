import type { InflacionRawRow } from '@/types';
import * as XLSX from 'xlsx';
import { unstable_cache } from 'next/cache';
import { excelSerialToIsoMonth, extractFileLinks, fetchTableSeries, readWorkbook, type TableSeriesSpec } from './protocols';
import { parsePdf } from './protocols/pdf';
import { addMonths, argentinaToday, isoDate, isoToMonthLabel, MONTH_NAMES_ES, monthNumber } from './normalize/dates';
import { parseNumber } from './normalize/numbers';
import { expectedIndecPeriod, firstUsable, minLatestFromRelease, minLatestPeriod } from './sync/source-chain';
import { fetchLastIndecRelease } from './release-calendars';
import { fetchBufferFromUrl, fetchTextFromUrl, isoDateFromHttpDate } from './sync/http-client';
import { fetchTimeSeries } from './sync/time-series-client';

const INDEC_GENERAL_SERIES_ID = '145.3_INGNACNAL_DICI_M_15';
const INDEC_NUCLEO_SERIES_ID = '148.3_INUCLEONAL_DICI_M_19';
const INDEC_IPIM_SERIES_ID = '448.1_NIVEL_GENERAL_0_0_13_46';
const INDEC_ORIGIN = 'https://www.indec.gob.ar';
const INDEC_IPC_PAGE_URL = `${INDEC_ORIGIN}/Nivel4/Tema/3/5/31`;
/** INDEC's IPC series CSV: one row per item, region and month; monthly variations of the national general level and core. */
export const INDEC_IPC_CSV: TableSeriesSpec<'ipc_indec' | 'ipc_nucleo_indec'> = {
    url: `${INDEC_ORIGIN}/ftp/cuadros/economia/serie_ipc_divisiones.csv`,
    date: { column: 'Periodo', format: 'yyyymm' },
    numberFormat: 'es-AR',
    where: { Region: 'Nacional' },
    fields: {
        ipc_indec: { column: 'v_m_IPC', where: { Descripcion: 'Nivel general' } },
        ipc_nucleo_indec: { column: 'v_m_IPC', where: { Codigo: 'Núcleo' } },
    },
};
/** IPC and IPIM (SIPM) for month M are published mid M+1; the day lag is only used when INDEC's calendar is unavailable. */
const INDEC_MONTHLY_RELEASE_LAG_DAYS = 45;
const INDEC_IPIM_CSV: TableSeriesSpec<'ipim'> = {
    url: `${INDEC_ORIGIN}/ftp/cuadros/economia/indice_ipim.csv`,
    date: { column: 'periodo', format: 'iso' },
    numberFormat: 'es-AR',
    where: { nivel_general_aperturas: 'ng_nivel_general' },
    fields: { ipim: { column: 'indice_ipim' } },
};
const IPC_ONLINE_FEED_URL = 'https://ipconlinebb.wordpress.com/feed/';
const REM_BCRA_API_URL = 'https://bcra-rem-api.facujallia.workers.dev/api/ipc_general';

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

export function parseIndecIpcPressRelease(text: string): IndecIpcVariationRow[] {
    const flat = text.replace(/\s+/g, ' ');
    const general = flat.match(/alza mensual de ([\d.,]+)\s*% en ([a-záéíóú]+) de (\d{4})/i);
    const month = general ? monthNumber(general[2]) : null;
    if (!general || !month) return [];
    const nucleo = flat.match(/IPC N[uú]cleo \(([\d.,]+)\s*%\)/i);
    return [{
        fecha: isoDate(Number(general[3]), month, 1),
        ipc_indec: parseNumber(general[1], 'es-AR'),
        ipc_nucleo_indec: nucleo ? parseNumber(nucleo[1], 'es-AR') : null,
    }];
}

function variationsFromIndex(general: { fecha: string; valor: number }[], nucleo: { fecha: string; valor: number }[]): IndecIpcVariationRow[] {
    const change = (rows: { fecha: string; valor: number }[], index: number) => index > 0 ? ((rows[index].valor - rows[index - 1].valor) / rows[index - 1].valor) * 100 : null;
    const byFecha = new Map<string, IndecIpcVariationRow>();
    general.forEach((row, index) => byFecha.set(row.fecha, { fecha: row.fecha, ipc_indec: change(general, index), ipc_nucleo_indec: null }));
    nucleo.forEach((row, index) => byFecha.set(row.fecha, { ...(byFecha.get(row.fecha) ?? { fecha: row.fecha, ipc_indec: null }), ipc_nucleo_indec: change(nucleo, index) }));
    return Array.from(byFecha.values()).filter(row => row.ipc_indec != null || row.ipc_nucleo_indec != null).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

async function indecIpcPressReleaseUrl(): Promise<string> {
    const link = extractFileLinks(await fetchTextFromUrl(INDEC_IPC_PAGE_URL), { origin: INDEC_ORIGIN }).find(candidate => /informesdeprensa\/ipc_[^/]*\.pdf$/i.test(candidate.href));
    if (!link) throw new Error(`No IPC press release linked on ${INDEC_IPC_PAGE_URL}`);
    return link.href;
}

/** INDEC IPC monthly variations: datos.gob.ar API -> CSV series -> press-release PDF linked from the page. */
export async function fetchIndecIpcVariations(
    apiGeneral: { fecha: string; valor: number }[],
    apiNucleo: { fecha: string; valor: number }[],
    today: string = argentinaToday(),
): Promise<IndecIpcVariationRow[]> {
    return firstUsable('INDEC IPC', [
        { name: 'api', run: async () => variationsFromIndex(apiGeneral, apiNucleo) },
        { name: 'csv', run: () => fetchTableSeries(INDEC_IPC_CSV) },
        { name: 'press-release-pdf', run: async () => parseIndecIpcPressRelease((await parsePdf(await fetchBufferFromUrl(await indecIpcPressReleaseUrl(), { expectedContentType: /pdf/i }))).text) },
    ], { minLatest: await expectedIndecPeriod('indec-ipc', today, INDEC_MONTHLY_RELEASE_LAG_DAYS) });
}

/** IPIM general level (same base, dic-2015 = 100): datos.gob.ar API -> INDEC CSV when the API lags behind INDEC's latest release. */
async function fetchIndecIpimRows(today: string): Promise<Array<{ fecha: string; ipim: number | null }>> {
    return firstUsable('INDEC IPIM', [
        { name: 'api', run: async () => (await fetchIndecIpcRows(INDEC_IPIM_SERIES_ID)).map(({ fecha, valor }) => ({ fecha, ipim: valor })) },
        { name: 'csv', run: () => fetchTableSeries(INDEC_IPIM_CSV) },
    ], { minLatest: await expectedIndecPeriod('indec-sipm', today, INDEC_MONTHLY_RELEASE_LAG_DAYS) });
}

function completeIndecIndexRows(byFecha: Map<string, InflacionRawRow>, variations: IndecIpcVariationRow[]): void {
    for (const row of variations.sort((a, b) => a.fecha.localeCompare(b.fecha))) {
        const previous = byFecha.get(addMonths(row.fecha, -1));
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
        if (match) return parseNumber(match[1], 'es-AR');
    }
    return null;
}

function extractMonthYearFromTitle(title: string): { month: number; year: number } | null {
    const match = title.match(/\b([a-z]+)\s+(\d{4})\b/i);
    if (!match) return null;
    const month = monthNumber(match[1]);
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

    return { fecha: isoDate(my.year, my.month, 1), ipc_equilibra: ipc };
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
            const fecha = isoDate(my.year, my.month, 1);
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
        .map(post => ({ title: post.title?.rendered ?? '', link: post.link ?? '', publishedAt: isoDateFromHttpDate(post.date) })));
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
        rows.push({ fecha: row.fecha, ipc_equilibra: Number(row.ipc_equilibra), publishedAt: isoDateFromHttpDate(item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1]) });
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

    return { fecha: isoDate(my.year, my.month, 1), ipc_online: parseNumber(value, 'es-AR') };
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
                publishedAt = latestDate(publishedAt, isoDateFromHttpDate(item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1]));
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
            const fecha = isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, 1);
            const mediana = parseNumber(entry.mediana, 'en');
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

const BCRA_ORIGIN = 'https://www.bcra.gob.ar';
const REM_BCRA_PAGE_URL = `${BCRA_ORIGIN}/PublicacionesEstadisticas/Relevamiento_Expectativas_de_Mercado.asp`;
const REM_IPC_VARIABLE = 'Precios minoristas (IPC nivel general; INDEC)';

export type RemExpectationSurvey = {
    surveyDate: string;
    surveyLabel: string;
    targets: Array<{ month: string; median: number }>;
};

function parseExcelDate(serial: unknown): string | null {
    if (typeof serial !== 'number' || !Number.isFinite(serial) || serial < 40000) return null;
    return excelSerialToIsoMonth(serial);
}

/** Monthly IPC medians of every REM survey, from the "Base de Datos Completa" sheet of BCRA's historical workbook. */
function parseRemHistory(buffer: Buffer): RemExpectationSurvey[] {
    const sheet = readWorkbook(buffer).Sheets['Base de Datos Completa'];
    const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null }) as unknown[][] : [];
    const bySurvey = new Map<string, RemExpectationSurvey>();
    for (const [surveyed, variable, reference, period, median] of rows) {
        const surveyDate = parseExcelDate(surveyed);
        const month = parseExcelDate(period);
        const value = parseNumber(median, 'en');
        if (variable !== REM_IPC_VARIABLE || reference !== 'var. % mensual' || !surveyDate || !month || value == null) continue;
        const [year, surveyMonth] = surveyDate.split('-').map(Number);
        const survey = bySurvey.get(surveyDate) ?? { surveyDate, surveyLabel: `${MONTH_NAMES_ES[surveyMonth - 1].slice(0, 3)}-${String(year).slice(-2)}`, targets: [] };
        survey.targets.push({ month, median: value });
        bySurvey.set(surveyDate, survey);
    }
    return Array.from(bySurvey.values()).sort((a, b) => a.surveyDate.localeCompare(b.surveyDate));
}

/** The latest REM surveys, from the historical workbook linked on BCRA's REM page. */
export async function fetchRemExpectationsHistory(monthsBack: number = 12): Promise<RemExpectationSurvey[]> {
    return unstable_cache(
        async () => {
            try {
                const link = extractFileLinks(await fetchTextFromUrl(REM_BCRA_PAGE_URL), { origin: BCRA_ORIGIN, extensions: ['xlsx'] })
                    .find(candidate => /historico\.xlsx$/i.test(candidate.href));
                if (!link) throw new Error(`No REM historical workbook linked on ${REM_BCRA_PAGE_URL}`);
                return parseRemHistory(await fetchBufferFromUrl(link.href)).slice(-monthsBack);
            } catch (error) {
                console.error('[inflacion-source] Failed to fetch REM surveys:', error);
                return [];
            }
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
        fetchIndecIpimRows(today),
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
        byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
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
        const row: Record<string, unknown> = {
            fecha: isoToMonthLabel(month),
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
