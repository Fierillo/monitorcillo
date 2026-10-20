import type { InversionesData } from '@/lib/investments-source';
import approvals from '../../../scripts/data/rigi-aprobaciones.json';
import observations from '../../../scripts/data/rigi-observaciones.json';
import nonRigi from '../../../scripts/data/inversiones-no-rigi.json';

/** The import script's data, used as test fixtures only. */
export const INVERSIONES = { approvals, observations, nonRigi } as InversionesData;
