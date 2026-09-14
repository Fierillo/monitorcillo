import type { PobrezaRawRow } from '@/types';
import { extractFileLinks, fetchPdf } from './protocols';
import { fetchLastModifiedDate, fetchTextFromUrl } from './sync/http-client';
import { fetchTimeSeries } from './sync/time-series-client';

const INDEC_POBREZA_SERIES_ID = '64.2_POBLACION_NUA_0_0_34_74';
const UTDT_POBREZA_URL = 'https://www.utdt.edu/ver_contenido.php?id_contenido=22217&id_item_menu=36605';
const UTDT_ORIGIN = 'https://www.utdt.edu';
const UTDT_SHINY_URL = 'https://mrozada.shinyapps.io/shinynowcast/';
const PDF_FETCH_CONCURRENCY = 4;
const SHINY_TIMEOUT_MS = 30_000;
const SEMESTER_MONTHS: Record<string, number> = {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

function periodToFecha(period: string): string | null {
    const match = period.match(/([A-Za-z]{3})(\d{2})([A-Za-z]{3})(\d{2})/);
    if (!match) return null;

    const endMonth = SEMESTER_MONTHS[match[3].toLowerCase()];
    if (!endMonth) return null;

    return `${2000 + Number(match[4])}-${String(endMonth).padStart(2, '0')}-01`;
}

export type UtdtPeriodPdfLink = {
    period: string;
    url: string;
};

export type UtdtShinyTrace = {
    name?: string;
    text?: unknown[];
    y?: unknown[];
};

type PobrezaSourceReport = {
    rows: PobrezaRawRow[];
    publishedAt: string | null;
    sourcePublications?: Array<{ id: string; publishedAt: string; periodDate: string | null }>;
};

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
    const byPeriod = new Map<string, UtdtPeriodPdfLink>();

    for (const link of extractFileLinks(html, { origin: UTDT_ORIGIN, extensions: ['pdf'] })) {
        if (!/^[A-Za-z]{3}\d{2}[A-Za-z]{3}\d{2}$/.test(link.label)) continue;
        if (!byPeriod.has(link.label)) byPeriod.set(link.label, { period: link.label, url: link.href });
    }

    return Array.from(byPeriod.values());
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

export function utdtShinyTracesIncludeProjection(traces: UtdtShinyTrace[]): boolean {
    return traces.some(trace => trace.name === 'proy' && (trace.y?.length ?? 0) > 0);
}

export function parseUtdtShinyRows(traces: UtdtShinyTrace[]): PobrezaRawRow[] {
    const byFecha = new Map<string, PobrezaRawRow>();
    const tracesByName = new Map(traces.map(trace => [trace.name, trace]));

    for (const name of ['oficial', 'serie', 'proy'] as const) {
        const trace = tracesByName.get(name);
        if (!trace) continue;
        for (let index = 0; index < (trace.text?.length ?? 0); index++) {
            const period = String(trace.text?.[index]).match(/Semestre\s*:\s*([A-Za-z]{3}\d{2}[A-Za-z]{3}\d{2})/i)?.[1];
            const value = Number(trace.y?.[index]);
            const fecha = period ? periodToFecha(period) : null;
            if (fecha && Number.isFinite(value)) byFecha.set(fecha, { fecha, pobreza_utdt: value });
        }
    }

    return Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function composeUtdtNowcastRows(sources: {
    shiny?: PobrezaRawRow[];
    pdf?: PobrezaRawRow[];
    latest?: PobrezaRawRow | null;
}): PobrezaRawRow[] {
    const byFecha = new Map<string, PobrezaRawRow>();
    for (const row of sources.shiny ?? []) byFecha.set(row.fecha, row);
    for (const row of sources.pdf ?? []) byFecha.set(row.fecha, row);
    if (sources.latest) byFecha.set(sources.latest.fecha, sources.latest);
    return Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function indecFechaToSemesterEnd(fecha: string): string | null {
    const [year, month] = fecha.split('-').map(Number);
    if (!year || !month) return null;
    return new Date(Date.UTC(year, month - 2, 1)).toISOString().split('T')[0];
}

export function overlayIndecOnNowcast(rows: PobrezaRawRow[]): PobrezaRawRow[] {
    const byFecha = new Map(rows.map(row => [row.fecha, { ...row }]));

    for (const row of rows) {
        const indec = Number(row.pobreza_indec);
        if (!Number.isFinite(indec)) continue;
        const semesterEnd = indecFechaToSemesterEnd(row.fecha);
        if (!semesterEnd) continue;
        const current = byFecha.get(semesterEnd);
        if (current?.pobreza_utdt == null) continue;
        byFecha.set(semesterEnd, { ...current, pobreza_utdt: indec });
    }

    return Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function parseUtdtShinyWorkerId(message: string): string | null {
    try {
        const workerId = JSON.parse(message)?.config?.workerId;
        return typeof workerId === 'string' && workerId.length > 0 ? workerId : null;
    } catch {
        return null;
    }
}

async function fetchUtdtRowsFromShiny(): Promise<PobrezaRawRow[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SHINY_TIMEOUT_MS);

    try {
        const tokenResponse = await fetch(`${UTDT_SHINY_URL}__token__/`, { signal: controller.signal });
        if (!tokenResponse.ok) throw new Error(`UTDT Shiny token request failed with HTTP ${tokenResponse.status}.`);
        const token = (await tokenResponse.text()).trim();
        const bootstrapServerId = String(Math.floor(Math.random() * 1_000)).padStart(3, '0');
        const bootstrapSessionId = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
        const bootstrapUrl = `wss://mrozada.shinyapps.io/shinynowcast/__sockjs__/n=monitorcillo/t=${token}/s=0/${bootstrapServerId}/${bootstrapSessionId}/websocket`;
        const workerId = await new Promise<string>((resolve, reject) => {
            const socket = new WebSocket(bootstrapUrl);
            let settled = false;

            const finish = (value: string | null, error?: Error) => {
                if (settled) return;
                settled = true;
                socket.close();
                if (value) resolve(value);
                else reject(error);
            };

            controller.signal.addEventListener('abort', () => finish(null, new Error('UTDT Shiny worker request timed out.')), { once: true });
            socket.onerror = () => finish(null, new Error('UTDT Shiny worker WebSocket connection failed.'));
            socket.onclose = () => finish(null, new Error('UTDT Shiny worker WebSocket closed before returning its ID.'));
            socket.onmessage = event => {
                const value = parseUtdtShinyWorkerId(String(event.data));
                if (value) finish(value);
            };
        });
        const serverId = String(Math.floor(Math.random() * 1_000)).padStart(3, '0');
        const sessionId = Math.random().toString(36).slice(2, 10).padEnd(8, '0');
        const socketUrl = `wss://mrozada.shinyapps.io/shinynowcast/__sockjs__/n=monitorcillo/t=${token}/w=${workerId}/s=0/${serverId}/${sessionId}/websocket`;

        return await new Promise<PobrezaRawRow[]>((resolve, reject) => {
            const socket = new WebSocket(socketUrl);
            let settled = false;
            let bestRows: PobrezaRawRow[] = [];

            const finish = (rows: PobrezaRawRow[], error?: Error) => {
                if (settled) return;
                settled = true;
                socket.close();
                if (error && rows.length === 0) reject(error);
                else resolve(rows);
            };

            controller.signal.addEventListener('abort', () => {
                finish(bestRows, bestRows.length > 0 ? undefined : new Error('UTDT Shiny request timed out.'));
            }, { once: true });
            socket.onerror = () => finish(bestRows, bestRows.length > 0 ? undefined : new Error('UTDT Shiny WebSocket connection failed.'));
            socket.onclose = () => finish(bestRows, bestRows.length > 0 ? undefined : new Error('UTDT Shiny WebSocket closed before returning graph data.'));
            socket.onmessage = (event) => {
                const message = String(event.data);
                if (message === 'o') {
                    socket.send(JSON.stringify(['0#0|o|']));
                    const data = {
                        '.clientdata_output_graph_width': 1400,
                        '.clientdata_output_graph_height': 560,
                        '.clientdata_output_graph_hidden': false,
                        '.clientdata_pixelratio': 1,
                        '.clientdata_url_protocol': 'https:',
                        '.clientdata_url_hostname': 'mrozada.shinyapps.io',
                        '.clientdata_url_port': '',
                        '.clientdata_url_pathname': '/shinynowcast/',
                        '.clientdata_url_search': '',
                        '.clientdata_url_hash': '',
                        '.clientdata_url_hash_initial': '',
                        '.clientdata_singletons': '',
                    };
                    socket.send(JSON.stringify([`1#0|m|${JSON.stringify({ method: 'init', data })}`]));
                    return;
                }

                if (!message.startsWith('a[')) return;
                for (const robustMessage of JSON.parse(message.slice(1)) as string[]) {
                    const payloadText = robustMessage.match(/^\d+#\d+\|m\|([\s\S]+)$/)?.[1];
                    if (!payloadText) continue;
                    const payload = JSON.parse(payloadText);
                    const traces = payload.values?.graph?.x?.data;
                    if (!Array.isArray(traces)) continue;
                    const rows = parseUtdtShinyRows(traces);
                    if (rows.length > bestRows.length) bestRows = rows;
                    if (utdtShinyTracesIncludeProjection(traces) && rows.length > 0) finish(rows);
                }
            };
        });
    } finally {
        clearTimeout(timeout);
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
            const document = await fetchPdf(link.url);
            const value = parsePovertyRateFromPdfText(document.content.text);
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
    const response = await fetchTimeSeries({ ids: [INDEC_POBREZA_SERIES_ID] });
    return (response.data ?? [])
        .filter(row => typeof row[0] === 'string' && row[1] != null)
        .map(row => ({ fecha: row[0], pobreza_indec: Number(row[1]) * 100 }))
        .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

async function fetchUtdtPublishedAt(imageUrl: string | null): Promise<string | null> {
    const urls = imageUrl ? [UTDT_POBREZA_URL, imageUrl] : [UTDT_POBREZA_URL];
    const dates = await Promise.all(urls.map(url => fetchLastModifiedDate(url)));
    return dates.reduce(latestDate, null);
}

async function fetchUtdtPobrezaReport(): Promise<PobrezaSourceReport> {
    try {
        const shinyPromise = fetchUtdtRowsFromShiny().catch((error) => {
            console.error('Failed to extract UTDT nowcast from Shiny:', error);
            return [] as PobrezaRawRow[];
        });
        const html = await fetchTextFromUrl(UTDT_POBREZA_URL);
        const periodLinks = parseUtdtPeriodPdfLinks(html);
        const imageUrl = parseUtdtChartImageUrl(html);
        const publishedAt = await fetchUtdtPublishedAt(imageUrl);
        const latestPdfLinks = periodLinks.slice(0, 1);

        const [shinyRows, pdfRows] = await Promise.all([
            shinyPromise,
            latestPdfLinks.length > 0
                ? fetchUtdtRowsFromPeriodPdfs(latestPdfLinks)
                : Promise.resolve([] as PobrezaRawRow[]),
        ]);

        const rows = composeUtdtNowcastRows({
            shiny: shinyRows,
            pdf: pdfRows,
            latest: parseLatestUtdtNowcastRow(html),
        });
        if (rows.length === 0) {
            console.error('UTDT nowcast: no rows extracted from Shiny, the latest PDF, or page text.');
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

    const rows = overlayIndecOnNowcast(Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha)));

    return {
        rows,
        publishedAt: utdtReport.publishedAt,
        sourcePublications: [
            { id: 'pobreza-utdt', publishedAt: utdtReport.publishedAt, periodDate: utdtReport.rows.at(-1)?.fecha ?? null },
        ].filter((source): source is { id: string; publishedAt: string; periodDate: string | null } => source.publishedAt !== null),
    };
}
