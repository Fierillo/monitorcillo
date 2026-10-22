import { describe, expect, it } from 'vitest';
import { routeLengths } from '@/lib/rutas/largos';

const feature = (rtn: string, coordinates: number[][][], typ = 40) => ({ properties: { rtn, typ }, geometry: { type: 'MultiLineString', coordinates } });

describe('route lengths from IGN features', () => {
    it('sums the haversine length of every feature per normalized route code', () => {
        const degree = 111.195; // km per degree of a great circle
        const lengths = routeLengths([
            feature('0005', [[[-60, 0], [-60, 1]]]),
            feature('5', [[[-61, 0], [-61, 1], [-61, 2]]]),
            feature('A008', [[[-58, 0], [-58, 1]]]),
        ]);
        expect(lengths.get('5')).toBeCloseTo(3 * degree, 1);
        expect(lengths.get('A8')).toBeCloseTo(degree, 1);
    });
    it('counts a motorway (typ 41, one feature per carriageway) at half its length', () => {
        const lengths = routeLengths([feature('9', [[[-60, 0], [-60, 1]]], 41), feature('9', [[[-60.01, 0], [-60.01, 1]]], 41)]);
        expect(lengths.get('9')).toBeCloseTo(111.195, 1);
    });
    it('counts shared features for each route and skips unparseable codes', () => {
        const lengths = routeLengths([feature('9-34', [[[-60, 0], [-60, 1]]]), feature('', [[[-60, 0], [-60, 1]]])]);
        expect([...lengths.keys()].sort()).toEqual(['34', '9']);
    });
});
