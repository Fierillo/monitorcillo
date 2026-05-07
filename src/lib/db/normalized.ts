import type { DbRow, DbValue, IndicatorType, NormalizedDataByType, NormalizedDataRow } from '@/types';
import { fechaToISO } from '../normalize';
import { sql } from './client';
import { toNormalizedRow } from './row-mappers';
import { getTableName, isSafeColumn, toNullableNumber, toNumber } from './tables';

const NORMALIZED_KEYS: Record<IndicatorType, string[]> = {
    emision: ['fecha', 'bcra', 'tc', 'compra_dolares', 'vencimientos', 'licitado', 'licitaciones', 'resultado_fiscal', 'total', 'acumulado'],
    emae: ['fecha', 'emae', 'emae_desestacionalizado', 'emae_tendencia'],
    bma: ['fecha', 'base_monetaria', 'pasivos_remunerados', 'depositos_tesoro', 'bma_amplia'],
    reca: ['fecha', 'mes', 'year', 'pct_pbi', 'pct_pbi_mm12'],
    poder: ['fecha', 'blanco', 'negro', 'privado', 'publico', 'ripte', 'jubilacion'],
};

export async function getNormalizedData<T extends IndicatorType>(type: T): Promise<Array<NormalizedDataByType[T]> | null> {
    const table = getTableName(type, true);
    try {
        const rows = await sql.query(`SELECT * FROM ${table} ORDER BY fecha`, []) as DbRow[];
        return rows.length === 0 ? null : rows.map((row) => toNormalizedRow(type, row));
    } catch (error) {
        console.error(`[db] getNormalizedData failed for ${type}`, error);
        return null;
    }
}

export async function getLatestNormalizedData<T extends IndicatorType>(type: T, valueColumn: string): Promise<NormalizedDataByType[T] | null> {
    if (!isSafeColumn(valueColumn)) throw new Error(`Invalid normalized column: ${valueColumn}`);
    const table = getTableName(type, true);
    try {
        const rows = await sql.query(`SELECT * FROM ${table} WHERE ${valueColumn} IS NOT NULL ORDER BY fecha DESC LIMIT 1`, []) as DbRow[];
        return rows.length === 0 ? null : toNormalizedRow(type, rows[0]);
    } catch (error) {
        console.error(`[db] getLatestNormalizedData failed for ${type}`, error);
        return null;
    }
}

export async function getNormalizedDataByDate<T extends IndicatorType>(type: T, date: string): Promise<NormalizedDataByType[T] | null> {
    const table = getTableName(type, true);
    try {
        const rows = await sql.query(`SELECT * FROM ${table} WHERE fecha = $1 LIMIT 1`, [date]) as DbRow[];
        return rows.length === 0 ? null : toNormalizedRow(type, rows[0]);
    } catch (error) {
        console.error(`[db] getNormalizedDataByDate failed for ${type}`, error);
        return null;
    }
}

function valuesForRow(type: IndicatorType, dataRow: NormalizedDataRow): DbValue[] | null {
    const row = dataRow as Record<string, DbValue>;
    const fecha = row.iso_fecha || (typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(String(row.fecha ?? '')));
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) return null;

    if (type === 'emision') return [fecha, toNumber(row.BCRA), toNumber(row.TC), toNumber(row.CompraDolares), toNumber(row.Vencimientos), toNumber(row.Licitado), toNumber(row.Licitaciones), toNumber(row['Resultado fiscal']), toNumber(row.TOTAL), toNumber(row.ACUMULADO)];
    if (type === 'emae') return [fecha, toNumber(row.emae), toNullableNumber(row.emae_desestacionalizado), toNullableNumber(row.emae_tendencia)];
    if (type === 'bma') return [fecha, toNullableNumber(row.BaseMonetaria), toNullableNumber(row.PasivosRemunerados), toNullableNumber(row.DepositosTesoro), toNullableNumber(row.BMAmplia)];
    if (type === 'reca') return [fecha, row.mes, toNullableNumber(row.year), toNullableNumber(row.pctPbi), toNullableNumber(row.pctPbiMm12)];
    return [fecha, toNullableNumber(row.blanco), toNullableNumber(row.negro), toNullableNumber(row.privado), toNullableNumber(row.publico), toNullableNumber(row.ripte), toNullableNumber(row.jubilacion)];
}

export async function saveNormalizedData(type: IndicatorType, data: NormalizedDataRow[]): Promise<void> {
    const table = getTableName(type, true);
    if (data.length === 0) return;
    if (type === 'reca') await ensureRecaudacionMm12Column(table);

    const BATCH_SIZE = 50;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        const keys = NORMALIZED_KEYS[type];
        const setClause = keys.map(k => `${k} = EXCLUDED.${k}`).join(', ');
        const values: DbValue[] = [];
        const placeholders = batch.map((dataRow) => {
            const rowValues = valuesForRow(type, dataRow);
            if (!rowValues) return null;
            const rowPlaceholders = rowValues.map((_, valIndex) => `$${values.length + valIndex + 1}`).join(', ');
            values.push(...rowValues);
            return `(${rowPlaceholders})`;
        }).filter((placeholder): placeholder is string => placeholder !== null).join(', ');

        if (placeholders) await sql.query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES ${placeholders} ON CONFLICT (fecha) DO UPDATE SET ${setClause}, last_update = NOW()`, values);
    }
}

async function ensureRecaudacionMm12Column(table: string): Promise<void> {
    await sql.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS pct_pbi_mm12 NUMERIC`, []);
}

export async function replaceNormalizedData(type: IndicatorType, data: NormalizedDataRow[]): Promise<void> {
    const table = getTableName(type, true);
    await sql.query(`DELETE FROM ${table}`, []);
    await saveNormalizedData(type, data);
}

export async function getLastUpdate(type: IndicatorType): Promise<string | null> {
    const table = getTableName(type, true);
    try {
        const rows = await sql.query(`SELECT last_update FROM ${table} ORDER BY last_update DESC LIMIT 1`, []) as DbRow[];
        return rows.length > 0 ? String(rows[0].last_update ?? '') : null;
    } catch {
        return null;
    }
}
