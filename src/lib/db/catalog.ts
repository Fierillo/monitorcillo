import type { CatalogIndicatorRow, DbRow } from '@/types';
import { sql } from './client';
import { toCatalogTrend } from './row-mappers';
import { formatDbDate } from './tables';

let indicatorPublicationsTableReady = false;

export async function getIndicatorsCatalog(): Promise<CatalogIndicatorRow[]> {
    try {
        const rows = await sql.query('SELECT * FROM indicators_catalog ORDER BY category, indicador', []) as DbRow[];
        return rows.map((row) => ({
            id: String(row.id ?? ''),
            indicador: String(row.indicador ?? ''),
            referencia: String(row.referencia ?? ''),
            dato: String(row.dato ?? ''),
            fecha: String(row.fecha ?? ''),
            fuente: String(row.fuente ?? ''),
            trend: toCatalogTrend(row.trend),
            category: String(row.category ?? ''),
            has_details: Boolean(row.has_details),
            source_url: row.source_url == null ? null : String(row.source_url),
            proxima_fecha: row.proxima_fecha == null ? undefined : String(row.proxima_fecha),
        }));
    } catch (error) {
        console.error('[db] getIndicatorsCatalog failed', error);
        return [];
    }
}

export async function saveIndicatorsCatalog(data: CatalogIndicatorRow[]): Promise<void> {
    await sql.query(`ALTER TABLE indicators_catalog ADD COLUMN IF NOT EXISTS proxima_fecha VARCHAR(20)`, []);
    for (const row of data) {
        const query = `
            INSERT INTO indicators_catalog (id, indicador, referencia, dato, fecha, fuente, trend, category, has_details, source_url, proxima_fecha, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
            ON CONFLICT (id) DO UPDATE SET
                indicador = EXCLUDED.indicador,
                referencia = EXCLUDED.referencia,
                dato = EXCLUDED.dato,
                fecha = EXCLUDED.fecha,
                fuente = EXCLUDED.fuente,
                trend = EXCLUDED.trend,
                category = EXCLUDED.category,
                has_details = EXCLUDED.has_details,
                source_url = EXCLUDED.source_url,
                proxima_fecha = EXCLUDED.proxima_fecha,
                updated_at = NOW()
        `;
        await sql.query(query, [row.id, row.indicador, row.referencia, row.dato, row.fecha, row.fuente, row.trend, row.category, row.has_details, row.source_url, row.proxima_fecha ?? null]);
    }
}

async function ensureIndicatorPublicationsTable(): Promise<void> {
    if (indicatorPublicationsTableReady) return;

    await sql.query(`
        CREATE TABLE IF NOT EXISTS indicator_publications (
            id VARCHAR(50) PRIMARY KEY,
            published_at DATE NOT NULL,
            period_date DATE,
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `, []);
    indicatorPublicationsTableReady = true;
}

export async function saveIndicatorPublication(id: string, publishedAt: string, periodDate: string | null = null): Promise<void> {
    await ensureIndicatorPublicationsTable();
    await sql.query(`
        INSERT INTO indicator_publications (id, published_at, period_date, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (id) DO UPDATE SET
            published_at = EXCLUDED.published_at,
            period_date = EXCLUDED.period_date,
            updated_at = NOW()
    `, [id, publishedAt, periodDate]);
}

export async function getIndicatorPublicationDate(id: string): Promise<string | null> {
    try {
        await ensureIndicatorPublicationsTable();
        const rows = await sql.query('SELECT published_at FROM indicator_publications WHERE id = $1', [id]) as DbRow[];
        return rows.length > 0 ? formatDbDate(rows[0].published_at) : null;
    } catch (error) {
        console.error(`[db] getIndicatorPublicationDate failed for ${id}`, error);
        return null;
    }
}
