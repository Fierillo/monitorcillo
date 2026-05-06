import { neon } from '@neondatabase/serverless';
import type {
    CatalogIndicatorRow,
    DbRow,
    DbValue,
    IndicatorTrend,
    IndicatorType,
    NormalizedDataByType,
    NormalizedDataRow,
    RawDataByType,
} from '@/types';
import { fechaToISO, isoToFecha, isoToMonthLabel } from './normalize';

const sql = neon(process.env.NEON_URL!);

const TABLES: Record<IndicatorType, { raw: string; normalized: string }> = {
    emision: { raw: 'emision_raw', normalized: 'emision_normalized' },
    emae: { raw: 'emae_raw', normalized: 'emae_normalized' },
    bma: { raw: 'bma_raw', normalized: 'bma_normalized' },
    reca: { raw: 'recaudacion_raw', normalized: 'recaudacion_normalized' },
    poder: { raw: 'poder_adquisitivo_raw', normalized: 'poder_adquisitivo_normalized' },
};

let indicatorPublicationsTableReady = false;

function getTableName(type: IndicatorType, normalized: boolean): string {
    return normalized ? TABLES[type].normalized : TABLES[type].raw;
}

function formatDbDate(value: DbValue): string {
    if (value instanceof Date) return value.toISOString().split('T')[0];
    return String(value ?? '');
}

function toNumber(value: DbValue): number {
    return Number(value ?? 0);
}

function toNullableNumber(value: DbValue): number | null {
    if (value === null || value === undefined) return null;
    return Number(value);
}

function toCatalogTrend(value: DbValue): IndicatorTrend {
    if (value === 'up' || value === 'down' || value === 'neutral') return value;
    return 'neutral';
}

function toDbRow(row: object): Record<string, DbValue> {
    return row as Record<string, DbValue>;
}

function isSafeColumn(column: string): boolean {
    return /^[a-z_]+$/.test(column);
}

function toNormalizedRow<T extends IndicatorType>(type: T, row: DbRow): NormalizedDataByType[T] {
    const iso_fecha = formatDbDate(row.fecha);
    const common = {
        fecha: type === 'emision' ? isoToFecha(iso_fecha) : isoToMonthLabel(iso_fecha),
        iso_fecha,
    };

    if (type === 'emision') {
        const bcra = toNumber(row.bcra);
        const licitaciones = toNumber(row.licitaciones);
        const resultadoFiscal = toNumber(row.resultado_fiscal);
        return {
            ...common,
            BCRA: bcra,
            BCRA_POS: bcra > 0 ? bcra : null,
            BCRA_NEG: bcra < 0 ? bcra : null,
            TC: toNumber(row.tc),
            CompraDolares: toNumber(row.compra_dolares),
            Vencimientos: toNumber(row.vencimientos),
            Licitado: toNumber(row.licitado),
            Licitaciones: licitaciones,
            Licitaciones_POS: licitaciones > 0 ? licitaciones : null,
            Licitaciones_NEG: licitaciones < 0 ? licitaciones : null,
            'Resultado fiscal': resultadoFiscal,
            ResultadoFiscal_POS: resultadoFiscal > 0 ? resultadoFiscal : null,
            ResultadoFiscal_NEG: resultadoFiscal < 0 ? resultadoFiscal : null,
            TOTAL: toNumber(row.total),
            ACUMULADO: toNumber(row.acumulado),
        } as NormalizedDataByType[T];
    }

    if (type === 'emae') {
        return {
            ...common,
            emae: toNumber(row.emae),
            emae_desestacionalizado: toNullableNumber(row.emae_desestacionalizado),
            emae_tendencia: toNullableNumber(row.emae_tendencia),
        } as NormalizedDataByType[T];
    }

    if (type === 'bma') {
        return {
            ...common,
            BaseMonetaria: toNullableNumber(row.base_monetaria),
            PasivosRemunerados: toNullableNumber(row.pasivos_remunerados),
            DepositosTesoro: toNullableNumber(row.depositos_tesoro),
            BMAmplia: toNullableNumber(row.bma_amplia),
        } as NormalizedDataByType[T];
    }

    if (type === 'reca') {
        return {
            ...common,
            mes: String(row.mes ?? ''),
            year: toNumber(row.year),
            pctPbi: toNullableNumber(row.pct_pbi),
        } as NormalizedDataByType[T];
    }

    return {
        ...common,
        blanco: toNullableNumber(row.blanco),
        negro: toNullableNumber(row.negro),
        privado: toNullableNumber(row.privado),
        publico: toNullableNumber(row.publico),
        ripte: toNullableNumber(row.ripte),
        jubilacion: toNullableNumber(row.jubilacion),
    } as NormalizedDataByType[T];
}

