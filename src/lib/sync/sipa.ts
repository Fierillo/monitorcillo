import { sql } from '../db/client';
import { SIPA_VALUE_KEYS } from '../sipa-schema';

export { fetchSipaRawReport } from '../sipa-source';

export async function ensureSipaTables(): Promise<void> {
    const valueColumns = SIPA_VALUE_KEYS.map(key => `${key} NUMERIC`).join(', ');
    await sql.query(
        `CREATE TABLE IF NOT EXISTS sipa_raw (
            id SERIAL PRIMARY KEY,
            fecha DATE UNIQUE NOT NULL,
            ${valueColumns},
            provisional BOOLEAN NOT NULL DEFAULT FALSE,
            fetched_at TIMESTAMP DEFAULT NOW()
        )`,
        [],
    );
    await sql.query(
        `CREATE TABLE IF NOT EXISTS sipa_normalized (
            id SERIAL PRIMARY KEY,
            fecha DATE UNIQUE NOT NULL,
            ${valueColumns},
            provisional BOOLEAN NOT NULL DEFAULT FALSE,
            last_update TIMESTAMP DEFAULT NOW()
        )`,
        [],
    );
    await sql.query('CREATE INDEX IF NOT EXISTS idx_sipa_fecha ON sipa_raw(fecha)', []);
}
