import { describe, expect, it } from 'vitest';
import { normalizeIcg } from '../lib/normalize';

describe('normalizeIcg', () => {
    it('normalizes and sorts valid monthly observations', () => {
        expect(normalizeIcg([
            { fecha: '2024-02-01', icg: '2.57' },
            { fecha: 'invalid', icg: 3 },
            { fecha: '2024-01-01', icg: 2.61 },
        ])).toEqual([
            { fecha: 'ENE 24', iso_fecha: '2024-01-01', icg: 2.61 },
            { fecha: 'FEB 24', iso_fecha: '2024-02-01', icg: 2.57 },
        ]);
    });
});
