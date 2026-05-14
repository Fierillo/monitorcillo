import { fetchPobrezaRaw, fetchPobrezaRawReport } from '../pobreza-source';
import { sql } from '../db/client';

export { fetchPobrezaRaw, fetchPobrezaRawReport };

export async function ensurePobrezaTables(): Promise<void> {
    await sql.query(`CREATE TABLE IF NOT EXISTS pobreza_raw (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, pobreza_indec NUMERIC, pobreza_utdt NUMERIC, fetched_at TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`CREATE TABLE IF NOT EXISTS pobreza_normalized (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, pobreza_indec NUMERIC, pobreza_utdt NUMERIC, last_update TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`ALTER TABLE pobreza_raw ADD COLUMN IF NOT EXISTS pobreza_indec NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_raw ADD COLUMN IF NOT EXISTS pobreza_utdt NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_normalized ADD COLUMN IF NOT EXISTS pobreza_indec NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_normalized ADD COLUMN IF NOT EXISTS pobreza_utdt NUMERIC`, []);
}
