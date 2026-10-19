import type { NeonQueryPromise } from '@neondatabase/serverless';
import type { DbRow, DbValue, IndicatorType, NormalizedDataByType, NormalizedDataRow } from '@/types';
import { EMAE_SECTOR_APORTE_KEYS, EMAE_SECTOR_MM12_KEYS } from '../emae/schema';
import { RECAUDACION_TAX_MM12_DB_COLUMNS, RECAUDACION_TAX_PCT_DB_COLUMNS } from '../recaudacion/schema';
import { sql } from './client';
import { NORMALIZED_COLUMNS, toNormalizedRow, valuesForNormalizedRow } from './row-mappers';
import { getTableName, isMissingTableError, isSafeColumn } from './tables';

export async function getNormalizedData<T extends IndicatorType>(type: T): Promise<Array<NormalizedDataByType[T]> | null> {
    const table = getTableName(type, true);
    try {
        const rows = await sql.query(`SELECT * FROM ${table} ORDER BY fecha`, []) as DbRow[];
        return rows.length === 0 ? null : rows.map((row) => toNormalizedRow(type, row));
    } catch (error) {
        if (!isMissingTableError(error)) throw error;
        return null;
    }
}

export async function getLatestNormalizedData<T extends IndicatorType>(type: T, valueColumn: string, fallbackColumns: string[] = []): Promise<NormalizedDataByType[T] | null> {
    if (!isSafeColumn(valueColumn)) throw new Error(`Invalid normalized column: ${valueColumn}`);
    const allColumns = [valueColumn, ...fallbackColumns].filter(isSafeColumn);
    if (allColumns.length === 0) throw new Error(`No valid columns for ${type}`);
    const whereClause = allColumns.map(col => `${col} IS NOT NULL`).join(' OR ');
    const table = getTableName(type, true);
    try {
        const rows = await sql.query(`SELECT * FROM ${table} WHERE ${whereClause} ORDER BY fecha DESC LIMIT 1`, []) as DbRow[];
        return rows.length === 0 ? null : toNormalizedRow(type, rows[0]);
    } catch (error) {
        if (!isMissingTableError(error)) throw error;
        return null;
    }
}

export async function getNormalizedDataByDate<T extends IndicatorType>(type: T, date: string): Promise<NormalizedDataByType[T] | null> {
    const table = getTableName(type, true);
    try {
        const rows = await sql.query(`SELECT * FROM ${table} WHERE fecha = $1 LIMIT 1`, [date]) as DbRow[];
        return rows.length === 0 ? null : toNormalizedRow(type, rows[0]);
    } catch (error) {
        if (!isMissingTableError(error)) throw error;
        return null;
    }
}

function normalizedInsertQueries(type: IndicatorType, data: NormalizedDataRow[]): Array<NeonQueryPromise<false, false>> {
    const table = getTableName(type, true);
    const BATCH_SIZE = 50;
    const queries: Array<NeonQueryPromise<false, false>> = [];
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        const keys = NORMALIZED_COLUMNS[type];
        const setClause = keys.map(k => `${k} = EXCLUDED.${k}`).join(', ');
        const values: DbValue[] = [];
        const placeholders = batch.map((dataRow) => {
            const rowValues = valuesForNormalizedRow(type, dataRow);
            if (!rowValues) return null;
            const rowPlaceholders = rowValues.map((_, valIndex) => `$${values.length + valIndex + 1}`).join(', ');
            values.push(...rowValues);
            return `(${rowPlaceholders})`;
        }).filter((placeholder): placeholder is string => placeholder !== null).join(', ');

        if (placeholders) queries.push(sql.query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES ${placeholders} ON CONFLICT (fecha) DO UPDATE SET ${setClause}, last_update = NOW()`, values));
    }

    return queries;
}

async function ensureNormalizedColumns(type: IndicatorType, table: string): Promise<void> {
    if (type === 'emae') await ensureEmaeSectorColumns(table);
    if (type === 'bma') await ensureBmaMillionsColumns(table);
    if (type === 'reca') await ensureRecaudacionTaxColumns(table);
    if (type === 'deuda') await ensureDeudaAcumuladoColumn(table);
}

async function ensureBmaMillionsColumns(table: string): Promise<void> {
    for (const column of ['base_monetaria_millones', 'pasivos_remunerados_millones', 'depositos_tesoro_millones', 'bma_amplia_millones']) {
        await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} NUMERIC`, []);
    }
}

async function ensureRecaudacionTaxColumns(table: string): Promise<void> {
    await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS pct_pbi_mm12 NUMERIC`, []);
    for (const column of [...RECAUDACION_TAX_PCT_DB_COLUMNS, ...RECAUDACION_TAX_MM12_DB_COLUMNS]) {
        await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} NUMERIC`, []);
    }
}

async function ensureEmaeSectorColumns(table: string): Promise<void> {
    for (const column of ['emae_per_capita', ...EMAE_SECTOR_MM12_KEYS, ...EMAE_SECTOR_APORTE_KEYS]) {
        await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} NUMERIC`, []);
    }
}

async function ensureDeudaAcumuladoColumn(table: string): Promise<void> {
    await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS acumulado NUMERIC`, []);
}

export async function replaceNormalizedData(type: IndicatorType, data: NormalizedDataRow[]): Promise<void> {
    if (data.length === 0) {
        console.warn(`[db] replaceNormalizedData(${type}) refused empty payload to preserve existing history`);
        return;
    }
    const table = getTableName(type, true);
    await ensureNormalizedColumns(type, table);
    await sql.transaction([
        sql.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`normalized:${table}`]),
        sql.query(`DELETE FROM ${table}`, []),
        ...normalizedInsertQueries(type, data),
    ]);
}
