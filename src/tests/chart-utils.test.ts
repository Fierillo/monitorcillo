import { describe, expect, it } from 'vitest';
import { calculateTooltipVerticalPosition, collectAxisExtentValues, createRoundTicks, selectRoundTickDivisions } from '../components/chart/utils';

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

describe('createRoundTicks', () => {
    it('creates equally sized axes with round tick steps', () => {
        const left = createRoundTicks(31, 97, 8);
        const right = createRoundTicks(-0.8, 4.3, 8);

        expect(left).toHaveLength(9);
        expect(right).toHaveLength(9);
        expect(left).toEqual([30, 40, 50, 60, 70, 80, 90, 100, 110]);
        expect(right).toEqual([-1, 0, 1, 2, 3, 4, 5, 6, 7]);
    });

    it('covers constant and decimal ranges without irregular tick values', () => {
        expect(createRoundTicks(2.4, 2.4, 4)).toEqual([1, 2, 3, 4, 5]);
        expect(createRoundTicks(0.12, 0.34, 4)).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    });

    it('selects a shared division count that minimizes unused axis space', () => {
        const divisions = selectRoundTickDivisions([[31, 97], [-0.8, 4.3]], 8);
        const left = createRoundTicks(31, 97, divisions);
        const right = createRoundTicks(-0.8, 4.3, divisions);

        expect(divisions).toBe(7);
        expect(left).toEqual([30, 40, 50, 60, 70, 80, 90, 100]);
        expect(right).toHaveLength(left.length);
        expect(right.at(-1)).toBe(6);
    });
});
