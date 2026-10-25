import type { ChartDataRow, GastoRawRow } from '@/types';
import { sql } from '../db/client';
import { fetchPublicSpendingChartRows } from '../public-spending-source';
import { toGastoRawRows } from '../normalize/gasto';
import { firstUsable, type SourceStep } from './source-chain';

const COLUMNS = 'nation NUMERIC, provinces NUMERIC, municipalities NUMERIC, interest NUMERIC, total NUMERIC, kind TEXT NOT NULL, as_of DATE, partial_quarters INTEGER, bridge_year INTEGER, interest_subnational NUMERIC';

export async function ensureGastoTables(): Promise<void> {
    await sql.query(`CREATE TABLE IF NOT EXISTS gasto_publico_raw (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, ${COLUMNS}, fetched_at TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`CREATE TABLE IF NOT EXISTS gasto_publico_normalized (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, ${COLUMNS}, last_update TIMESTAMP DEFAULT NOW())`, []);
    for (const table of ['gasto_publico_raw', 'gasto_publico_normalized']) {
        await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS interest_subnational NUMERIC`, []);
    }
}

const MECON_STEPS: Array<SourceStep<ChartDataRow & { fecha: string }>> = [
    { name: 'MECON gasto consolidado + DGSIAF/APNF (XLS/ZIP)', run: async () => fetchPublicSpendingChartRows() as Promise<Array<ChartDataRow & { fecha: string }>> },
];

/** MECON annual series and the annualized current year; a year without the current partial is stale (warning, not failure). */
export async function fetchGastoRaw(today: string, steps = MECON_STEPS, warn?: (message: string) => void): Promise<GastoRawRow[]> {
    // Chart rows carry the bare year as fecha; the chain compares ISO dates.
    const isoSteps = steps.map(step => ({ name: step.name, run: async () => toGastoRawRows(await step.run()) }));
    return firstUsable('Gasto público', isoSteps, { minLatest: `${today.slice(0, 4)}-01-01`, warn });
}
