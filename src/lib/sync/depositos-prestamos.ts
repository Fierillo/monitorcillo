import type { BcraVariableRow, DepositosPrestamosRawRow } from '@/types';
import { sql } from '../db/client';
import { buildMonthlyPbiSeries } from '../pbi-source';
import { fetchBcraVariable } from './bcra';
import { fetchEmaeWorkbookRows, fetchPbiAnchorRows } from './cache';
import { emaeDesestacionalizadoMap, seriesValueMap, valueAtOrBefore } from './series';
import { fetchTimeSeries } from './time-series-client';

const FROM_DATE = '2017-01-01';

function lastByMonth(rows: BcraVariableRow[]): Map<string, BcraVariableRow> {
    const result = new Map<string, BcraVariableRow>();
    for (const row of rows) {
        if (!row.fecha || !Number.isFinite(Number(row.valor))) continue;
        const month = row.fecha.slice(0, 7);
        if (!result.has(month) || result.get(month)!.fecha < row.fecha) result.set(month, row);
    }
    return result;
}

export async function fetchDepositosPrestamosRaw(): Promise<DepositosPrestamosRawRow[]> {
    const toDate = new Date().toISOString().split('T')[0];
    const [depositosPesos, depositosUsd, prestamosPesos, prestamosUsd, depositosPublicosPesos, depositosPublicosUsd, prestamosPublicosPesos, prestamosPublicosUsd, tc, pbiAnchors, emae, ipc] = await Promise.all([
        fetchBcraVariable(100, FROM_DATE, toDate),
        fetchBcraVariable(108, FROM_DATE, toDate),
        fetchBcraVariable(117, FROM_DATE, toDate),
        fetchBcraVariable(125, FROM_DATE, toDate),
        fetchBcraVariable(1455, FROM_DATE, toDate),
        fetchBcraVariable(1493, FROM_DATE, toDate),
        fetchBcraVariable(1313, FROM_DATE, toDate),
        fetchBcraVariable(1327, FROM_DATE, toDate),
        fetchBcraVariable(4, FROM_DATE, toDate),
        fetchPbiAnchorRows(),
        fetchEmaeWorkbookRows(),
        fetchTimeSeries({ ids: ['148.3_INUCLEONAL_DICI_M_19'] }),
    ]);
    const series = [depositosPesos, depositosUsd, prestamosPesos, prestamosUsd, depositosPublicosPesos, depositosPublicosUsd, prestamosPublicosPesos, prestamosPublicosUsd].map(lastByMonth);
    const months = [...new Set(series.flatMap(values => [...values.keys()]))].sort();
    const dates = months.map(month => `${month}-01`);
    const pbiByDate = buildMonthlyPbiSeries(pbiAnchors, emae, dates);
    const emaeByDate = emaeDesestacionalizadoMap(emae);
    const ipcByDate = seriesValueMap(ipc.data || []);
    const tcByDate = seriesValueMap(tc.map(row => [row.fecha, row.valor]));

    return months.map((month) => {
        const fecha = `${month}-01`;
        const closingDate = series.map(values => values.get(month)?.fecha).filter(Boolean).sort().at(-1) ?? fecha;
        return {
            fecha,
            depositos_pesos: series[0].get(month)?.valor,
            depositos_usd: series[1].get(month)?.valor,
            prestamos_pesos: series[2].get(month)?.valor,
            prestamos_usd: series[3].get(month)?.valor,
            depositos_publicos_pesos: series[4].get(month)?.valor,
            depositos_publicos_usd: series[5].get(month)?.valor,
            prestamos_publicos_pesos: series[6].get(month)?.valor,
            prestamos_publicos_usd: series[7].get(month)?.valor,
            tc: valueAtOrBefore(tcByDate, closingDate),
            pbi_trimestral: pbiByDate.get(fecha),
            emae_desestacionalizado: emaeByDate.get(fecha),
            ipc_nucleo: valueAtOrBefore(ipcByDate, fecha),
        };
    });
}

export async function ensureDepositosPrestamosTables(): Promise<void> {
    await sql.query(`CREATE TABLE IF NOT EXISTS depositos_prestamos_raw (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, depositos_pesos DECIMAL, depositos_usd DECIMAL, prestamos_pesos DECIMAL, prestamos_usd DECIMAL, depositos_publicos_pesos DECIMAL, depositos_publicos_usd DECIMAL, prestamos_publicos_pesos DECIMAL, prestamos_publicos_usd DECIMAL, tc DECIMAL, pbi_trimestral DECIMAL, emae_desestacionalizado DECIMAL, ipc_nucleo DECIMAL, fetched_at TIMESTAMP DEFAULT NOW())`, []);
    await sql.query(`CREATE TABLE IF NOT EXISTS depositos_prestamos_normalized (id SERIAL PRIMARY KEY, fecha DATE UNIQUE NOT NULL, depositos_pesos_pbi DECIMAL, depositos_usd_pbi DECIMAL, depositos_total_pbi DECIMAL, prestamos_pesos_pbi DECIMAL, prestamos_usd_pbi DECIMAL, prestamos_total_pbi DECIMAL, depositos_pesos_constantes DECIMAL, depositos_usd_constantes DECIMAL, prestamos_pesos_constantes DECIMAL, prestamos_usd_constantes DECIMAL, depositos_publicos_pesos_pbi DECIMAL, depositos_publicos_usd_pbi DECIMAL, prestamos_publicos_pesos_pbi DECIMAL, prestamos_publicos_usd_pbi DECIMAL, depositos_publicos_pesos_constantes DECIMAL, depositos_publicos_usd_constantes DECIMAL, prestamos_publicos_pesos_constantes DECIMAL, prestamos_publicos_usd_constantes DECIMAL, last_update TIMESTAMP DEFAULT NOW())`, []);
    for (const column of ['depositos_publicos_pesos', 'depositos_publicos_usd', 'prestamos_publicos_pesos', 'prestamos_publicos_usd']) await sql.query(`ALTER TABLE depositos_prestamos_raw ADD COLUMN IF NOT EXISTS ${column} DECIMAL`, []);
    for (const column of ['depositos_publicos_pesos_pbi', 'depositos_publicos_usd_pbi', 'prestamos_publicos_pesos_pbi', 'prestamos_publicos_usd_pbi', 'depositos_publicos_pesos_constantes', 'depositos_publicos_usd_constantes', 'prestamos_publicos_pesos_constantes', 'prestamos_publicos_usd_constantes']) await sql.query(`ALTER TABLE depositos_prestamos_normalized ADD COLUMN IF NOT EXISTS ${column} DECIMAL`, []);
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_depositos_prestamos_fecha ON depositos_prestamos_raw(fecha)`, []);
}
