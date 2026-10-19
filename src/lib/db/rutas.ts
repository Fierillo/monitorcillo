import type { DbRow, DbValue } from '@/types';
import type { ConcessionStage, PavementCondition, RutaTramo } from '@/lib/rutas/status';
import { CONCESSION_STAGES, PAVEMENT_CONDITIONS } from '@/lib/rutas/status';
import { seedTramos } from '@/lib/rutas/seed';
import { sql } from './client';
import { formatDbDate } from './tables';

const CREATE_RUTAS_TRAMOS = `
    CREATE TABLE IF NOT EXISTS rutas_tramos (
        id VARCHAR(64) PRIMARY KEY,
        nombre VARCHAR(255) NOT NULL,
        rutas TEXT NOT NULL,
        km DECIMAL,
        concesionaria VARCHAR(255) NOT NULL DEFAULT '',
        fecha_toma_posesion DATE,
        obras_iniciales_pct DECIMAL,
        fecha_habilitacion_tarifa DATE,
        etapa VARCHAR(32) NOT NULL,
        pavimento VARCHAR(32) NOT NULL DEFAULT 'sin-dato',
        updated_at TIMESTAMP DEFAULT NOW()
    )
`;

async function ensureRutasTable(): Promise<void> {
    await sql.query(CREATE_RUTAS_TRAMOS, []);
}

export async function getRutasTramos(): Promise<RutaTramo[]> {
    await ensureRutasTable();
    const rows = await sql.query('SELECT * FROM rutas_tramos ORDER BY nombre', []) as DbRow[];
    if (rows.length === 0) return seedTramos();
    return rows.map(mapRutaTramo);
}

export async function replaceRutasTramos(tramos: RutaTramo[]): Promise<void> {
    await ensureRutasTable();
    const inserts = tramos.map(tramo => sql.query(
        `INSERT INTO rutas_tramos (
            id, nombre, rutas, km, concesionaria, fecha_toma_posesion,
            obras_iniciales_pct, fecha_habilitacion_tarifa, etapa, pavimento, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
            tramo.id,
            tramo.nombre,
            tramo.rutas.join(','),
            tramo.km,
            tramo.concesionaria,
            tramo.fechaTomaPosesion,
            tramo.obrasInicialesPct,
            tramo.fechaHabilitacionTarifa,
            tramo.etapa,
            tramo.pavimento,
        ],
    ));
    await sql.transaction([
        sql.query('DELETE FROM rutas_tramos', []),
        ...inserts,
    ]);
}

function mapRutaTramo(row: DbRow): RutaTramo {
    const etapa = String(row.etapa ?? '');
    const pavimento = String(row.pavimento ?? '');
    if (!CONCESSION_STAGES.includes(etapa as ConcessionStage)) {
        throw new Error(`El tramo ${String(row.nombre)} tiene la etapa "${etapa}", que no es válida. Corregila en el administrador: concesionado, en-licitacion o sin-concesionar.`);
    }
    if (!PAVEMENT_CONDITIONS.includes(pavimento as PavementCondition)) {
        throw new Error(`El tramo ${String(row.nombre)} tiene el pavimento "${pavimento}", que no es válido. Corregilo en el administrador: bueno, regular, malo o sin-dato.`);
    }
    return {
        id: String(row.id),
        nombre: String(row.nombre),
        rutas: String(row.rutas ?? '').split(',').map(code => code.trim()).filter(Boolean),
        km: row.km == null ? null : Number(row.km),
        concesionaria: String(row.concesionaria ?? ''),
        fechaTomaPosesion: optionalDate(row.fecha_toma_posesion),
        obrasInicialesPct: row.obras_iniciales_pct == null ? null : Number(row.obras_iniciales_pct),
        fechaHabilitacionTarifa: optionalDate(row.fecha_habilitacion_tarifa),
        etapa: etapa as ConcessionStage,
        pavimento: pavimento as PavementCondition,
    };
}

function optionalDate(value: DbValue | undefined): string | null {
    if (value == null || value === '') return null;
    return formatDbDate(value);
}
