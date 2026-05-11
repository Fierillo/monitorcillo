import type { EmaeRawRow } from '@/types';
import { EMAE_SECTOR_KEYS, EMAE_SECTOR_MM12_KEYS } from '../emae/schema';
import { parseEmaePublicationDate } from '../emae-source';
import { sql } from '../db/client';
import { EMAE_PUBLICATION_PAGE_URL } from './constants';
import { fetchEmaeSectorWorkbookRows, fetchEmaeWorkbookRows } from './cache';
import { fetchTextFromUrl } from './http-client';

function mergeEmaeRows(rows: EmaeRawRow[], sectorRows: EmaeRawRow[]): EmaeRawRow[] {
    const byFecha = new Map<string, EmaeRawRow>();
    for (const row of rows) byFecha.set(row.fecha, row);
    for (const row of sectorRows) byFecha.set(row.fecha, { ...byFecha.get(row.fecha), ...row });
    return Array.from(byFecha.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function fetchEmaeRaw(): Promise<{ rows: EmaeRawRow[]; publishedAt: string | null }> {
    const [rows, sectorRows, publicationHtml] = await Promise.all([
        fetchEmaeWorkbookRows(),
        fetchEmaeSectorWorkbookRows(),
        fetchTextFromUrl(EMAE_PUBLICATION_PAGE_URL),
    ]);

    const publishedAt = parseEmaePublicationDate(publicationHtml);
    if (!publishedAt) {
        throw new Error('Failed to parse EMAE publication date. Verify INDEC publication page structure.');
    }

    return { rows: mergeEmaeRows(rows, sectorRows), publishedAt };
}

export async function ensureEmaeSectorTables(): Promise<void> {
    for (const column of EMAE_SECTOR_KEYS) await sql.query(`ALTER TABLE emae_raw ADD COLUMN IF NOT EXISTS ${column} NUMERIC`, []);
    for (const column of EMAE_SECTOR_MM12_KEYS) await sql.query(`ALTER TABLE emae_normalized ADD COLUMN IF NOT EXISTS ${column} NUMERIC`, []);
}
