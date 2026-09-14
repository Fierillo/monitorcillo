import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IndicatorCompositeView from '../components/IndicatorCompositeView';
import CompositeChartCard from '../components/indicators/CompositeChartCard';
import type { ChartDataRow, ChartViewConfig } from '@/types';

const received = vi.hoisted(() => [] as Array<{ selectedMonth: string | null; committedRange: [number, number]; visibleCount: number; chartTitle: string }>);

vi.mock('../components/indicators/CompositeChartCard', () => ({
    default: (props: ComponentProps<typeof CompositeChartCard>) => {
        received.push({
            selectedMonth: props.selectedMonth ?? null,
            committedRange: props.committedRange,
            visibleCount: props.visibleData.length,
            chartTitle: props.chartTitle,
        });
        return (
            <div>
                {props.viewSelector}
                <button type="button" onClick={() => props.onSelectMonth('2017-02-01')}>Elegir febrero</button>
            </div>
        );
    },
}));

const areas = [{ key: 'valor', name: 'Valor', color: '#fff', type: 'line' as const }];

function monthlyRows(count: number): ChartDataRow[] {
    return Array.from({ length: count }, (_, index) => ({
        fecha: `MES ${index + 1}`,
        iso_fecha: `2017-${String(index + 1).padStart(2, '0')}-01`,
        valor: index,
    }));
}

function view(id: string, label: string, rows: ChartDataRow[]): ChartViewConfig {
    return { id, label, chartTitle: `Vista ${label}`, data: rows, areas, methodology: [] };
}

function renderChart(data: ChartDataRow[], extra: Partial<ComponentProps<typeof IndicatorCompositeView>> = {}) {
    return render(<IndicatorCompositeView title="Test" chartTitle="Test" data={data} areas={areas} methodology={[]} indicatorId="test" valueFormat="index" {...extra} />);
}

describe('chart derived state', () => {
    beforeEach(() => {
        window.localStorage.clear();
        received.length = 0;
    });
    afterEach(cleanup);

    it('never hands the chart a month that is no longer in the data', () => {
        const { rerender } = renderChart(monthlyRows(3));
        fireEvent.click(screen.getByRole('button', { name: 'Elegir febrero' }));
        expect(received.at(-1)?.selectedMonth).toBe('2017-02-01');

        received.length = 0;
        rerender(<IndicatorCompositeView title="Test" chartTitle="Test" data={[monthlyRows(3)[0], monthlyRows(3)[2]]} areas={areas} methodology={[]} indicatorId="test" valueFormat="index" />);

        expect(received.map(render => render.selectedMonth)).not.toContain('2017-02-01');
    });

    it('never hands the chart a range that runs past the end of the data', () => {
        const { rerender } = renderChart(monthlyRows(12));
        expect(received.at(-1)?.committedRange).toEqual([0, 11]);

        received.length = 0;
        rerender(<IndicatorCompositeView title="Test" chartTitle="Test" data={monthlyRows(4)} areas={areas} methodology={[]} indicatorId="test" valueFormat="index" />);

        const overflowing = received.filter(render => render.committedRange[1] > 3);
        expect(overflowing).toEqual([]);
    });

    it('keeps showing every row once the data shrinks', () => {
        const { rerender } = renderChart(monthlyRows(12));

        received.length = 0;
        rerender(<IndicatorCompositeView title="Test" chartTitle="Test" data={monthlyRows(4)} areas={areas} methodology={[]} indicatorId="test" valueFormat="index" />);

        expect(received.at(-1)?.visibleCount).toBe(4);
    });

    it('shows the stored view on the first paint', () => {
        window.localStorage.setItem('monitorcillo:chart:test', JSON.stringify({ selectedViewId: 'beta' }));

        renderChart(monthlyRows(4), {
            views: [view('alpha', 'Alpha', monthlyRows(4)), view('beta', 'Beta', monthlyRows(8))],
        });

        expect(received[0]?.chartTitle).toBe('Vista Beta');
    });

    it('keeps the URL view when storage has a different one', () => {
        window.localStorage.setItem('monitorcillo:chart:test', JSON.stringify({ selectedViewId: 'beta' }));

        renderChart(monthlyRows(4), {
            initialViewId: 'alpha',
            views: [view('alpha', 'Alpha', monthlyRows(4)), view('beta', 'Beta', monthlyRows(8))],
        });

        expect(received[0]?.chartTitle).toBe('Vista Alpha');
    });

    it('shows the stored range on the first paint', () => {
        window.localStorage.setItem('monitorcillo:chart:test', JSON.stringify({ rangeByView: { default: [2, 5] } }));

        renderChart(monthlyRows(12));

        expect(received[0]?.committedRange).toEqual([2, 5]);
        expect(received[0]?.visibleCount).toBe(4);
    });

    it('shows every row of a longer view on the first paint after switching', () => {
        renderChart(monthlyRows(4), {
            views: [view('alpha', 'Alpha', monthlyRows(4)), view('beta', 'Beta', monthlyRows(12))],
        });

        received.length = 0;
        fireEvent.click(screen.getByRole('button', { name: 'Beta' }));

        const firstBeta = received.find(paint => paint.chartTitle === 'Vista Beta');
        expect(firstBeta).toEqual({ selectedMonth: null, committedRange: [0, 11], visibleCount: 12, chartTitle: 'Vista Beta' });
    });
});
