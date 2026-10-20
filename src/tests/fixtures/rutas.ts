import type { RutaOferta } from '@/lib/rutas/ofertas';
import type { RouteSector } from '@/lib/rutas/sectors';
import type { RutaTramo } from '@/lib/rutas/status';
import tramos from '../../../scripts/data/rutas-tramos.json';
import ofertas from '../../../scripts/data/rutas-ofertas.json';
import sectores from '../../../scripts/data/rutas-sectores.json';

/** The import script's data, used as test fixtures only. */
export const RUTAS_SEED = tramos as Array<RutaTramo & { sources: string[]; sourceNote: string }>;
export const RUTAS_OFERTAS = ofertas as RutaOferta[];
export const RUTAS_SECTORES = sectores as RouteSector[];

/** Tramos as getRutasTramos returns them, with their stored km sectors. */
export const seedTramos = (): RutaTramo[] => RUTAS_SEED.map(tramo => {
    const own = RUTAS_SECTORES.filter(sector => sector.tramoId === tramo.id);
    return {
        id: tramo.id, nombre: tramo.nombre, rutas: [...tramo.rutas], km: tramo.km, concesionaria: tramo.concesionaria,
        fechaTomaPosesion: tramo.fechaTomaPosesion, obrasInicialesPct: tramo.obrasInicialesPct,
        fechaHabilitacionTarifa: tramo.fechaHabilitacionTarifa, etapa: tramo.etapa, pavimento: tramo.pavimento,
        ...(own.length ? { sectores: own } : {}),
    };
});
