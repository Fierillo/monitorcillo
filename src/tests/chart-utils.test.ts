import { describe, expect, it } from 'vitest';
import { calculateTooltipVerticalPosition, collectAxisExtentValues, createRoundTicks, parseActiveTooltipIndex, resolveChartHoverPoint, selectMonthAlignedXTicks, selectRoundTickDivisions, targetXTickCount } from '../components/chart/utils';

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

describe('resolveChartHoverPoint', () => {
    const rows = [
        { fecha: 'ENE 26', iso_fecha: '2026-01-01', valor: 1 },
        { fecha: 'FEB 26', iso_fecha: '2026-02-01', valor: 2 },
    ];

    it('parses numeric and string tooltip indexes', () => {
        expect(parseActiveTooltipIndex(1)).toBe(1);
        expect(parseActiveTooltipIndex('1')).toBe(1);
        expect(parseActiveTooltipIndex(null)).toBeNull();
        expect(parseActiveTooltipIndex('[0]')).toBeNull();
    });

    it('resolves hover points from Recharts 3 mouse state without activePayload', () => {
        expect(resolveChartHoverPoint({
            activeTooltipIndex: '1',
            activeCoordinate: { x: 120, y: 80 },
        }, rows)).toEqual({
            x: 120,
            y: 80,
            label: 'FEB 26',
            row: rows[1],
            activeIndex: 1,
        });
    });

    it('returns null when activePayload is present but the tooltip index is missing', () => {
        expect(resolveChartHoverPoint({
            activeCoordinate: { x: 120, y: 80 },
            activePayload: [{ payload: rows[0], value: 1, name: 'valor', dataKey: 'valor' }],
        }, rows)).toBeNull();
    });
});

describe('selectMonthAlignedXTicks', () => {
    function monthlyRange(startIso: string, months: number): string[] {
        const [year, month] = startIso.split('-').map(Number);
        return Array.from({ length: months }, (_, index) => {
            const total = year * 12 + (month - 1) + index;
            const nextYear = Math.floor(total / 12);
            const nextMonth = (total % 12) + 1;
            return `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
        });
    }

    it('keeps yearly ticks on the same calendar month', () => {
        const dates = monthlyRange('2017-06-01', 12 * 8 + 1);
        const ticks = selectMonthAlignedXTicks(dates, 8);

        expect(ticks.length).toBeGreaterThanOrEqual(2);
        expect(ticks.every(tick => tick.slice(5, 7) === '06')).toBe(true);
        expect(ticks.at(-1)).toBe('2025-06-01');
    });

    it('keeps ticks on a fixed month phase from the latest date', () => {
        const dates = monthlyRange('2020-03-01', 36);
        const ticks = selectMonthAlignedXTicks(dates, 8);
        const toIndex = (iso: string) => {
            const [year, month] = iso.split('-').map(Number);
            return year * 12 + month - 1;
        };

        expect(ticks.at(-1)).toBe('2023-02-01');
        expect(ticks.length).toBeGreaterThanOrEqual(2);
        const step = toIndex(ticks[1]) - toIndex(ticks[0]);
        expect(step).toBeGreaterThan(0);
        for (let index = 1; index < ticks.length; index += 1) {
            expect(toIndex(ticks[index]) - toIndex(ticks[index - 1])).toBe(step);
        }
    });

    it('returns all dates when the series is shorter than the target tick count', () => {
        const dates = monthlyRange('2026-01-01', 4);
        expect(selectMonthAlignedXTicks(dates, 8)).toEqual(dates);
    });

    it('never exceeds the target tick count even for dense monthly ranges', () => {
        const dates = monthlyRange('2024-01-01', 12);
        const ticks = selectMonthAlignedXTicks(dates, 6);

        expect(ticks.length).toBeLessThanOrEqual(6);
        expect(ticks.length).toBeGreaterThanOrEqual(2);
    });

    it('skips missing months instead of drifting to another month', () => {
        const dates = monthlyRange('2020-06-01', 61).filter(date => date !== '2022-06-01');
        const ticks = selectMonthAlignedXTicks(dates, 6);

        expect(ticks.every(tick => tick.slice(5, 7) === '06')).toBe(true);
        expect(ticks).not.toContain('2022-06-01');
    });
});

describe('targetXTickCount', () => {
    it('reserves roughly one label width of space per tick', () => {
        expect(targetXTickCount(800, 80)).toBe(10);
        expect(targetXTickCount(400, 80)).toBe(4);
        expect(targetXTickCount(120, 80)).toBe(2);
    });
});
