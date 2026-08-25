import { describe, expect, it } from 'vitest';
import { calculateTooltipVerticalPosition, collectAxisExtentValues } from '../components/chart/utils';

describe('collectAxisExtentValues', () => {
    it('uses positive and negative stack totals for mixed-sign columns', () => {
        expect(collectAxisExtentValues(
            [{ fecha: 'ENE 26', exportaciones: 6500, importaciones: -5800 }],
            [
                { key: 'exportaciones', name: 'Exportaciones', color: '#22C55E', type: 'bar', stackId: 'balanza' },
                { key: 'importaciones', name: 'Importaciones', color: '#EF4444', type: 'bar', stackId: 'balanza' },
            ],
        )).toEqual([6500, -5800]);
    });
});

describe('calculateTooltipVerticalPosition', () => {
    it('moves the tooltip away from data grouped at either vertical edge', () => {
        expect(calculateTooltipVerticalPosition([0.8, 0.9], 100, 500, 120)).toBe(110);
        expect(calculateTooltipVerticalPosition([0.1, 0.3], 400, 500, 120)).toBe(220);
    });

    it('clears the farthest active series before rendering the tooltip', () => {
        expect(calculateTooltipVerticalPosition([0.7, 0.85], 20, 500, 100)).toBeCloseTo(160);
        expect(calculateTooltipVerticalPosition([0.15, 0.3], 480, 500, 100)).toBeCloseTo(240);
    });

    it('keeps native positioning for spread or centered data', () => {
        expect(calculateTooltipVerticalPosition([0.1, 0.9], 250, 500, 120)).toBeUndefined();
        expect(calculateTooltipVerticalPosition([0.45, 0.55], 250, 500, 120)).toBeUndefined();
    });
});
