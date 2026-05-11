export * from './normalize/dates';
export * from './normalize/emision';
export * from './normalize/emae';
export * from './normalize/bma';
export * from './normalize/recaudacion';
export * from './normalize/poder';
export * from './normalize/deuda';
export * from './normalize/pobreza';

import { fechaToISO, fechaToTimestamp, isoToFecha, isoToMonthLabel } from './normalize/dates';
import { normalizeEmision } from './normalize/emision';
import { normalizeEmae } from './normalize/emae';
import { normalizeBma } from './normalize/bma';
import { normalizeRecaudacion } from './normalize/recaudacion';
import { normalizePoderAdquisitivo } from './normalize/poder';
import { normalizeDeuda } from './normalize/deuda';
import { normalizePobreza } from './normalize/pobreza';

const normalize = {
    isoToFecha,
    isoToMonthLabel,
    fechaToTimestamp,
    fechaToISO,
    normalizeEmision,
    normalizeEmae,
    normalizeBma,
    normalizeRecaudacion,
    normalizePoderAdquisitivo,
    normalizeDeuda,
    normalizePobreza,
};

export default normalize;
