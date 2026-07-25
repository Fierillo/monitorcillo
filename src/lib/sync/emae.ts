import type { EmaeRawRow } from '@/types';
import { EMAE_SECTOR_APORTE_KEYS, EMAE_SECTOR_KEYS, EMAE_SECTOR_MM12_KEYS } from '../emae/schema';
import { parseEmaePublicationDate, prependHistoricalEmae } from '../emae-source';
import { buildMonthlyPopulationSeries, parseWorldBankPopulation } from '../population-source';
import { sql } from '../db/client';
import { EMAE_PUBLICATION_PAGE_URL } from './constants';
import { fetchEmaeSectorWorkbookRows, fetchEmaeWorkbookRows } from './cache';
import { fetchFromUrl, fetchTextFromUrl } from './http-client';

function mergeEmaeRows(rows: EmaeRawRow[], sectorRows: EmaeRawRow[]): EmaeRawRow[] {
    const byFecha = new Map<string, EmaeRawRow>();
    for (const row of rows) byFecha.set(row.fecha, row);
    for (const row of sectorRows) byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    return Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function fetchEmaeRaw(): Promise<{ rows: EmaeRawRow[]; publishedAt: string | null }> {
    const [rows, sectorRows, publicationHtml, historicalResponse, populationText] = await Promise.all([
        fetchEmaeWorkbookRows(),
        fetchEmaeSectorWorkbookRows(),
        fetchTextFromUrl(EMAE_PUBLICATION_PAGE_URL),
        fetchFromUrl('https://apis.datos.gob.ar/series/api/series/?ids=10.3_ISD_1993_M_31&limit=5000'),
        fetchTextFromUrl('https://api.worldbank.org/v2/country/ARG/indicator/SP.POP.TOTL?format=json&date=1992:2025&per_page=100'),
    ]);

    const publishedAt = parseEmaePublicationDate(publicationHtml);
    if (!publishedAt) {
        throw new Error('Failed to parse EMAE publication date. Verify INDEC publication page structure.');
    }

    const extendedRows = prependHistoricalEmae(rows, historicalResponse.data ?? []);
    if (extendedRows[0]?.fecha !== '1993-01-01') {
        throw new Error('Failed to extend EMAE history to 1993. Verify datos.gob.ar series 10.3_ISD_1993_M_31.');
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
    await sql.query('ALTER TABLE emae_normalized ADD COLUMN IF NOT EXISTS emae_per_capita NUMERIC', []);
    for (const column of EMAE_SECTOR_KEYS) await sql.query(`ALTER TABLE emae_raw ADD COLUMN IF NOT EXISTS ${column} NUMERIC`, []);
    for (const column of [...EMAE_SECTOR_MM12_KEYS, ...EMAE_SECTOR_APORTE_KEYS]) {
        await sql.query(`ALTER TABLE emae_normalized ADD COLUMN IF NOT EXISTS ${column} NUMERIC`, []);
    }
}
