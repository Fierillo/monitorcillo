export * from './normalize/dates';
export * from './normalize/emision';
export * from './normalize/emae';
export * from './normalize/bma';
export * from './normalize/depositos-prestamos';
export * from './normalize/recaudacion';
export * from './normalize/poder';
export * from './normalize/deuda';
export * from './normalize/pobreza';
export * from './normalize/inflacion';
export * from './normalize/icg';
export * from './normalize/balanza';

import { fechaToISO, fechaToTimestamp, isoToFecha, isoToMonthLabel } from './normalize/dates';
import { normalizeEmision } from './normalize/emision';
import { normalizeEmae } from './normalize/emae';
import { normalizeBma } from './normalize/bma';
import { normalizeDepositosPrestamos } from './normalize/depositos-prestamos';
import { normalizeRecaudacion } from './normalize/recaudacion';
import { normalizePoderAdquisitivo } from './normalize/poder';
import { normalizeDeuda } from './normalize/deuda';
import { normalizePobreza } from './normalize/pobreza';
import { normalizeInflacion } from './normalize/inflacion';
import { normalizeIcg } from './normalize/icg';
import { normalizeBalanza } from './normalize/balanza';

const normalize = {
    isoToFecha,
    isoToMonthLabel,
    fechaToTimestamp,
    fechaToISO,
    normalizeEmision,
    normalizeEmae,
    normalizeBma,
    normalizeDepositosPrestamos,
    normalizeRecaudacion,
    normalizePoderAdquisitivo,
    normalizeDeuda,
    normalizePobreza,
    normalizeInflacion,
    normalizeIcg,
    normalizeBalanza,
};

export default normalize;
