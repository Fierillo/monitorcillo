import type { DbValue } from '@/types';
import type { InversionesData, NonRigiInvestment } from '@/lib/investments-source';
import { sql } from './client';
import { formatDbDate, rowsOrEmpty } from './tables';

const CREATE_TABLES = [
    `CREATE TABLE IF NOT EXISTS rigi_aprobaciones (
        mes DATE PRIMARY KEY,
        monto_usd_millones NUMERIC NOT NULL,
        nota TEXT
    )`,
    // Tables created before the note column existed.
    'ALTER TABLE rigi_aprobaciones ADD COLUMN IF NOT EXISTS nota TEXT',
    `CREATE TABLE IF NOT EXISTS rigi_observaciones (
        fecha DATE PRIMARY KEY,
        proyectos_aprobados INTEGER NOT NULL,
        monto_aprobado_usd_millones NUMERIC NOT NULL,
        proyectos_evaluacion INTEGER,
        monto_evaluacion_usd_millones NUMERIC NOT NULL,
        fuente_url TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS inversiones_no_rigi (
        id VARCHAR(64) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        empresa VARCHAR(255) NOT NULL,
        sector VARCHAR(64) NOT NULL,
        monto_usd_millones NUMERIC NOT NULL,
        anuncio_fecha DATE NOT NULL,
        anuncio_url TEXT NOT NULL,
        confirmacion_fecha DATE,
        confirmacion_url TEXT,
        confirmacion_evidencia TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS inversiones_no_rigi_revisiones (
        inversion_id VARCHAR(64) NOT NULL,
        fecha DATE NOT NULL,
        monto_usd_millones NUMERIC NOT NULL,
        fuente_url TEXT NOT NULL,
        PRIMARY KEY (inversion_id, fecha)
    )`,
];

/** Import only: readers treat a missing table as empty. */
async function ensureInversionesTables(): Promise<void> {
    for (const statement of CREATE_TABLES) await sql.query(statement, []);
}

/** Investments as stored in Neon; empty arrays when nothing was imported. */
export async function getInversiones(): Promise<InversionesData> {
    const [approvals, observations, investments, revisions] = await Promise.all([
        rowsOrEmpty(sql.query('SELECT * FROM rigi_aprobaciones ORDER BY mes', [])),
        rowsOrEmpty(sql.query('SELECT * FROM rigi_observaciones ORDER BY fecha', [])),
        rowsOrEmpty(sql.query('SELECT * FROM inversiones_no_rigi ORDER BY anuncio_fecha, id', [])),
        rowsOrEmpty(sql.query('SELECT * FROM inversiones_no_rigi_revisiones ORDER BY inversion_id, fecha', [])),
    ]);
    return {
        approvals: approvals.map(row => ({
            month: date(row.mes),
            amountUsdMillions: Number(row.monto_usd_millones),
            ...(row.nota == null ? {} : { note: String(row.nota) }),
        })),
        observations: observations.map(row => ({
            observedAt: date(row.fecha),
            approvedProjects: Number(row.proyectos_aprobados),
            approvedAmountUsdMillions: Number(row.monto_aprobado_usd_millones),
            evaluationProjects: row.proyectos_evaluacion == null ? null : Number(row.proyectos_evaluacion),
            evaluationAmountUsdMillions: Number(row.monto_evaluacion_usd_millones),
            source: String(row.fuente_url),
        })),
        nonRigi: investments.map(row => {
            const own = revisions.filter(revision => revision.inversion_id === row.id)
                .map(revision => ({ date: date(revision.fecha), amountUsdMillions: Number(revision.monto_usd_millones), url: String(revision.fuente_url) }));
            const investment: NonRigiInvestment = {
                id: String(row.id),
                name: String(row.nombre),
                company: String(row.empresa),
                sector: String(row.sector),
                amountUsdMillions: Number(row.monto_usd_millones),
                announcement: { date: date(row.anuncio_fecha), url: String(row.anuncio_url) },
                confirmation: row.confirmacion_fecha == null ? null : { date: date(row.confirmacion_fecha), url: String(row.confirmacion_url), evidence: String(row.confirmacion_evidencia ?? '') },
            };
            return own.length ? { ...investment, revisions: own } : investment;
        }),
    };
}

/** Idempotent load used by scripts/import-inversiones.ts: upserts every row by its natural key. */
export async function importInversiones({ approvals, observations, nonRigi }: InversionesData): Promise<void> {
    await ensureInversionesTables();
    await sql.transaction([
        ...approvals.map(item => sql.query(
            `INSERT INTO rigi_aprobaciones (mes, monto_usd_millones, nota) VALUES ($1, $2, $3)
            ON CONFLICT (mes) DO UPDATE SET monto_usd_millones = EXCLUDED.monto_usd_millones, nota = EXCLUDED.nota`,
            [item.month, item.amountUsdMillions, item.note ?? null],
        )),
        ...observations.map(item => sql.query(
            `INSERT INTO rigi_observaciones (fecha, proyectos_aprobados, monto_aprobado_usd_millones, proyectos_evaluacion, monto_evaluacion_usd_millones, fuente_url)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (fecha) DO UPDATE SET
                proyectos_aprobados = EXCLUDED.proyectos_aprobados, monto_aprobado_usd_millones = EXCLUDED.monto_aprobado_usd_millones,
                proyectos_evaluacion = EXCLUDED.proyectos_evaluacion, monto_evaluacion_usd_millones = EXCLUDED.monto_evaluacion_usd_millones,
                fuente_url = EXCLUDED.fuente_url`,
            [item.observedAt, item.approvedProjects, item.approvedAmountUsdMillions, item.evaluationProjects, item.evaluationAmountUsdMillions, item.source],
        )),
        ...nonRigi.map(item => sql.query(
            `INSERT INTO inversiones_no_rigi (id, nombre, empresa, sector, monto_usd_millones, anuncio_fecha, anuncio_url, confirmacion_fecha, confirmacion_url, confirmacion_evidencia)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO UPDATE SET
                nombre = EXCLUDED.nombre, empresa = EXCLUDED.empresa, sector = EXCLUDED.sector, monto_usd_millones = EXCLUDED.monto_usd_millones,
                anuncio_fecha = EXCLUDED.anuncio_fecha, anuncio_url = EXCLUDED.anuncio_url, confirmacion_fecha = EXCLUDED.confirmacion_fecha,
                confirmacion_url = EXCLUDED.confirmacion_url, confirmacion_evidencia = EXCLUDED.confirmacion_evidencia`,
            [item.id, item.name, item.company, item.sector, item.amountUsdMillions, item.announcement.date, item.announcement.url,
                item.confirmation?.date ?? null, item.confirmation?.url ?? null, item.confirmation?.evidence ?? null],
        )),
        ...nonRigi.flatMap(item => (item.revisions ?? []).map(revision => sql.query(
            `INSERT INTO inversiones_no_rigi_revisiones (inversion_id, fecha, monto_usd_millones, fuente_url) VALUES ($1, $2, $3, $4)
            ON CONFLICT (inversion_id, fecha) DO UPDATE SET monto_usd_millones = EXCLUDED.monto_usd_millones, fuente_url = EXCLUDED.fuente_url`,
            [item.id, revision.date, revision.amountUsdMillions, revision.url],
        ))),
    ]);
}

function date(value: DbValue | undefined): string {
    return formatDbDate(value ?? null);
}
