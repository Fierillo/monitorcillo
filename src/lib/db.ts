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

export interface CatalogIndicator {
    id: string;
    indicador: string;
    referencia: string;
    dato: string;
    fecha: string;
    fuente: string;
    trend: string;
    category: string;
    has_details: boolean;
    source_url: string | null;
}

export async function getIndicatorsCatalog(): Promise<any[]> {
    return sql.query('SELECT * FROM indicators_catalog ORDER BY category, indicador');
}

export async function saveIndicatorsCatalog(data: Record<string, any>[]): Promise<void> {
    for (const row of data) {
        const query = `
            INSERT INTO indicators_catalog (id, indicador, referencia, dato, fecha, fuente, trend, category, has_details, source_url, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
            ON CONFLICT (id) DO UPDATE SET
                indicador = EXCLUDED.indicador,
                referencia = EXCLUDED.referencia,
                dato = EXCLUDED.dato,
                fecha = EXCLUDED.fecha,
                fuente = EXCLUDED.fuente,
                trend = EXCLUDED.trend,
                category = EXCLUDED.category,
                has_details = EXCLUDED.has_details,
                source_url = EXCLUDED.source_url,
                updated_at = NOW()
        `;
        await sql.query(query, [
            row.id, row.indicador, row.referencia, row.dato, row.fecha,
            row.fuente, row.trend, row.category, row.has_details, row.source_url
        ]);
    }
}

export interface BcraOverride {
    category: string;
    month: string;
    value: number;
}

export async function getBcraOverrides(): Promise<Record<string, Record<string, number>>> {
    const rows = await sql.query('SELECT category, month, value FROM bcra_overrides');
    
    const result: Record<string, Record<string, number>> = {
        otros: {},
        tesoro: {}
    };
    
    for (const row of rows) {
        result[row.category][row.month] = row.value;
    }
    
    return result;
}

export async function saveBcraOverride(category: string, month: string, value: number): Promise<void> {
    await sql.query(
        `INSERT INTO bcra_overrides (category, month, value, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (category, month) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [category, month, value]
    );
}

export async function saveBcraOverrides(overrides: Record<string, Record<string, number>>): Promise<void> {
    for (const category of Object.keys(overrides)) {
        for (const [month, value] of Object.entries(overrides[category])) {
            await saveBcraOverride(category, month, value);
        }
    }
}