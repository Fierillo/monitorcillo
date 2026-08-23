import { cleanup, render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChartArea from '../components/chart/ChartArea';
import ChartBar from '../components/chart/ChartBar';
import ChartLine from '../components/chart/ChartLine';

const rechartsProps = vi.hoisted(() => ({
    areas: [] as Record<string, unknown>[],
    bars: [] as Record<string, unknown>[],
    lines: [] as Record<string, unknown>[],
    rectangles: [] as Record<string, unknown>[],
}));

vi.mock('recharts', () => ({
    Area: (props: Record<string, unknown>) => {
        rechartsProps.areas.push(props);
        return null;
    },
    Bar: (props: Record<string, unknown>) => {
        rechartsProps.bars.push(props);
        return null;
    },
    Line: (props: Record<string, unknown>) => {
        rechartsProps.lines.push(props);
        return null;
    },
    Rectangle: (props: Record<string, unknown>) => {
        rechartsProps.rectangles.push(props);
        return null;
    },
}));

const area = { key: 'series', name: 'Serie', color: '#FFD700' };

describe('chart series interactions', () => {
    beforeEach(() => {
        rechartsProps.areas.length = 0;
        rechartsProps.bars.length = 0;
        rechartsProps.lines.length = 0;
        rechartsProps.rectangles.length = 0;
    });

    afterEach(cleanup);

    it('toggles a line on Ctrl + click through its wide hit target', () => {
        const onCtrlClick = vi.fn();
        const stopPropagation = vi.fn();
        render(<ChartLine areaConfig={{ ...area, type: 'line' }} isDimmed={false} data={[]} onCtrlClick={onCtrlClick} />);

        const hitTarget = rechartsProps.lines.at(-1);
        expect(hitTarget?.stroke).toBe('transparent');
        expect(hitTarget?.strokeWidth).toBe(12);
        const onClick = hitTarget?.onClick as ((data: unknown, event: { ctrlKey: boolean; stopPropagation: () => void }) => void);
        onClick({}, { ctrlKey: true, stopPropagation });

        expect(stopPropagation).toHaveBeenCalledOnce();
        expect(onCtrlClick).toHaveBeenCalledOnce();
    });

    it('only toggles an area when Ctrl is pressed', () => {
        const onCtrlClick = vi.fn();
        const stopPropagation = vi.fn();
        render(<ChartArea areaConfig={area} isDimmed={false} onCtrlClick={onCtrlClick} />);

        const onClick = rechartsProps.areas[0].onClick as ((data: unknown, event: { ctrlKey: boolean; stopPropagation: () => void }) => void);
        onClick({}, { ctrlKey: false, stopPropagation });
        expect(onCtrlClick).not.toHaveBeenCalled();

        onClick({}, { ctrlKey: true, stopPropagation });
        expect(stopPropagation).toHaveBeenCalledOnce();
        expect(onCtrlClick).toHaveBeenCalledOnce();
    });

    it('prioritizes toggling a bar over selecting its period on Ctrl + click', () => {
        const onCtrlClick = vi.fn();
        const onSelectMonth = vi.fn();
        const stopPropagation = vi.fn();
        render(<ChartBar areaConfig={{ ...area, type: 'bar' }} isDimmed={false} selectedMonth={null} onSelectMonth={onSelectMonth} onCtrlClick={onCtrlClick} />);

        const onClick = rechartsProps.bars[0].onClick as ((data: unknown, index: number, event: { ctrlKey: boolean; stopPropagation: () => void }) => void);
        onClick({ iso_fecha: '2026-08-01' }, 0, { ctrlKey: true, stopPropagation });

        expect(stopPropagation).toHaveBeenCalledOnce();
        expect(onCtrlClick).toHaveBeenCalledOnce();
        expect(onSelectMonth).not.toHaveBeenCalled();
    });

    it('keeps normal bar period selection unchanged', () => {
        const onCtrlClick = vi.fn();
        const onSelectMonth = vi.fn();
        const stopPropagation = vi.fn();
        render(<ChartBar areaConfig={{ ...area, type: 'bar' }} isDimmed={false} selectedMonth={null} onSelectMonth={onSelectMonth} onCtrlClick={onCtrlClick} />);

        const onClick = rechartsProps.bars[0].onClick as ((data: unknown, index: number, event: { ctrlKey: boolean; stopPropagation: () => void }) => void);
        onClick({ iso_fecha: '2026-08-01' }, 0, { ctrlKey: false, stopPropagation });

        expect(stopPropagation).toHaveBeenCalledOnce();
        expect(onSelectMonth).toHaveBeenCalledWith('2026-08-01');
        expect(onCtrlClick).not.toHaveBeenCalled();
    });

    it('uses the consolidated spending border style for every bar', () => {
        render(<ChartBar areaConfig={{ ...area, type: 'bar' }} isDimmed={false} selectedMonth={null} onSelectMonth={vi.fn()} onCtrlClick={vi.fn()} />);
        const shape = rechartsProps.bars[0].shape as (props: Record<string, unknown>) => ReactElement;

        render(shape({ payload: { iso_fecha: '2026-08-01' }, x: 10, y: 20, width: 30, height: 40 }));

        expect(rechartsProps.rectangles[0]).toMatchObject({
            stroke: '#FFD700',
            strokeWidth: 0.5,
            x: 10.25,
            y: 20.25,
            width: 29.5,
            height: 39.5,
        });
    });

    it('keeps the same gold border on preliminary bars', () => {
        render(<ChartBar areaConfig={{ ...area, type: 'bar', preliminaryKey: 'preliminary' }} isDimmed={false} selectedMonth={null} onSelectMonth={vi.fn()} onCtrlClick={vi.fn()} />);
        const shape = rechartsProps.bars[0].shape as (props: Record<string, unknown>) => ReactElement;

        render(shape({ payload: { iso_fecha: '2026-08-01', preliminary: true }, x: 0, y: 0, width: 20, height: 20 }));

        expect(rechartsProps.rectangles[0]).toMatchObject({ stroke: '#FFD700', strokeWidth: 0.5 });
    });
});
