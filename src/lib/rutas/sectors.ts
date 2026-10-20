export type SectorRange = {
    ruta: string;
    desdeKm: number;
    hastaKm: number;
    originKm?: number;
    km?: number;
};

export type RouteSector = SectorRange & {
    tramoId: string;
    km: number;
};

export const COMPANY_PALETTE = [
    '#FF595E',
    '#FF924C',
    '#FFCA3A',
    '#8AC926',
    '#2EC4B6',
    '#1982C4',
    '#6A4C93',
    '#FF70A6',
    '#00BBF9',
    '#9B5DE5',
    '#F15BB5',
    '#00F5D4',
    '#C77DFF',
    '#FF9F1C',
    '#80FFDB',
];

export function companyColors(names: string[]): Map<string, string> {
    const colors = new Map<string, string>();
    for (const name of names) {
        const key = name.trim() || 'Sin dato';
        if (colors.has(key)) continue;
        colors.set(key, COMPANY_PALETTE[colors.size % COMPANY_PALETTE.length]);
    }
    return colors;
}

/** The tramo's stored km sectors on `ruta`; none when the base has no sectors for it. */
export function sectorsForTramo(ruta: string, own: SectorRange[] = []): SectorRange[] {
    return own.filter(sectorRange => sectorRange.ruta === ruta);
}

export function sliceRouteByKm(lines: number[][][], routeKm: number, desdeKm: number, hastaKm: number, originKm = 0): number[][][] {
    const span = routeKm - originKm;
    if (!Number.isFinite(span) || span <= 0) return lines;
    const start = clamp((desdeKm - originKm) / span);
    const end = clamp((hastaKm - originKm) / span);
    if (end - start < 0.000001) return [];
    if (start <= 0 && end >= 1) return lines;
    const measured = lines.map(measureLine);
    const total = measured.reduce((sum, line) => sum + line.distance, 0);
    if (total <= 0) return [];
    const sliced: number[][][] = [];
    let cursor = 0;
    for (const line of measured) {
        const piece = clipLine(line.points, line.cum, start * total - cursor, end * total - cursor);
        cursor += line.distance;
        if (piece.length >= 2) sliced.push(piece);
    }
    return sliced;
}

function clamp(value: number): number {
    return Math.min(1, Math.max(0, value));
}

function measureLine(points: number[][]): { points: number[][]; cum: number[]; distance: number } {
    const cum = [0];
    for (let index = 1; index < points.length; index += 1) {
        cum.push(cum[index - 1] + haversineKm(points[index - 1], points[index]));
    }
    return { points, cum, distance: cum[cum.length - 1] ?? 0 };
}

function clipLine(points: number[][], cum: number[], from: number, to: number): number[][] {
    const distance = cum[cum.length - 1] ?? 0;
    if (to <= 0 || from >= distance) return [];
    const start = Math.max(0, from);
    const end = Math.min(distance, to);
    const clipped: number[][] = [];
    for (let index = 1; index < points.length; index += 1) {
        const fromKm = cum[index - 1];
        const toKm = cum[index];
        if (toKm < start || fromKm > end) continue;
        const span = toKm - fromKm || 1e-9;
        if (fromKm < start) pushPoint(clipped, interpolate(points[index - 1], points[index], (start - fromKm) / span));
        else pushPoint(clipped, points[index - 1]);
        if (toKm > end) pushPoint(clipped, interpolate(points[index - 1], points[index], (end - fromKm) / span));
        else pushPoint(clipped, points[index]);
    }
    return clipped;
}

function pushPoint(points: number[][], point: number[]) {
    const previous = points[points.length - 1];
    if (previous && previous[0] === point[0] && previous[1] === point[1]) return;
    points.push(point);
}

function interpolate(start: number[], end: number[], ratio: number): number[] {
    return [start[0] + (end[0] - start[0]) * ratio, start[1] + (end[1] - start[1]) * ratio];
}

function haversineKm(start: number[], end: number[]): number {
    const toRad = Math.PI / 180;
    const dLat = (end[1] - start[1]) * toRad;
    const dLon = (end[0] - start[0]) * toRad;
    const lat1 = start[1] * toRad;
    const lat2 = end[1] * toRad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

const GOLDEN_ANGLE = 137.508;

export function routeColors(codes: string[]): Map<string, string> {
    const colors = new Map<string, string>();
    for (const code of codes) {
        if (colors.has(code)) continue;
        const index = colors.size;
        const hue = ((index * GOLDEN_ANGLE) % 360).toFixed(1);
        const lightness = [58, 70, 48][index % 3];
        colors.set(code, `hsl(${hue}, 85%, ${lightness}%)`);
    }
    return colors;
}
