import { sql } from '../db/client';

export { fetchPobrezaRawReport } from '../pobreza-source';

export async function ensurePobrezaTables(): Promise<void> {
    await sql.query(`CREATE TABLE IF NOT EXISTS pobreza_raw (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, pobreza_indec NUMERIC, pobreza_utdt NUMERIC, pobreza_uca NUMERIC, fetched_at TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`CREATE TABLE IF NOT EXISTS pobreza_normalized (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, pobreza_indec NUMERIC, pobreza_utdt NUMERIC, pobreza_uca NUMERIC, last_update TIMESTAMP DEFAULT NOW())`, []);
    for (const table of ['pobreza_raw', 'pobreza_normalized']) {
        for (const column of ['pobreza_indec', 'pobreza_utdt', 'pobreza_uca']) {
            await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} NUMERIC`, []);
        }
    }
}
