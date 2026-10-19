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

const sector = (tramoId: string, ruta: string, desdeKm: number, hastaKm: number, km: number, originKm?: number): RouteSector => ({
    tramoId,
    ruta,
    desdeKm,
    hastaKm,
    km,
    ...(originKm === undefined ? {} : { originKm }),
});

export const ROUTE_SECTORS: RouteSector[] = [
    sector('oriental', '12', 0, 144.46, 144.46),
    sector('oriental', '14', 0, 497.33, 497.33),
    sector('oriental', '135', 0, 14.58, 12.94),
    sector('oriental', 'A15', 0, 14.73, 14.67),
    sector('oriental', '117', 0, 12.88, 12.88),
    sector('conexion', '174', 0, 59.43, 59.34),
    sector('sur-atlantico-acceso-sur', '3', 46.3, 661.82, 615.52),
    sector('sur-atlantico-acceso-sur', '205', 44.3, 317.41, 255.03),
    sector('sur-atlantico-acceso-sur', '226', 0, 404.32, 404.32),
    sector('pampa', '5', 65, 606.65, 546.65, 65),
    sector('mediterraneo', '7', 54, 644.74, 590.74),
    sector('mediterraneo', '35', 650.6, 709.55, 81.58),
    sector('portuario-sur', '9', 64, 228.19, 164.19),
    sector('portuario-sur', '188', 0, 482.5, 472.56),
    sector('portuario-norte', '9', 228.19, 278.52, 50.33),
    sector('portuario-norte', '33', 323.9, 771.85, 447.95),
    sector('portuario-norte', 'A8', 0, 29.76, 29.76),
    sector('puntano', '8', 23.3, 726.86, 665.96),
    sector('puntano', '36', 0, 10.57, 10.57),
    sector('puntano', 'A5', 0, 11.4, 11.42),
    sector('puntano', '193', 0, 35.32, 32.05),
    sector('centro', '9', 278.52, 641.68, 363.16),
    sector('centro', '19', 0, 130.08, 130.08),
    sector('centro', '34', 0, 188.68, 188.68),
    sector('mesopotamico', '18', 0, 226.72, 226.72),
    sector('mesopotamico', '12', 358.5, 407.89, 49.39),
    sector('centro-norte', '34', 188.68, 725.11, 536.43),
    sector('noroeste', '9', 1139.68, 1593.25, 453.57),
    sector('noroeste', '9', 1691.7, 1710.22, 18.52),
    sector('noroeste', '34', 1130, 1196.51, 66.51),
    sector('noroeste', '66', 0, 37.97, 37.94),
    sector('noroeste', '1V66', 0, 13.23, 13.23),
    sector('noroeste', 'A16', 0, 6.75, 6.75),
    sector('litoral', '12', 871.15, 1206.69, 335.54),
    sector('litoral', '16', 0, 211.2, 211.2),
    sector('noreste', '12', 1206.69, 1336, 129.31),
    sector('noreste', '12', 1349.2, 1641.76, 292.32),
    sector('noreste', '105', 0, 34.8, 34.59),
    sector('chaco-santa-fe', '11', 510.62, 1007.8, 497.18, 322),
    sector('cuyo', '7', 865.49, 1236.86, 371.37),
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

export function sectorsForTramo(tramoId: string, ruta: string, own?: SectorRange[]): SectorRange[] {
    if (own) return own.filter(sectorRange => sectorRange.ruta === ruta);
    return ROUTE_SECTORS.filter(sectorRange => sectorRange.tramoId === tramoId && sectorRange.ruta === ruta);
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
