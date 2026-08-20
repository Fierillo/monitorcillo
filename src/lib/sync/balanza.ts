import type { BalanzaRawRow } from '@/types';
import { mergeLatestIcaReport, parseIcaPublicationDate, parseIcaWorkbookUrls, parseLatestIcaReport } from '../balanza-source';
import { BALANZA_ALL_SERIES, BALANZA_MACRO_KEYS, BALANZA_RAW_COLUMNS, BALANZA_SERIES_IDS } from '../balanza/schema';
import { sql } from '../db/client';
import { fetchAnnualPbiUsdMillions } from '../pbi-usd-source';
import { ICA_AGGREGATE_WORKBOOK_URL, ICA_PUBLICATION_PAGE_URL } from './constants';
import { fetchBufferFromUrl, fetchTextFromUrl } from './http-client';
import { valueAtOrBefore } from './series';
import { fetchTimeSeries } from './time-series-client';

const SERIES_BATCH_SIZE = 8;

function seriesMapAtIndex(rows: Array<readonly unknown[]>, index: number): Map<string, number> {
    return new Map(rows
        .filter(row => typeof row[0] === 'string' && row[index] != null && row[index] !== '')
        .map(row => [String(row[0]), Number(row[index])]));
}

export async function ensureBalanzaTables(): Promise<void> {
    const rawColumns = BALANZA_RAW_COLUMNS.map(column => `${column} NUMERIC`).join(', ');
    const normalizedColumns = [...BALANZA_ALL_SERIES.map(series => series.key), ...BALANZA_MACRO_KEYS].map(column => `${column} NUMERIC`).join(', ');
    await sql.query(`CREATE TABLE IF NOT EXISTS balanza_raw (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, ${rawColumns}, fetched_at TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`CREATE TABLE IF NOT EXISTS balanza_normalized (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, ${normalizedColumns}, last_update TIMESTAMP DEFAULT NOW())`, []);
    for (const column of ['pbi_trimestral', 'tc', 'ipc_nucleo', 'pbi_usd']) {
        await sql.query(`ALTER TABLE balanza_raw ADD COLUMN IF NOT EXISTS ${column} NUMERIC`, []);
    }
    for (const column of BALANZA_MACRO_KEYS) {
        await sql.query(`ALTER TABLE balanza_normalized ADD COLUMN IF NOT EXISTS ${column} NUMERIC`, []);
    }
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_balanza_fecha ON balanza_raw(fecha)`, []);
}

export async function fetchBalanzaRawReport(): Promise<{ rows: BalanzaRawRow[]; publishedAt: string | null }> {
    const batches = [];
    for (let index = 0; index < BALANZA_SERIES_IDS.length; index += SERIES_BATCH_SIZE) {
        batches.push(BALANZA_SERIES_IDS.slice(index, index + SERIES_BATCH_SIZE));
    }

    const publicationHtmlPromise = fetchTextFromUrl(ICA_PUBLICATION_PAGE_URL);
    const officialReportPromise = publicationHtmlPromise.then(async html => {
        const urls = parseIcaWorkbookUrls(html);
        if (!urls.exports || !urls.imports) {
            throw new Error('Failed to find ICA breakdown workbooks on the INDEC page. Verify whether INDEC changed the download links.');
        }
        const [aggregateBuffer, exportsBuffer, importsBuffer] = await Promise.all([
            fetchBufferFromUrl(ICA_AGGREGATE_WORKBOOK_URL),
            fetchBufferFromUrl(urls.exports),
            fetchBufferFromUrl(urls.imports),
        ]);
        return parseLatestIcaReport(aggregateBuffer, exportsBuffer, importsBuffer);
    });

    const [publicationHtml, pbiUsd, officialRows, ...seriesResponses] = await Promise.all([
        publicationHtmlPromise,
        fetchAnnualPbiUsdMillions(),
        officialReportPromise,
        ...batches.map(ids => fetchTimeSeries({ ids })),
    ]);

    const valuesByFecha = new Map<string, BalanzaRawRow>();
    let seriesOffset = 0;
    for (const response of seriesResponses) {
        const rows = response.data ?? [];
        const batch = BALANZA_ALL_SERIES.slice(seriesOffset, seriesOffset + SERIES_BATCH_SIZE);
        seriesOffset += batch.length;

        for (const [index, series] of batch.entries()) {
            for (const [fecha, value] of seriesMapAtIndex(rows, index + 1)) {
                const existing = valuesByFecha.get(fecha) ?? { fecha };
                existing[series.key] = value;
                valuesByFecha.set(fecha, existing);
            }
        }
    }

    const rows = mergeLatestIcaReport([...valuesByFecha.values()], officialRows);
    return {
        rows: rows.map(row => ({
            ...row,
            pbi_usd: valueAtOrBefore(pbiUsd, row.fecha),
        })),
        publishedAt: parseIcaPublicationDate(publicationHtml),
    };
}

export async function fetchBalanzaRaw(): Promise<BalanzaRawRow[]> {
    return (await fetchBalanzaRawReport()).rows;
}
