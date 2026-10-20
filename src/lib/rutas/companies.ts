import { CONCESSION_COLORS, type ProjectedSegment, type RutaTramo } from '@/lib/rutas/status';

type ColoredSegment = Pick<ProjectedSegment, 'tramoId' | 'concesionaria' | 'color'>;
type ColoredRoute = { segments: ColoredSegment[] };
export type Company = { name: string; color: string };
export type CompanyRoutes = Company & { rutas: string[] };

export function routeCodes(tramos: RutaTramo[]): string[] {
    const codes = new Set<string>();
    for (const tramo of tramos) for (const code of tramo.rutas) codes.add(code);
    return [...codes].sort(compareRoutes);
}

export function compareRoutes(left: string, right: string): number {
    const leftRank = routeRank(left);
    const rightRank = routeRank(right);
    if (leftRank[0] !== rightRank[0]) return leftRank[0] - rightRank[0];
    if (leftRank[1] !== rightRank[1]) return leftRank[1] - rightRank[1];
    return left.localeCompare(right);
}

function routeRank(code: string): [number, number] {
    const number = Number(code.match(/\d+/)?.[0] ?? 9999);
    const kind = code.startsWith('A') ? 1 : /^\d+V/.test(code) ? 2 : 0;
    return [number, kind];
}

export function companiesOnRoute(segments: ColoredSegment[]): Company[] {
    const rows: Company[] = [];
    for (const segment of segments) {
        if (!segment.tramoId || rows.some(row => row.name === segment.concesionaria)) continue;
        rows.push({ name: segment.concesionaria, color: segment.color });
    }
    return rows;
}

export function companiesOf(tramos: RutaTramo[], routes: ColoredRoute[]): CompanyRoutes[] {
    const groups = new Map<string, { name: string; color: string; rutas: Set<string> }>();
    for (const tramo of tramos) {
        const name = tramo.concesionaria.trim() || 'Sin dato';
        const current = groups.get(name) ?? { name, color: colorOf(name, routes), rutas: new Set<string>() };
        for (const code of tramo.rutas) current.rutas.add(code);
        groups.set(name, current);
    }
    return [...groups.values()].map(company => ({ name: company.name, color: company.color, rutas: [...company.rutas].sort(compareRoutes) }));
}

function colorOf(name: string, routes: ColoredRoute[]): string {
    for (const route of routes) {
        const segment = route.segments.find(item => item.concesionaria === name);
        if (segment) return segment.color;
    }
    return CONCESSION_COLORS['sin-dato'];
}
