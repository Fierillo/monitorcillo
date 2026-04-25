import { neon } from '@neondatabase/serverless';
import { fechaToISO, isoToFecha, isoToMonthLabel, normalizeEmision } from './normalize';

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
    try {
        return await sql.query(`SELECT * FROM ${table} ORDER BY fecha`);
    } catch (error) {
        console.error(`[db] getRawData failed for ${type}`, error);
        return [];
    }
}

export async function saveRawData(type: IndicatorType, data: Record<string, any>[]): Promise<void> {
    const table = getTableName(type, false);
    
    for (const row of data) {
        const keys = Object.keys(row);
        const values = Object.values(row).map(v => v === undefined ? null : v);
        
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        
        const query = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT (fecha) DO UPDATE SET ${setClause}`;
        
        await sql.query(query, values);
    }
}

export async function replaceRawData(type: IndicatorType, data: Record<string, any>[]): Promise<void> {
    const table = getTableName(type, false);
    await sql.query(`DELETE FROM ${table}`);
    await saveRawData(type, data);
}

export async function getNormalizedData(type: IndicatorType): Promise<any[] | null> {
    const table = getTableName(type, true);

    if (type === 'emision') {
        try {
            const rows = await sql.query(`SELECT fecha, bcra, tc, compra_dolares, vencimientos, licitado, licitaciones, resultado_fiscal, total, acumulado FROM ${table} ORDER BY fecha`);
            if (rows.length > 0) {
                return rows.map((row: any) => {
                    const bcra = Number(row.bcra ?? 0);
                    const licitaciones = Number(row.licitaciones ?? 0);
                    const resultadoFiscal = Number(row.resultado_fiscal ?? 0);
                    return {
                        fecha: isoToFecha(row.fecha),
                        iso_fecha: row.fecha,
                        BCRA: bcra,
                        BCRA_POS: bcra > 0 ? bcra : null,
                        BCRA_NEG: bcra < 0 ? bcra : null,
                        TC: Number(row.tc ?? 0),
                        CompraDolares: Number(row.compra_dolares ?? 0),
                        Vencimientos: Number(row.vencimientos ?? 0),
                        Licitado: Number(row.licitado ?? 0),
                        Licitaciones: licitaciones,
                        Licitaciones_POS: licitaciones > 0 ? licitaciones : null,
                        Licitaciones_NEG: licitaciones < 0 ? licitaciones : null,
                        'Resultado fiscal': resultadoFiscal,
                        ResultadoFiscal_POS: resultadoFiscal > 0 ? resultadoFiscal : null,
                        ResultadoFiscal_NEG: resultadoFiscal < 0 ? resultadoFiscal : null,
                        TOTAL: Number(row.total ?? 0),
                        ACUMULADO: Number(row.acumulado ?? 0),
                    };
                });
            }
        } catch {}

        try {
            const rawRows = await sql.query(`SELECT fecha, compra_dolares, tc, bcra, vencimientos, licitado, resultado_fiscal FROM ${TABLES.emision.raw} ORDER BY fecha`);
            if (rawRows.length === 0) {
                return null;
            }

            return normalizeEmision(rawRows.map((row: any) => ({
                fecha: row.fecha,
                compra_dolares: Number(row.compra_dolares ?? 0),
                tc: Number(row.tc ?? 0),
                bcra: Number(row.bcra ?? 0),
                vencimientos: Number(row.vencimientos ?? 0),
                licitado: Number(row.licitado ?? 0),
                resultado_fiscal: Number(row.resultado_fiscal ?? 0),
            })));
        } catch {
            return null;
        }
    }

    if (type === 'emae') {
        try {
            const rows = await sql.query(`SELECT fecha, emae, emae_desestacionalizado, emae_tendencia FROM ${table} ORDER BY fecha`);
            return rows.length > 0 ? rows.map((row: any) => ({
                fecha: isoToMonthLabel(row.fecha),
                iso_fecha: row.fecha,
                emae: Number(row.emae ?? 0),
                emae_desestacionalizado: row.emae_desestacionalizado == null ? null : Number(row.emae_desestacionalizado),
                emae_tendencia: row.emae_tendencia == null ? null : Number(row.emae_tendencia),
            })) : null;
        } catch (error) {
            console.error('[db] getNormalizedData failed for emae', error);
            return null;
        }
    }

    if (type === 'bma') {
        try {
            const rows = await sql.query(`SELECT fecha, base_monetaria, pasivos_remunerados, depositos_tesoro, bma_amplia FROM ${table} ORDER BY fecha`);
            return rows.length > 0 ? rows.map((row: any) => ({
                fecha: isoToMonthLabel(row.fecha),
                iso_fecha: row.fecha,
                BaseMonetaria: row.base_monetaria == null ? null : Number(row.base_monetaria),
                PasivosRemunerados: row.pasivos_remunerados == null ? null : Number(row.pasivos_remunerados),
                DepositosTesoro: row.depositos_tesoro == null ? null : Number(row.depositos_tesoro),
                BMAmplia: row.bma_amplia == null ? null : Number(row.bma_amplia),
            })) : null;
        } catch (error) {
            console.error('[db] getNormalizedData failed for bma', error);
            return null;
        }
    }

    if (type === 'reca') {
        try {
            const rows = await sql.query(`SELECT fecha, mes, year, pct_pbi FROM ${table} ORDER BY fecha`);
            return rows.length > 0 ? rows.map((row: any) => ({
                fecha: isoToMonthLabel(row.fecha),
                iso_fecha: row.fecha,
                mes: row.mes,
                year: Number(row.year ?? 0),
                pctPbi: row.pct_pbi == null ? null : Number(row.pct_pbi),
            })) : null;
        } catch (error) {
            console.error('[db] getNormalizedData failed for reca', error);
            return null;
        }
    }

    if (type === 'poder') {
        try {
            const rows = await sql.query(`SELECT fecha, blanco, negro, privado, publico, ripte, jubilacion FROM ${table} ORDER BY fecha`);
            return rows.length > 0 ? rows.map((row: any) => ({
                fecha: isoToMonthLabel(row.fecha),
                iso_fecha: row.fecha,
                blanco: row.blanco == null ? null : Number(row.blanco),
                negro: row.negro == null ? null : Number(row.negro),
                privado: row.privado == null ? null : Number(row.privado),
                publico: row.publico == null ? null : Number(row.publico),
                ripte: row.ripte == null ? null : Number(row.ripte),
                jubilacion: row.jubilacion == null ? null : Number(row.jubilacion),
            })) : null;
        } catch (error) {
            console.error('[db] getNormalizedData failed for poder', error);
            return null;
        }
    }

    return null;
}

export async function saveNormalizedData(type: IndicatorType, data: Record<string, any>[]): Promise<void> {
    const table = getTableName(type, true);

    if (type === 'emision') {
        for (const row of data) {
            const fecha = typeof row.iso_fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.iso_fecha)
                ? row.iso_fecha
                : (typeof row.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.fecha) ? row.fecha : '');

            if (!fecha) continue;

            const query = `
                INSERT INTO ${table} (fecha, bcra, tc, compra_dolares, vencimientos, licitado, licitaciones, resultado_fiscal, total, acumulado, last_update)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
                ON CONFLICT (fecha) DO UPDATE SET
                    bcra = EXCLUDED.bcra,
                    tc = EXCLUDED.tc,
                    compra_dolares = EXCLUDED.compra_dolares,
                    vencimientos = EXCLUDED.vencimientos,
                    licitado = EXCLUDED.licitado,
                    licitaciones = EXCLUDED.licitaciones,
                    resultado_fiscal = EXCLUDED.resultado_fiscal,
                    total = EXCLUDED.total,
                    acumulado = EXCLUDED.acumulado,
                    last_update = NOW()
            `;

            await sql.query(query, [
                fecha,
                Number(row.BCRA ?? 0),
                Number(row.TC ?? 0),
                Number(row.CompraDolares ?? 0),
                Number(row.Vencimientos ?? 0),
                Number(row.Licitado ?? 0),
                Number(row.Licitaciones ?? 0),
                Number(row['Resultado fiscal'] ?? 0),
                Number(row.TOTAL ?? 0),
                Number(row.ACUMULADO ?? 0),
            ]);
        }

        return;
    }

    if (type === 'emae') {
        for (const row of data) {
            const fecha = row.iso_fecha || fechaToISO(row.fecha) || row.fecha;
            if (!fecha) continue;
            await sql.query(
                `INSERT INTO ${table} (fecha, emae, emae_desestacionalizado, emae_tendencia, last_update)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT (fecha) DO UPDATE SET
                   emae = EXCLUDED.emae,
                   emae_desestacionalizado = EXCLUDED.emae_desestacionalizado,
                   emae_tendencia = EXCLUDED.emae_tendencia,
                   last_update = NOW()`,
                [fecha, Number(row.emae ?? 0), row.emae_desestacionalizado == null ? null : Number(row.emae_desestacionalizado), row.emae_tendencia == null ? null : Number(row.emae_tendencia)]
            );
        }
        return;
    }

    if (type === 'bma') {
        for (const row of data) {
            const fecha = row.iso_fecha || fechaToISO(row.fecha) || row.fecha;
            if (!fecha) continue;
            await sql.query(
                `INSERT INTO ${table} (fecha, base_monetaria, pasivos_remunerados, depositos_tesoro, bma_amplia, last_update)
                 VALUES ($1, $2, $3, $4, $5, NOW())
                 ON CONFLICT (fecha) DO UPDATE SET
                   base_monetaria = EXCLUDED.base_monetaria,
                   pasivos_remunerados = EXCLUDED.pasivos_remunerados,
                   depositos_tesoro = EXCLUDED.depositos_tesoro,
                   bma_amplia = EXCLUDED.bma_amplia,
                   last_update = NOW()`,
                [fecha, row.BaseMonetaria == null ? null : Number(row.BaseMonetaria), row.PasivosRemunerados == null ? null : Number(row.PasivosRemunerados), row.DepositosTesoro == null ? null : Number(row.DepositosTesoro), row.BMAmplia == null ? null : Number(row.BMAmplia)]
            );
        }
        return;
    }

    if (type === 'reca') {
        for (const row of data) {
            const fecha = row.iso_fecha || fechaToISO(row.fecha) || row.fecha;
            if (!fecha) continue;
            await sql.query(
                `INSERT INTO ${table} (fecha, mes, year, pct_pbi, last_update)
                 VALUES ($1, $2, $3, $4, NOW())
                 ON CONFLICT (fecha) DO UPDATE SET
                   mes = EXCLUDED.mes,
                   year = EXCLUDED.year,
                   pct_pbi = EXCLUDED.pct_pbi,
                   last_update = NOW()`,
                [fecha, row.mes ?? null, row.year == null ? null : Number(row.year), row.pctPbi == null ? null : Number(row.pctPbi)]
            );
        }
        return;
    }

    if (type === 'poder') {
        for (const row of data) {
            const fecha = row.iso_fecha || fechaToISO(row.fecha) || row.fecha;
            if (!fecha) continue;
            await sql.query(
                `INSERT INTO ${table} (fecha, blanco, negro, privado, publico, ripte, jubilacion, last_update)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                 ON CONFLICT (fecha) DO UPDATE SET
                   blanco = EXCLUDED.blanco,
                   negro = EXCLUDED.negro,
                   privado = EXCLUDED.privado,
                   publico = EXCLUDED.publico,
                   ripte = EXCLUDED.ripte,
                   jubilacion = EXCLUDED.jubilacion,
                   last_update = NOW()`,
                [fecha, row.blanco == null ? null : Number(row.blanco), row.negro == null ? null : Number(row.negro), row.privado == null ? null : Number(row.privado), row.publico == null ? null : Number(row.publico), row.ripte == null ? null : Number(row.ripte), row.jubilacion == null ? null : Number(row.jubilacion)]
            );
        }
        return;
    }
}

export async function replaceNormalizedData(type: IndicatorType, data: Record<string, any>[]): Promise<void> {
    const table = getTableName(type, true);
    await sql.query(`DELETE FROM ${table}`);
    await saveNormalizedData(type, data);
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
