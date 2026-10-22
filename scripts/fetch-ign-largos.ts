/** Measures each national route once from the full-resolution IGN layer and writes the seed for pnpm import-rutas. Run: pnpm fetch-ign-largos */
import { writeFile } from 'node:fs/promises';
import { routeLengths, type IgnFeature } from '../src/lib/rutas/largos';
import type { RutaLargo } from '../src/lib/rutas/status';

const FUENTE = 'IGN, capa ign:vial_nacional (WFS 2.0.0)';
const FUENTE_URL = 'https://wms.ign.gob.ar/geoserver/ows';
const QUERY = '?service=WFS&version=2.0.0&request=GetFeature&typeNames=ign:vial_nacional&outputFormat=application/json&srsName=EPSG:4326';
const SEED = 'scripts/data/rutas-largos.json';

async function main(): Promise<void> {
    const response = await fetch(FUENTE_URL + QUERY);
    if (!response.ok) throw new Error(`IGN respondió ${response.status}`);
    const { features } = await response.json() as { features: IgnFeature[] };
    const largos: RutaLargo[] = [...routeLengths(features)]
        .map(([ruta, km]) => ({ ruta, km: Math.round(km * 100) / 100, fuente: FUENTE, fuenteUrl: FUENTE_URL }))
        .sort((left, right) => left.ruta.localeCompare(right.ruta, 'es', { numeric: true }));
    await writeFile(SEED, `${JSON.stringify(largos, null, 4)}\n`);
    console.log(`${features.length} tramos IGN -> ${largos.length} rutas en ${SEED}`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
