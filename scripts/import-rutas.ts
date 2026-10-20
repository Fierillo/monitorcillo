/** One-off idempotent load of the official tramos, offers and km sectors into Neon (NEON_URL). Run: pnpm import-rutas */
import { importRutas, type RutaImport } from '../src/lib/db/rutas';
import type { RutaOferta } from '../src/lib/rutas/ofertas';
import type { RouteSector } from '../src/lib/rutas/sectors';
import tramos from './data/rutas-tramos.json';
import ofertas from './data/rutas-ofertas.json';
import sectores from './data/rutas-sectores.json';
import { runImport } from './run-import';

runImport(() => importRutas(tramos as RutaImport[], ofertas as RutaOferta[], sectores as RouteSector[]), {
    rutas_tramos: tramos.length,
    rutas_ofertas: ofertas.length,
    rutas_sectores: sectores.length,
});
