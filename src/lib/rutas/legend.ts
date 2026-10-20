import type { CompanyRoutes } from '@/lib/rutas/companies';
import type { RutasFilter } from '@/lib/rutas/persist';
import { CONCESSION_COLORS, CONCESSION_LABELS, CONCESSION_STAGES, PAVEMENT_COLORS, PAVEMENT_CONDITIONS, PAVEMENT_LABELS, type ColorMode } from '@/lib/rutas/status';

export type LegendItem = { key: string; color: string; label: string };

export function legendFor(filterBy: RutasFilter, mode: ColorMode, selected: Set<string>, routeCodes: string[], companies: CompanyRoutes[], routeColors: Map<string, string>): LegendItem[] {
    if (filterBy === 'ninguno') {
        if (mode === 'pavimento') return PAVEMENT_CONDITIONS.map(status => ({ key: status, color: PAVEMENT_COLORS[status], label: PAVEMENT_LABELS[status] }));
        return ([...CONCESSION_STAGES, 'sin-dato'] as const).map(stage => ({ key: stage, color: CONCESSION_COLORS[stage], label: CONCESSION_LABELS[stage] }));
    }
    if (filterBy === 'ruta') {
        return routeCodes.filter(code => selected.has(code)).map(code => ({ key: code, color: routeColors.get(code) ?? CONCESSION_COLORS['sin-dato'], label: `RN ${code}` }));
    }
    const routesOfCompanies = companies.filter(company => selected.has(company.name)).flatMap(company => company.rutas.map(code => ({
        key: `${company.name}-${code}`,
        color: company.color,
        label: `RN ${code}`,
    })));
    return [...routesOfCompanies, { key: 'sin-dato', color: CONCESSION_COLORS['sin-dato'], label: 'Sin dato' }];
}