export async function getRawData<T extends IndicatorType>(type: T): Promise<Array<RawDataByType[T]>> {
    const table = getTableName(type, false);
    try {
        const rows = await sql.query(`SELECT * FROM ${table} ORDER BY fecha`, []) as DbRow[];
        return rows.map((row) => ({
            ...row,
            fecha: formatDbDate(row.fecha),
        })) as Array<RawDataByType[T]>;
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
            const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES ${placeholders} ${updatePart}`;
            await sql.query(query, values);
        }
    }
}

export async function replaceRawData<T extends IndicatorType>(type: T, data: Array<Partial<RawDataByType[T]>>): Promise<void> {
    const table = getTableName(type, false);
    await sql.query(`DELETE FROM ${table}`, []);
    await saveRawData(type, data);
}

export async function getNormalizedData<T extends IndicatorType>(type: T): Promise<Array<NormalizedDataByType[T]> | null> {
    const table = getTableName(type, true);

    try {
        const rows = await sql.query(`SELECT * FROM ${table} ORDER BY fecha`, []) as DbRow[];
        if (rows.length === 0) return null;

        return rows.map((row) => toNormalizedRow(type, row));
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
        if (rows.length === 0) return null;
        return toNormalizedRow(type, rows[0]);
    } catch (error) {
        console.error(`[db] getLatestNormalizedData failed for ${type}`, error);
        return null;
    }
}

export async function getNormalizedDataByDate<T extends IndicatorType>(type: T, date: string): Promise<NormalizedDataByType[T] | null> {
    const table = getTableName(type, true);
    try {
        const rows = await sql.query(`SELECT * FROM ${table} WHERE fecha = $1 LIMIT 1`, [date]) as DbRow[];
        if (rows.length === 0) return null;
        return toNormalizedRow(type, rows[0]);
    } catch (error) {
        console.error(`[db] getNormalizedDataByDate failed for ${type}`, error);
        return null;
    }
}

export async function getRawDataByDate<T extends IndicatorType>(type: T, date: string): Promise<RawDataByType[T] | null> {
    const table = getTableName(type, false);
    try {
        const rows = await sql.query(`SELECT * FROM ${table} WHERE fecha = $1 LIMIT 1`, [date]) as DbRow[];
        if (rows.length === 0) return null;
        return {
            ...rows[0],
            fecha: formatDbDate(rows[0].fecha),
        } as RawDataByType[T];
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

export async function saveNormalizedData(type: IndicatorType, data: NormalizedDataRow[]): Promise<void> {
    const table = getTableName(type, true);
    if (data.length === 0) return;

    const BATCH_SIZE = 50;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);

        let keys: string[] = [];
        if (type === 'emision') keys = ['fecha', 'bcra', 'tc', 'compra_dolares', 'vencimientos', 'licitado', 'licitaciones', 'resultado_fiscal', 'total', 'acumulado'];
        else if (type === 'emae') keys = ['fecha', 'emae', 'emae_desestacionalizado', 'emae_tendencia'];
        else if (type === 'bma') keys = ['fecha', 'base_monetaria', 'pasivos_remunerados', 'depositos_tesoro', 'bma_amplia'];
        else if (type === 'reca') keys = ['fecha', 'mes', 'year', 'pct_pbi'];
        else if (type === 'poder') keys = ['fecha', 'blanco', 'negro', 'privado', 'publico', 'ripte', 'jubilacion'];

        if (keys.length === 0) continue;

        const setClause = keys.map(k => `${k} = EXCLUDED.${k}`).join(', ');
        const values: DbValue[] = [];
        const placeholders = batch.map((dataRow) => {
            const row = dataRow as Record<string, DbValue>;
            const fecha = row.iso_fecha || (typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(String(row.fecha ?? '')));
            if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) return null;

            const rowValues: DbValue[] = [fecha];
            if (type === 'emision') {
                rowValues.push(toNumber(row.BCRA), toNumber(row.TC), toNumber(row.CompraDolares), toNumber(row.Vencimientos), toNumber(row.Licitado), toNumber(row.Licitaciones), toNumber(row['Resultado fiscal']), toNumber(row.TOTAL), toNumber(row.ACUMULADO));
            } else if (type === 'emae') {
                rowValues.push(toNumber(row.emae), toNullableNumber(row.emae_desestacionalizado), toNullableNumber(row.emae_tendencia));
            } else if (type === 'bma') {
                rowValues.push(toNullableNumber(row.BaseMonetaria), toNullableNumber(row.PasivosRemunerados), toNullableNumber(row.DepositosTesoro), toNullableNumber(row.BMAmplia));
            } else if (type === 'reca') {
                rowValues.push(row.mes, toNullableNumber(row.year), toNullableNumber(row.pctPbi));
            } else if (type === 'poder') {
                rowValues.push(toNullableNumber(row.blanco), toNullableNumber(row.negro), toNullableNumber(row.privado), toNullableNumber(row.publico), toNullableNumber(row.ripte), toNullableNumber(row.jubilacion));
            }

            const rowPlaceholders = rowValues.map((_, valIndex) => {
                const placeholderIndex = values.length + valIndex + 1;
                return `$${placeholderIndex}`;
            }).join(', ');

            values.push(...rowValues);
            return `(${rowPlaceholders})`;
        }).filter((placeholder): placeholder is string => placeholder !== null).join(', ');

        if (!placeholders) continue;

        const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES ${placeholders} ON CONFLICT (fecha) DO UPDATE SET ${setClause}, last_update = NOW()`;
        await sql.query(query, values);
    }
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

export async function getIndicatorsCatalog(): Promise<CatalogIndicatorRow[]> {
    try {
        const rows = await sql.query('SELECT * FROM indicators_catalog ORDER BY category, indicador', []) as DbRow[];
        return rows.map((row) => ({
            id: String(row.id ?? ''),
            indicador: String(row.indicador ?? ''),
            referencia: String(row.referencia ?? ''),
            dato: String(row.dato ?? ''),
            fecha: String(row.fecha ?? ''),
            fuente: String(row.fuente ?? ''),
            trend: toCatalogTrend(row.trend),
            category: String(row.category ?? ''),
            has_details: Boolean(row.has_details),
            source_url: row.source_url == null ? null : String(row.source_url),
        }));
    } catch (error) {
        console.error('[db] getIndicatorsCatalog failed', error);
        return [];
    }
}

export async function saveIndicatorsCatalog(data: CatalogIndicatorRow[]): Promise<void> {
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

async function ensureIndicatorPublicationsTable(): Promise<void> {
    if (indicatorPublicationsTableReady) return;

    await sql.query(`
        CREATE TABLE IF NOT EXISTS indicator_publications (
            id VARCHAR(50) PRIMARY KEY,
            published_at DATE NOT NULL,
            period_date DATE,
            updated_at TIMESTAMP DEFAULT NOW()
        )
    `, []);
    indicatorPublicationsTableReady = true;
}

export async function saveIndicatorPublication(id: string, publishedAt: string, periodDate: string | null = null): Promise<void> {
    await ensureIndicatorPublicationsTable();
    await sql.query(`
        INSERT INTO indicator_publications (id, published_at, period_date, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (id) DO UPDATE SET
            published_at = EXCLUDED.published_at,
            period_date = EXCLUDED.period_date,
            updated_at = NOW()
    `, [id, publishedAt, periodDate]);
}

export async function getIndicatorPublicationDate(id: string): Promise<string | null> {
    try {
        await ensureIndicatorPublicationsTable();
        const rows = await sql.query('SELECT published_at FROM indicator_publications WHERE id = $1', [id]) as DbRow[];
        return rows.length > 0 ? formatDbDate(rows[0].published_at) : null;
    } catch (error) {
        console.error(`[db] getIndicatorPublicationDate failed for ${id}`, error);
        return null;
    }
}

const db = {
    getRawData,
    saveRawData,
    replaceRawData,
    getNormalizedData,
    getLatestNormalizedData,
    getNormalizedDataByDate,
    getRawDataByDate,
    getLatestRawDate,
    saveNormalizedData,
    replaceNormalizedData,
    getLastUpdate,
    getIndicatorsCatalog,
    saveIndicatorsCatalog,
    saveIndicatorPublication,
    getIndicatorPublicationDate,
};

export default db;
