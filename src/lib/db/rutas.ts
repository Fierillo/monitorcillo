import type { DbRow, DbValue } from '@/types';
import type { ConcessionStage, PavementCondition, RutaLargo, RutaTramo, RutasRed } from '@/lib/rutas/status';
import { CONCESSION_STAGES, PAVEMENT_CONDITIONS } from '@/lib/rutas/status';
import type { RutaOferta } from '@/lib/rutas/ofertas';
import type { RouteSector } from '@/lib/rutas/sectors';
import { sql } from './client';
import { formatDbDate, rowsOrEmpty } from './tables';

const CREATE_RUTAS_TABLES = [
    `CREATE TABLE IF NOT EXISTS rutas_tramos (
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
        fuentes TEXT,
        nota_fuente TEXT,
        updated_at TIMESTAMP DEFAULT NOW()
    )`,
    // Tables created before fuentes/nota_fuente were part of the schema.
    'ALTER TABLE rutas_tramos ADD COLUMN IF NOT EXISTS fuentes TEXT, ADD COLUMN IF NOT EXISTS nota_fuente TEXT',
    `CREATE TABLE IF NOT EXISTS rutas_ofertas (
        id SERIAL PRIMARY KEY,
        tramo_id VARCHAR(64) NOT NULL,
        concesionaria VARCHAR(255) NOT NULL,
        tarifa NUMERIC NOT NULL,
        gano BOOLEAN NOT NULL DEFAULT FALSE,
        resolucion VARCHAR(64) NOT NULL,
        fuente_url TEXT NOT NULL
    )`,
    'CREATE UNIQUE INDEX IF NOT EXISTS rutas_ofertas_key ON rutas_ofertas (tramo_id, concesionaria, resolucion)',
    `CREATE TABLE IF NOT EXISTS rutas_sectores (
        tramo_id VARCHAR(64) NOT NULL,
        ruta VARCHAR(16) NOT NULL,
        desde_km NUMERIC NOT NULL,
        hasta_km NUMERIC NOT NULL,
        km NUMERIC NOT NULL,
        origin_km NUMERIC,
        PRIMARY KEY (tramo_id, ruta, desde_km)
    )`,
    `CREATE TABLE IF NOT EXISTS rutas_red (
        id VARCHAR(32) PRIMARY KEY,
        km NUMERIC NOT NULL,
        fuente TEXT NOT NULL,
        fuente_url TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS rutas_largo (
        ruta VARCHAR(16) PRIMARY KEY,
        km NUMERIC NOT NULL,
        fuente TEXT NOT NULL,
        fuente_url TEXT NOT NULL,
        actualizado TIMESTAMP DEFAULT NOW()
    )`,
];

const RED_ID = 'nacional';

/** Writers only: readers treat a missing table as empty. */
async function ensureRutasTables(): Promise<void> {
    for (const statement of CREATE_RUTAS_TABLES) await sql.query(statement, []);
}

export type RutaImport = RutaTramo & { sources: string[]; sourceNote: string };

const TRAMO_COLUMNS = ['id', 'nombre', 'rutas', 'km', 'concesionaria', 'fecha_toma_posesion', 'obras_iniciales_pct', 'fecha_habilitacion_tarifa', 'etapa', 'pavimento'];

/** Upsert by id; `sources` also writes fuentes/nota_fuente (import), otherwise they are left untouched (admin). */
function upsertTramo(tramo: RutaTramo, sources?: { sources: string[]; sourceNote: string }) {
    const columns = sources ? [...TRAMO_COLUMNS, 'fuentes', 'nota_fuente'] : TRAMO_COLUMNS;
    const values: unknown[] = [tramo.id, tramo.nombre, tramo.rutas.join(','), tramo.km, tramo.concesionaria, tramo.fechaTomaPosesion,
        tramo.obrasInicialesPct, tramo.fechaHabilitacionTarifa, tramo.etapa, tramo.pavimento];
    if (sources) values.push(sources.sources.join('\n'), sources.sourceNote);
    const updates = columns.slice(1).map(column => `${column} = EXCLUDED.${column}`).join(', ');
    return sql.query(
        `INSERT INTO rutas_tramos (${columns.join(', ')}, updated_at) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')}, NOW())
        ON CONFLICT (id) DO UPDATE SET ${updates}, updated_at = NOW()`,
        values,
    );
}

