import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.NEON_URL!);

const TABLES = {
    emision: { raw: 'emision_raw', normalized: 'emision_normalized' },
    emae: { raw: 'emae_raw', normalized: 'emae_normalized' },
    bma: { raw: 'bma_raw', normalized: 'bma_normalized' },
    reca: { raw: 'recaudacion_raw', normalized: 'recaudacion_normalized' },
    poder: { raw: 'poder_adquisitivo_raw', normalized: 'poder_adquisitivo_normalized' },
} as const;

export type IndicatorType = keyof typeof TABLES;

function getTableName(type: IndicatorType, normalized: boolean): string {
    return normalized ? TABLES[type].normalized : TABLES[type].raw;
}

export async function getRawData(type: IndicatorType): Promise<any[]> {
    const table = getTableName(type, false);
    return sql.query(`SELECT * FROM ${table} ORDER BY fecha`);
}

export async function saveRawData(type: IndicatorType, data: Record<string, any>[]): Promise<void> {
    const table = getTableName(type, false);
    
    for (const row of data) {
        const keys = Object.keys(row);
        const values = Object.values(row).map(v => v === undefined ? null : v);
        
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        
        const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT (fecha) DO UPDATE SET ${setClause}`;
        
        await sql.query(query, values).catch(() => {});
    }
}

export async function getNormalizedData(type: IndicatorType): Promise<any[] | null> {
    const table = getTableName(type, true);
    const rows = await sql.query(`SELECT data FROM ${table} ORDER BY fecha`);
    return rows.length > 0 ? rows.map((r: any) => r.data) : null;
}

export async function saveNormalizedData(type: IndicatorType, data: Record<string, any>[]): Promise<void> {
    const table = getTableName(type, true);
    
    for (const row of data) {
        const query = `INSERT INTO ${table} (fecha, data, last_update) VALUES ($1, $2, NOW()) ON CONFLICT (fecha) DO UPDATE SET data = EXCLUDED.data, last_update = NOW()`;
        await sql.query(query, [row.fecha, JSON.stringify(row)]);
    }
}

export async function getLastUpdate(type: IndicatorType): Promise<string | null> {
    const table = getTableName(type, true);
    const rows = await sql.query(`SELECT last_update FROM ${table} ORDER BY last_update DESC LIMIT 1`);
    return rows.length > 0 ? rows[0].last_update : null;
}