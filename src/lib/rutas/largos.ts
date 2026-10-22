import { normalizeRouteCode } from '@/lib/rutas/status';

/** WFS line feature as served by the IGN `ign:vial_nacional` layer (GeoJSON, EPSG:4326). */
export type IgnFeature = { properties: { rtn: string | null; typ: number | null }; geometry: { type: string; coordinates: number[][][] | number[][] } | null };

/** IGN road type for motorways: each carriageway is its own line, so the road is half the drawn length. */
const MOTORWAY_TYP = 41;

const EARTH_RADIUS_KM = 6371.0088;

/** Geodesic (haversine) length of [lon, lat] lines. */
function linesKm(lines: number[][][]): number {
    const radians = (degrees: number) => degrees * Math.PI / 180;
    let total = 0;
    for (const line of lines) {
        for (let i = 1; i < line.length; i++) {
            const [lon1, lat1] = line[i - 1].map(radians);
            const [lon2, lat2] = line[i].map(radians);
            const h = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
            total += 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
        }
    }
    return total;
}

/** Km per route code; motorways count once, not per carriageway; a feature shared by several routes ("9-34") counts for each of them. */
export function routeLengths(features: IgnFeature[]): Map<string, number> {
    const lengths = new Map<string, number>();
    for (const { properties, geometry } of features) {
        if (!geometry) continue;
        const lines = geometry.type === 'LineString' ? [geometry.coordinates as number[][]] : geometry.coordinates as number[][][];
        const km = linesKm(lines) / (properties.typ === MOTORWAY_TYP ? 2 : 1);
        for (const code of new Set((properties.rtn ?? '').split('-').map(normalizeRouteCode))) {
            if (code) lengths.set(code, (lengths.get(code) ?? 0) + km);
        }
    }
    return lengths;
}
