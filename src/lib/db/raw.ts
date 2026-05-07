import type { DbRow, DbValue, IndicatorType, RawDataByType } from '@/types';
import { sql } from './client';
import { formatDbDate, getTableName, isSafeColumn, toDbRow } from './tables';

export async function getRawData<T extends IndicatorType>(type: T): Promise<Array<RawDataByType[T]>> {
    const table = getTableName(type, false);
    try {
        const rows = await sql.query(`SELECT * FROM ${table} ORDER BY fecha`, []) as DbRow[];
        return rows.map((row) => ({ ...row, fecha: formatDbDate(row.fecha) })) as Array<RawDataByType[T]>;
    } catch (error) {
        console.error(`[db] getRawData failed for ${type}`, error);
        return [];
    }
}

export async function saveRawData<T extends IndicatorType>(type: T, data: Array<Partial<RawDataByType[T]>>): Promise<void> {
    const table = getTableName(type, false);
    if (data.length === 0) return;

    const groups = new Map<string, Array<Record<string, DbValue>>>();
    for (const row of data) {
        const dbRow = toDbRow(row);
        const keys = Object.keys(dbRow).sort().join(',');
        const group = groups.get(keys) || [];
        group.push(dbRow);
        groups.set(keys, group);
    }

    for (const [keyString, rows] of groups.entries()) {
        const keys = keyString.split(',');
        const BATCH_SIZE = 100;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const setClause = keys.filter(k => k !== 'fecha').map((k) => `${k} = EXCLUDED.${k}`).join(', ');
            const values: DbValue[] = [];
            const placeholders = batch.map((row) => {
                const rowPlaceholders = keys.map((key) => {
                    const placeholderIndex = values.length + 1;
                    values.push(row[key] === undefined ? null : row[key]);
                    return `$${placeholderIndex}`;
                }).join(', ');
                return `(${rowPlaceholders})`;
            }).join(', ');
            const updatePart = setClause ? `ON CONFLICT (fecha) DO UPDATE SET ${setClause}` : 'ON CONFLICT (fecha) DO NOTHING';
            await sql.query(`INSERT INTO ${table} (${keys.join(', ')}) VALUES ${placeholders} ${updatePart}`, values);
        }
    }
}

export async function replaceRawData<T extends IndicatorType>(type: T, data: Array<Partial<RawDataByType[T]>>): Promise<void> {
    const table = getTableName(type, false);
    await sql.query(`DELETE FROM ${table}`, []);
    await saveRawData(type, data);
}

export async function getRawDataByDate<T extends IndicatorType>(type: T, date: string): Promise<RawDataByType[T] | null> {
    const table = getTableName(type, false);
    try {
        const rows = await sql.query(`SELECT * FROM ${table} WHERE fecha = $1 LIMIT 1`, [date]) as DbRow[];
        return rows.length === 0 ? null : { ...rows[0], fecha: formatDbDate(rows[0].fecha) } as RawDataByType[T];
    } catch (error) {
        console.error(`[db] getRawDataByDate failed for ${type}`, error);
        return null;
    }
}

export async function getLatestRawDate(type: IndicatorType, fields: string[]): Promise<string | null> {
    if (fields.length === 0) return null;
    if (fields.some(field => !isSafeColumn(field))) throw new Error(`Invalid raw columns for ${type}`);
    const table = getTableName(type, false);
    const whereClause = fields.map(field => `${field} IS NOT NULL`).join(' OR ');

    try {
        const rows = await sql.query(`SELECT fecha FROM ${table} WHERE ${whereClause} ORDER BY fecha DESC LIMIT 1`, []) as DbRow[];
        return rows.length > 0 ? formatDbDate(rows[0].fecha) : null;
    } catch (error) {
        console.error(`[db] getLatestRawDate failed for ${type}`, error);
        return null;
    }
}
