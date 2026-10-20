import { createRef } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CompositeChartCard from '../components/indicators/CompositeChartCard';
import type { AreaConfig } from '@/types/chart';

const PIXEL_TOLERANCE = 1;
const stackedBars: AreaConfig[] = [
    { key: 'nation', name: 'Nación', color: '#8B5CF6', type: 'bar', stackId: 'spending' },
    { key: 'provinces', name: 'Provincias', color: '#0284C7', type: 'bar', stackId: 'spending' },
];

afterEach(cleanup);

function monthlyRows(count: number) {
    return Array.from({ length: count }, (_, index) => ({
        fecha: `MES ${index}`,
        iso_fecha: new Date(Date.UTC(2000, index, 1)).toISOString().slice(0, 10),
        nation: index + 1,
        provinces: 2,
        total: index + 3,
    }));
}

function renderChart({ count, areas = stackedBars, width = 1000, isMobile = false, isCapturing = true, onHoverTooltipChange = () => undefined }: { count: number; areas?: AreaConfig[]; width?: number; isMobile?: boolean; isCapturing?: boolean; onHoverTooltipChange?: (state: unknown) => void }) {
    const rows = monthlyRows(count);
    const chartContainerRef = createRef<HTMLDivElement>();
    const chart = (capturing: boolean) => <CompositeChartCard
        title="Indicador" chartTitle="Gráfico"
        captureRef={createRef<HTMLDivElement>()} chartContainerRef={chartContainerRef}
        chartSize={{ width, height: 400 }} visibleData={rows} sortedData={rows}
        areas={areas} methodology={[]} valueFormat="percent" yAxisDecimals={1} leftAxisDomain={[0, count + 5]}
        xAxisKey="iso_fecha" labelByXAxisValue={new Map()} highlightedAreas={new Set()}
        selectedMonth={null} selectByMonth={false} showTooltipTotal={false} referenceLines={[]}
        rangePreview={null} committedRange={[0, count - 1]} crosshair={null} captureTooltip={null}
        isMobile={isMobile} isCapturing={capturing}
        onPrepareDownload={() => undefined} onDownloadChart={() => undefined} onSelectMonth={() => undefined}
        onToggleHighlight={() => undefined} onCrosshairClick={() => undefined} onCrosshairUnlock={() => undefined}
        onHoverTooltipChange={onHoverTooltipChange}
    />;
    const view = render(chart(true));
    if (!isCapturing) view.rerender(chart(false));
    return { ...view, chartContainerRef };
}

function xAxisBounds(container: HTMLElement) {
    const axisLine = container.querySelector('.xAxis .recharts-cartesian-axis-line')!;
    return { left: Number(axisLine.getAttribute('x1')), right: Number(axisLine.getAttribute('x2')) };
}

function barColumns(container: HTMLElement) {
    const columns = new Map<number, { left: number; right: number }>();
    for (const bar of container.querySelectorAll('.recharts-bar-rectangle .recharts-rectangle')) {
        const x = Number(bar.getAttribute('x'));
        const strokeInset = Number(bar.getAttribute('stroke-width')) / 2;
        columns.set(x, { left: x - strokeInset, right: x + Number(bar.getAttribute('width')) + strokeInset });
    }
    return [...columns.values()].sort((first, second) => first.left - second.left);
}

function expectWithinPixel(actual: number, expected: number) {
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(PIXEL_TOLERANCE);
}

describe('bar chart edges', () => {
    it('closes the first and last bars on the x axis borders', () => {
        const { container } = renderChart({ count: 12 });
        const axis = xAxisBounds(container);
        const columns = barColumns(container);

        expect(columns).toHaveLength(12);
        expectWithinPixel(columns[0].left, axis.left);
        expectWithinPixel(columns.at(-1)!.right, axis.right);
    });

    it('keeps dense bars inside the axis without overlapping each other', () => {
        const { container } = renderChart({ count: 400 });
        const axis = xAxisBounds(container);
        const columns = barColumns(container);

        expect(columns).toHaveLength(400);
        expectWithinPixel(columns[0].left, axis.left);
        expectWithinPixel(columns.at(-1)!.right, axis.right);
        columns.slice(1).forEach((column, index) => expect(column.left).toBeGreaterThanOrEqual(columns[index].right));
    });

    it('closes the edge bars on the x axis borders on mobile', () => {
        const { container } = renderChart({ count: 30, width: 390, isMobile: true });
        const axis = xAxisBounds(container);
        const columns = barColumns(container);

        expectWithinPixel(columns[0].left, axis.left);
        expectWithinPixel(columns.at(-1)!.right, axis.right);
    });

    it('starts lines on the x axis border when the chart has no bars', () => {
        const { container } = renderChart({ count: 12, areas: [{ key: 'total', name: 'Total', color: '#FFD700', type: 'line' }] });
        const axis = xAxisBounds(container);
        const [, firstX] = container.querySelector('.recharts-line-curve')!.getAttribute('d')!.match(/^M\s*([\d.]+)/)!;

        expectWithinPixel(Number(firstX), axis.left);
    });

    it('aims the mobile touch crosshair at the center of the touched bar', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const onHoverTooltipChange = vi.fn();
        const { container, chartContainerRef } = renderChart({ count: 30, width: 390, isMobile: true, isCapturing: false, onHoverTooltipChange });
        const lastColumn = barColumns(container).at(-1)!;
        const lastColumnCenter = (lastColumn.left + lastColumn.right) / 2;
        const chart = chartContainerRef.current!;
        chart.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 390, bottom: 400, width: 390, height: 400, toJSON: () => ({}) });

        fireEvent.pointerDown(chart, { pointerId: 1, pointerType: 'touch', clientX: lastColumn.right - 1, clientY: 200, isPrimary: true });
        act(() => { vi.advanceTimersByTime(500); });
        fireEvent.pointerUp(chart, { pointerId: 1, pointerType: 'touch', clientX: lastColumn.right - 1, clientY: 200, isPrimary: true });

        const touched = onHoverTooltipChange.mock.lastCall![0] as { x: number; label: string };
        expect(touched.label).toBe('MES 29');
        expectWithinPixel(touched.x, lastColumnCenter);
        vi.useRealTimers();
    });
});
