import type { Point } from '@/lib/crosshair';

export type TramoHit = { code: string; segmentIndex: number };
export type TramoPick = { code: string; company: string };
type HitRoute = { code: string; segments: { concesionaria: string; paths: string[] }[] };

function parsePathPoints(d: string): Point[][] {
    const lines: Point[][] = [];
    for (const match of d.matchAll(/([ML])\s*(-?[\d.]+)[\s,]+(-?[\d.]+)/g)) {
        const point: Point = [Number(match[2]), Number(match[3])];
        if (match[1] === 'M' || lines.length === 0) lines.push([point]);
        else lines[lines.length - 1].push(point);
    }
    return lines;
}

function distanceToSegment([px, py]: Point, [ax, ay]: Point, [bx, by]: Point): number {
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function distanceToLines(point: Point, lines: Point[][]): number {
    let best = Infinity;
    for (const line of lines) {
        if (line.length === 1) best = Math.min(best, Math.hypot(point[0] - line[0][0], point[1] - line[0][1]));
        for (let i = 1; i < line.length; i++) best = Math.min(best, distanceToSegment(point, line[i - 1], line[i]));
    }
    return best;
}

type HitEntry = { hit: TramoHit; missing: boolean; lines: Point[][]; box: [number, number, number, number] };

/** Parsed points and bounding box per segment, built once per projection. */
export function buildHitIndex(routes: HitRoute[]): HitEntry[] {
    return routes.flatMap(route => route.segments.map((segment, segmentIndex) => {
        const lines = segment.paths.flatMap(parsePathPoints);
        const xs = lines.flat().map(point => point[0]);
        const ys = lines.flat().map(point => point[1]);
        return {
            hit: { code: route.code, segmentIndex },
            missing: segment.concesionaria === 'Sin dato',
            lines,
            box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number],
        };
    }));
}

/** Nearest tramo within `threshold`; concessioned tramos always beat "Sin dato" traces. */
export function nearestInIndex(index: HitEntry[], [px, py]: Point, threshold: number): TramoHit | null {
    type Best = { hit: TramoHit; distance: number } | null;
    let known: Best = null;
    let missing: Best = null;
    for (const entry of index) {
        const [minX, minY, maxX, maxY] = entry.box;
        if (px < minX - threshold || px > maxX + threshold || py < minY - threshold || py > maxY + threshold) continue;
        const distance = distanceToLines([px, py], entry.lines);
        if (distance > threshold) continue;
        const next = { hit: entry.hit, distance };
        if (entry.missing) {
            if (!missing || distance < missing.distance) missing = next;
        } else if (!known || distance < known.distance) known = next;
    }
    return (known ?? missing)?.hit ?? null;
}

export function segmentPicked(pick: TramoPick | null, code: string, company: string): boolean {
    return pick != null && pick.code === code && pick.company === company;
}

export function toggleSelection(current: TramoPick | null, next: TramoPick): TramoPick | null {
    return segmentPicked(current, next.code, next.company) ? null : next;
}
