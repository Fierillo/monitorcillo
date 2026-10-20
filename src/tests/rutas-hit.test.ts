import { describe, expect, it } from 'vitest';
import { buildHitIndex, nearestInIndex, segmentPicked, toggleSelection } from '@/lib/rutas/hit';
import type { Point } from '@/lib/crosshair';

it('parses projected path strings into polylines', () => {
    const [entry] = buildHitIndex([{ code: '9', segments: [{ concesionaria: 'A', paths: ['M0 0L10 0M5 5L5 9'] }] }]);
    expect(entry.lines).toEqual([[[0, 0], [10, 0]], [[5, 5], [5, 9]]]);
});

const routes = [
    { code: '9', segments: [
        { concesionaria: 'A', paths: ['M0 0L10 0'] },
        { concesionaria: 'B', paths: ['M10 0L20 0'] },
    ] },
    { code: '40', segments: [{ concesionaria: 'Sin dato', paths: ['M0 1L20 1'] }] },
];
const nearestTramo = (point: Point, threshold: number) => nearestInIndex(buildHitIndex(routes), point, threshold);

it('walks tramo by tramo picking the nearest segment', () => {
    expect(nearestTramo([3, -0.5], 4)).toEqual({ code: '9', segmentIndex: 0 });
    expect(nearestTramo([17, -0.5], 4)).toEqual({ code: '9', segmentIndex: 1 });
});

it('returns null beyond the threshold', () => {
    expect(nearestTramo([5, 30], 4)).toBeNull();
});

it('never lets a sin dato trace beat a concessioned tramo in range', () => {
    expect(nearestTramo([5, 0.9], 4)).toEqual({ code: '9', segmentIndex: 0 });
    expect(nearestTramo([5, 8], 7.5)).toEqual({ code: '40', segmentIndex: 0 });
});

it('matches a picked tramo by route and company', () => {
    expect(segmentPicked(null, '9', 'A')).toBe(false);
    expect(segmentPicked({ code: '9', company: 'A' }, '9', 'A')).toBe(true);
    expect(segmentPicked({ code: '9', company: 'A' }, '12', 'A')).toBe(false);
});

it('toggles a pick off when the same one is chosen again', () => {
    expect(toggleSelection(null, { code: '9', company: 'A' })).toEqual({ code: '9', company: 'A' });
    expect(toggleSelection({ code: '9', company: 'A' }, { code: '9', company: 'A' })).toBeNull();
});

describe('buildHitIndex', () => {
    it('skips segments whose bounding box is farther than the threshold', () => {
        const index = buildHitIndex([{ code: '9', segments: [{ concesionaria: 'A', paths: ['M0 0L10 0'] }, { concesionaria: 'B', paths: ['M100 100L110 100'] }] }]);
        expect(index.map(entry => entry.box)).toEqual([[0, 0, 10, 0], [100, 100, 110, 100]]);
        expect(nearestInIndex(index, [105, 102], 3)).toEqual({ code: '9', segmentIndex: 1 });
        expect(nearestInIndex(index, [50, 50], 3)).toBeNull();
    });
});
