import { fetchInflacionRaw, fetchInflacionRawReport } from '../inflacion-source';
import { sql } from '../db/client';

export { fetchInflacionRaw, fetchInflacionRawReport };

export async function ensureInflacionTables(): Promise<void> {
    await sql.query(`CREATE TABLE IF NOT EXISTS inflacion_raw (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, ipc_indec_general NUMERIC, ipc_indec_nucleo NUMERIC, ipc_equilibra NUMERIC, ipc_online NUMERIC, fetched_at TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`CREATE TABLE IF NOT EXISTS inflacion_normalized (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, ipc_indec NUMERIC, ipc_nucleo_indec NUMERIC, ipc_equilibra NUMERIC, ipc_online NUMERIC, ipc NUMERIC, last_update TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`ALTER TABLE inflacion_raw ADD COLUMN IF NOT EXISTS ipc_indec_general NUMERIC`, []);
    await sql.query(`ALTER TABLE inflacion_raw ADD COLUMN IF NOT EXISTS ipc_indec_nucleo NUMERIC`, []);
    await sql.query(`ALTER TABLE inflacion_raw ADD COLUMN IF NOT EXISTS ipc_equilibra NUMERIC`, []);
    await sql.query(`ALTER TABLE inflacion_raw ADD COLUMN IF NOT EXISTS ipc_online NUMERIC`, []);
    await sql.query(`ALTER TABLE inflacion_normalized ADD COLUMN IF NOT EXISTS ipc_indec NUMERIC`, []);
    await sql.query(`ALTER TABLE inflacion_normalized ADD COLUMN IF NOT EXISTS ipc_nucleo_indec NUMERIC`, []);
    await sql.query(`ALTER TABLE inflacion_normalized ADD COLUMN IF NOT EXISTS ipc_equilibra NUMERIC`, []);
    await sql.query(`ALTER TABLE inflacion_normalized ADD COLUMN IF NOT EXISTS ipc_online NUMERIC`, []);
    await sql.query(`ALTER TABLE inflacion_normalized ADD COLUMN IF NOT EXISTS ipc NUMERIC`, []);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_inflacion_fecha ON inflacion_raw(fecha)`, []);
}
