import { sql } from '../db/client';

export { fetchIcgRawReport } from '../icg-source';

export async function ensureIcgTables(): Promise<void> {
    await sql.query(`CREATE TABLE IF NOT EXISTS icg_raw (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, icg NUMERIC, fetched_at TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`CREATE TABLE IF NOT EXISTS icg_normalized (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, icg NUMERIC, last_update TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_icg_fecha ON icg_raw(fecha)`, []);
}
