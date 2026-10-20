import type { TramoPick } from '@/lib/rutas/hit';
import type { ColorMode } from '@/lib/rutas/status';

export type RutasFilter = 'ninguno' | 'ruta' | 'concesionaria';
export type RutasView = { mode: ColorMode; filterBy: RutasFilter; selected: string[]; pick: TramoPick | null };

export const RUTAS_VIEW_KEY = 'monitorcillo:chart:rutas-nacionales';
const MODES: ColorMode[] = ['concesion', 'pavimento'];
const FILTERS: RutasFilter[] = ['ninguno', 'ruta', 'concesionaria'];
/** Values saved by earlier versions. */
const LEGACY_FILTERS: Record<string, RutasFilter> = { constructora: 'concesionaria' };

export function parseRutasView(raw: string | null): RutasView | null {
    if (!raw) return null;
    let value: Record<string, unknown>;
    try {
        value = JSON.parse(raw);
    } catch {
        return null;
    }
    if (!value || typeof value !== 'object') return null;
    const filterBy = LEGACY_FILTERS[value.filterBy as string] ?? value.filterBy;
    const pick = value.pick as Partial<TramoPick> | null;
    return {
        mode: MODES.includes(value.mode as ColorMode) ? (value.mode as ColorMode) : 'concesion',
        filterBy: FILTERS.includes(filterBy as RutasFilter) ? (filterBy as RutasFilter) : 'ninguno',
        selected: Array.isArray(value.selected) ? value.selected.filter((id): id is string => typeof id === 'string') : [],
        pick: pick && typeof pick === 'object' && typeof pick.code === 'string' && typeof pick.company === 'string' ? { code: pick.code, company: pick.company } : null,
    };
}
