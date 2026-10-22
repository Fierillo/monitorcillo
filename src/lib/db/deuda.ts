import type { DeudaMaturities } from '@/lib/deuda-source';
import { sql } from './client';
import { formatDbDate, rowsOrEmpty } from './tables';

const NEXT_12_MONTHS = 'proximos-12m';

type DeudaVencimientos = {
    /** Cut-off date of the quarterly workbook the profile comes from. */
    corte: string;
    fuenteUrl: string;
    anuales: { periodo: string; capital: number; interes: number }[];
    proximos12m: { capital: number; interes: number } | null;
};

/** Writers only: readers treat a missing table as empty. */
async function ensureDeudaVencimientosTable(): Promise<void> {
    await sql.query(`CREATE TABLE IF NOT EXISTS deuda_vencimientos (
        periodo VARCHAR(16) PRIMARY KEY,
        capital_usd NUMERIC NOT NULL,
        interes_usd NUMERIC NOT NULL,
        corte DATE NOT NULL,
        fuente_url TEXT NOT NULL
    )`, []);
}

/** Each quarterly workbook supersedes the previous profile (years roll off), so the table is replaced, not merged. */
export async function replaceDeudaVencimientos(maturities: DeudaMaturities, corte: string, fuenteUrl: string): Promise<void> {
    await ensureDeudaVencimientosTable();
    const rows = [...maturities.anuales, ...(maturities.proximos12m ? [{ periodo: NEXT_12_MONTHS, ...maturities.proximos12m }] : [])];
    await sql.transaction([
        sql.query('DELETE FROM deuda_vencimientos', []),
        ...rows.map(row => sql.query(
            'INSERT INTO deuda_vencimientos (periodo, capital_usd, interes_usd, corte, fuente_url) VALUES ($1, $2, $3, $4, $5)',
            [row.periodo, row.capital_usd, row.interes_usd, corte, fuenteUrl],
        )),
    ]);
}

/** Stored maturity profile in millions of USD; null when nothing is stored. */
export async function getDeudaVencimientos(): Promise<DeudaVencimientos | null> {
    const rows = await rowsOrEmpty(sql.query('SELECT * FROM deuda_vencimientos ORDER BY periodo', []));
    if (rows.length === 0) return null;
    const amounts = (row: (typeof rows)[number]) => ({ capital: Number(row.capital_usd), interes: Number(row.interes_usd) });
    const next = rows.find(row => row.periodo === NEXT_12_MONTHS);
    return {
        corte: formatDbDate(rows[0].corte),
        fuenteUrl: String(rows[0].fuente_url),
        anuales: rows.filter(row => row !== next).map(row => ({ periodo: String(row.periodo), ...amounts(row) })),
        proximos12m: next ? amounts(next) : null,
    };
}