/** Idempotent load used by scripts/import-rutas.ts: upserts tramos by id, offers by (tramo, company, resolution), the network total and route lengths by route. */
export async function importRutas(tramos: RutaImport[], ofertas: RutaOferta[], sectores: RouteSector[], red?: RutasRed, largos: RutaLargo[] = []): Promise<void> {
    await ensureRutasTables();
    await sql.transaction([
        ...tramos.map(tramo => upsertTramo(tramo, tramo)),
        ...ofertas.map(oferta => sql.query(
            `INSERT INTO rutas_ofertas (tramo_id, concesionaria, tarifa, gano, resolucion, fuente_url)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (tramo_id, concesionaria, resolucion) DO UPDATE SET
                tarifa = EXCLUDED.tarifa, gano = EXCLUDED.gano, fuente_url = EXCLUDED.fuente_url`,
            [oferta.tramoId, oferta.concesionaria, oferta.tarifa, oferta.gano, oferta.resolucion, oferta.fuenteUrl],
        )),
        ...sectores.map(sector => sql.query(
            `INSERT INTO rutas_sectores (tramo_id, ruta, desde_km, hasta_km, km, origin_km)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (tramo_id, ruta, desde_km) DO UPDATE SET
                hasta_km = EXCLUDED.hasta_km, km = EXCLUDED.km, origin_km = EXCLUDED.origin_km`,
            [sector.tramoId, sector.ruta, sector.desdeKm, sector.hastaKm, sector.km, sector.originKm ?? null],
        )),
        ...(red ? [sql.query(
            `INSERT INTO rutas_red (id, km, fuente, fuente_url) VALUES ($1, $2, $3, $4)
            ON CONFLICT (id) DO UPDATE SET km = EXCLUDED.km, fuente = EXCLUDED.fuente, fuente_url = EXCLUDED.fuente_url`,
            [RED_ID, red.km, red.fuente, red.fuenteUrl],
        )] : []),
        ...largos.map(largo => sql.query(
            `INSERT INTO rutas_largo (ruta, km, fuente, fuente_url, actualizado) VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (ruta) DO UPDATE SET km = EXCLUDED.km, fuente = EXCLUDED.fuente, fuente_url = EXCLUDED.fuente_url, actualizado = NOW()`,
            [largo.ruta, largo.km, largo.fuente, largo.fuenteUrl],
        )),
    ]);
}

/** Stored length per national route. */
export async function getRutasLargos(): Promise<RutaLargo[]> {
    const rows = await rowsOrEmpty(sql.query('SELECT * FROM rutas_largo ORDER BY ruta', []));
    return rows.map(row => ({ ruta: String(row.ruta), km: Number(row.km), fuente: String(row.fuente), fuenteUrl: String(row.fuente_url) }));
}

/** National network total with its source; null when it is not stored. */
export async function getRutasRed(): Promise<RutasRed | null> {
    const [row] = await rowsOrEmpty(sql.query('SELECT * FROM rutas_red WHERE id = $1', [RED_ID]));
    return row ? { km: Number(row.km), fuente: String(row.fuente), fuenteUrl: String(row.fuente_url) } : null;
}

/** Offers per tramo as stored in rutas_ofertas. */
export async function getRutasOfertas(): Promise<RutaOferta[]> {
    const rows = await rowsOrEmpty(sql.query('SELECT * FROM rutas_ofertas ORDER BY tramo_id, tarifa', []));
    return rows.map(row => ({
        tramoId: String(row.tramo_id),
        concesionaria: String(row.concesionaria),
        tarifa: Number(row.tarifa),
        gano: row.gano === true,
        resolucion: String(row.resolucion),
        fuenteUrl: String(row.fuente_url),
    }));
}

export async function getRutasTramos(): Promise<RutaTramo[]> {
    const [rows, sectorRows] = await Promise.all([
        rowsOrEmpty(sql.query('SELECT * FROM rutas_tramos ORDER BY nombre', [])),
        rowsOrEmpty(sql.query('SELECT * FROM rutas_sectores ORDER BY tramo_id, ruta, desde_km', [])),
    ]);
    const sectores = sectorRows.map(mapSector);
    return rows.map(row => {
        const tramo = mapRutaTramo(row);
        const own = sectores.filter(sector => sector.tramoId === tramo.id);
        return own.length ? { ...tramo, sectores: own } : tramo;
    });
}

/** Admin save: the list becomes the table. Removed tramos take their sectors and offers with them. */
export async function replaceRutasTramos(tramos: RutaTramo[]): Promise<void> {
    await ensureRutasTables();
    const ids = tramos.map(tramo => tramo.id);
    await sql.transaction([
        sql.query('DELETE FROM rutas_sectores WHERE NOT (tramo_id = ANY($1))', [ids]),
        sql.query('DELETE FROM rutas_ofertas WHERE NOT (tramo_id = ANY($1))', [ids]),
        sql.query('DELETE FROM rutas_tramos WHERE NOT (id = ANY($1))', [ids]),
        ...tramos.map(tramo => upsertTramo(tramo)),
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

function mapSector(row: DbRow): RouteSector {
    return {
        tramoId: String(row.tramo_id),
        ruta: String(row.ruta),
        desdeKm: Number(row.desde_km),
        hastaKm: Number(row.hasta_km),
        km: Number(row.km),
        ...(row.origin_km == null ? {} : { originKm: Number(row.origin_km) }),
    };
}

function optionalDate(value: DbValue | undefined): string | null {
    if (value == null || value === '') return null;
    return formatDbDate(value);
}
