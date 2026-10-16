import type { EmaeRawRow } from '@/types';
import { EMAE_SECTOR_KEYS } from '../emae/schema';
import { parseEmaeHistoricalCsv, parseEmaePublicationDate, prependHistoricalEmae } from '../emae-source';
import { buildMonthlyPopulationSeries, parseWorldBankPopulation } from '../population-source';
import { sql } from '../db/client';
import { EMAE_HISTORICAL_CSV_URL, EMAE_PUBLICATION_PAGE_URL } from './constants';
import { fetchEmaeSectorWorkbookRows, fetchEmaeWorkbookRows } from './cache';
import { fetchTextFromUrl } from './http-client';

function mergeEmaeRows(rows: EmaeRawRow[], sectorRows: EmaeRawRow[]): EmaeRawRow[] {
    const byFecha = new Map<string, EmaeRawRow>();
    for (const row of rows) byFecha.set(row.fecha, row);
    for (const row of sectorRows) byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    return Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function fetchEmaeRaw(): Promise<{ rows: EmaeRawRow[]; publishedAt: string | null }> {
    const [rows, sectorRows, publicationHtml, historicalCsv, populationText] = await Promise.all([
        fetchEmaeWorkbookRows(),
        fetchEmaeSectorWorkbookRows(),
        fetchTextFromUrl(EMAE_PUBLICATION_PAGE_URL),
        fetchTextFromUrl(EMAE_HISTORICAL_CSV_URL),
        fetchTextFromUrl('https://api.worldbank.org/v2/country/ARG/indicator/SP.POP.TOTL?format=json&date=1992:2025&per_page=100'),
    ]);

    const publishedAt = parseEmaePublicationDate(publicationHtml);
    if (!publishedAt) {
        throw new Error('Failed to parse EMAE publication date. Verify INDEC publication page structure.');
    }

    const extendedRows = prependHistoricalEmae(rows, parseEmaeHistoricalCsv(historicalCsv));
    if (extendedRows[0]?.fecha !== '1993-01-01') {
        throw new Error(`Failed to extend EMAE history to 1993. Verify dates and seasonally adjusted indices in ${EMAE_HISTORICAL_CSV_URL}, including overlap with the INDEC workbook.`);
    }

    const populationRows = parseWorldBankPopulation(JSON.parse(populationText));
    if (populationRows.length < 2) {
        throw new Error('Failed to parse Argentina population history. Verify World Bank series SP.POP.TOTL.');
    }

    const mergedRows = mergeEmaeRows(extendedRows, sectorRows);
    const population = buildMonthlyPopulationSeries(populationRows, mergedRows.map(row => row.fecha));
    return { rows: mergedRows.map(row => ({ ...row, poblacion: population.get(row.fecha) ?? null })), publishedAt };
}

export async function ensureEmaeSectorTables(): Promise<void> {
    await sql.query('ALTER TABLE emae_raw ADD COLUMN IF NOT EXISTS poblacion NUMERIC', []);
    for (const column of EMAE_SECTOR_KEYS) await sql.query(`ALTER TABLE emae_raw ADD COLUMN IF NOT EXISTS ${column} NUMERIC`, []);
}
