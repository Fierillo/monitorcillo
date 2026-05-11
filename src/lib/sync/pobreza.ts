import { fetchPobrezaRaw } from '../pobreza-source';
import { sql } from '../db/client';

export { fetchPobrezaRaw };

export async function ensurePobrezaTables(): Promise<void> {
    await sql.query(`CREATE TABLE IF NOT EXISTS pobreza_raw (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, pobreza_indec NUMERIC, pobreza_utdt NUMERIC, pobreza_utdt_first_quarter NUMERIC, pobreza_utdt_second_quarter NUMERIC, pobreza_utdt_lower NUMERIC, pobreza_utdt_upper NUMERIC, pobreza_utdt_proyectada NUMERIC, pobreza_utdt_proyectada_lower NUMERIC, pobreza_utdt_proyectada_upper NUMERIC, fetched_at TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`CREATE TABLE IF NOT EXISTS pobreza_normalized (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, pobreza_indec NUMERIC, pobreza_utdt NUMERIC, pobreza_utdt_lower NUMERIC, pobreza_utdt_upper NUMERIC, pobreza_utdt_proyectada NUMERIC, pobreza_utdt_proyectada_lower NUMERIC, pobreza_utdt_proyectada_upper NUMERIC, pobreza NUMERIC, preliminar BOOLEAN DEFAULT false, last_update TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`ALTER TABLE pobreza_raw ADD COLUMN IF NOT EXISTS pobreza_indec NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_raw ADD COLUMN IF NOT EXISTS pobreza_utdt NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_raw ADD COLUMN IF NOT EXISTS pobreza_utdt_first_quarter NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_raw ADD COLUMN IF NOT EXISTS pobreza_utdt_second_quarter NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_raw ADD COLUMN IF NOT EXISTS pobreza_utdt_lower NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_raw ADD COLUMN IF NOT EXISTS pobreza_utdt_upper NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_raw ADD COLUMN IF NOT EXISTS pobreza_utdt_proyectada NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_raw ADD COLUMN IF NOT EXISTS pobreza_utdt_proyectada_lower NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_raw ADD COLUMN IF NOT EXISTS pobreza_utdt_proyectada_upper NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_normalized ADD COLUMN IF NOT EXISTS pobreza_indec NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_normalized ADD COLUMN IF NOT EXISTS pobreza_utdt NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_normalized ADD COLUMN IF NOT EXISTS pobreza_utdt_lower NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_normalized ADD COLUMN IF NOT EXISTS pobreza_utdt_upper NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_normalized ADD COLUMN IF NOT EXISTS pobreza_utdt_proyectada NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_normalized ADD COLUMN IF NOT EXISTS pobreza_utdt_proyectada_lower NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_normalized ADD COLUMN IF NOT EXISTS pobreza_utdt_proyectada_upper NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_normalized ADD COLUMN IF NOT EXISTS pobreza NUMERIC`, []);
    await sql.query(`ALTER TABLE pobreza_normalized ADD COLUMN IF NOT EXISTS preliminar BOOLEAN DEFAULT false`, []);
}
