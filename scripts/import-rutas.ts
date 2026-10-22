/** One-off idempotent load of the official tramos, offers, km sectors and national network total and route lengths into Neon (NEON_URL). Run: pnpm import-rutas */
import { importRutas, type RutaImport } from '../src/lib/db/rutas';
import type { RutaOferta } from '../src/lib/rutas/ofertas';
import type { RouteSector } from '../src/lib/rutas/sectors';
import tramos from './data/rutas-tramos.json';
import ofertas from './data/rutas-ofertas.json';
import sectores from './data/rutas-sectores.json';
import red from './data/rutas-red.json';
import largos from './data/rutas-largos.json';
import { runImport } from './run-import';

runImport(() => importRutas(tramos as RutaImport[], ofertas as RutaOferta[], sectores as RouteSector[], red, largos), {
    rutas_tramos: tramos.length,
    rutas_ofertas: ofertas.length,
    rutas_sectores: sectores.length,
    rutas_red: 1,
    rutas_largo: largos.length,
});
