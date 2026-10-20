/** One-off idempotent load of RIGI and non-RIGI investments into Neon (NEON_URL). Run: pnpm import-inversiones */
import { importInversiones } from '../src/lib/db/inversiones';
import type { InversionesData } from '../src/lib/investments-source';
import approvals from './data/rigi-aprobaciones.json';
import observations from './data/rigi-observaciones.json';
import nonRigi from './data/inversiones-no-rigi.json';
import { runImport } from './run-import';

runImport(() => importInversiones({ approvals, observations, nonRigi } as InversionesData), {
    rigi_aprobaciones: approvals.length,
    rigi_observaciones: observations.length,
    inversiones_no_rigi: nonRigi.length,
});
