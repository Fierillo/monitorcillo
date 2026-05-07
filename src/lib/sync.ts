export { fetchEmisionRaw } from './sync/bcra';
export { fetchEmaeRaw } from './sync/emae';
export { fetchBmaRaw } from './sync/bma';
export { fetchPoderAdquisitivoRaw } from './sync/poder-adquisitivo';
export { fetchRecaudacionRaw } from './sync/recaudacion';
export * from './sync/tasks';

import { fetchEmisionRaw } from './sync/bcra';
import { fetchBmaRaw } from './sync/bma';
import { fetchEmaeRaw } from './sync/emae';
import { fetchPoderAdquisitivoRaw } from './sync/poder-adquisitivo';
import { fetchRecaudacionRaw } from './sync/recaudacion';
import { runSync, syncBma, syncEmae, syncEmision, syncIndicatorsCatalog, syncPoderAdquisitivo, syncRecaudacion } from './sync/tasks';

const sync = {
    fetchEmisionRaw,
    fetchEmaeRaw,
    fetchBmaRaw,
    fetchPoderAdquisitivoRaw,
    fetchRecaudacionRaw,
    syncEmision,
    syncEmae,
    syncBma,
    syncIndicatorsCatalog,
    syncRecaudacion,
    syncPoderAdquisitivo,
    runSync,
};

export default sync;
