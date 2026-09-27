import { createRef } from 'react';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CompositeChartCard from '../components/indicators/CompositeChartCard';

const recharts = vi.hoisted(() => ({ barProps: null as Record<string, unknown> | null, chartProps: null as Record<string, unknown> | null }));

vi.mock('recharts', () => ({
    Area: () => null,
    Bar: (props: Record<string, unknown>) => {
        recharts.barProps = props;
        return null;
    },
    CartesianGrid: () => null,
    ComposedChart: (props: Record<string, unknown>) => {
        recharts.chartProps = props;
        return <div data-testid="chart-surface" onClick={props.onClick as () => void}>{props.children as ReactNode}</div>;
    },
    Customized: () => null,
    Line: () => null,
    Rectangle: () => null,
    ReferenceDot: () => null,
    ReferenceLine: () => null,
    Tooltip: () => null,
    XAxis: () => null,
    YAxis: () => null,
}));

afterEach(cleanup);

describe('mobile chart interaction', () => {
    it('fits the whole series in the mobile viewport without a pan slider', async () => {
        const rows = Array.from({ length: 50 }, (_, index) => ({ fecha: `MES ${index}`, iso_fecha: `2026-${String(index + 1).padStart(2, '0')}-01`, value: index }));
        const chartContainerRef = createRef<HTMLDivElement>();
        render(<CompositeChartCard
            title="Indicador"
            chartTitle="Gráfico"
            captureRef={createRef<HTMLDivElement>()}
            chartContainerRef={chartContainerRef}
            chartSize={{ width: 320, height: 360 }}
            visibleData={rows}
            sortedData={rows}
            areas={[{ key: 'value', name: 'Valor', color: '#FFD700', type: 'bar' }]}
            methodology={[]}
            valueFormat="percent"
            yAxisDecimals={1}
            leftAxisDomain={[0, 20]}
            xAxisKey="iso_fecha"
            labelByXAxisValue={new Map()}
            highlightedAreas={new Set()}
            selectedMonth={null}
            selectByMonth={false}
            showTooltipTotal={false}
            referenceLines={[]}
            rangePreview={null}
            committedRange={[0, 49]}
            crosshair={null}
            captureTooltip={null}
            isMobile
            isCapturing={false}
            onPrepareDownload={() => undefined}
            onDownloadChart={() => undefined}
            onSelectMonth={() => undefined}
            onToggleHighlight={() => undefined}
            onCrosshairClick={() => undefined}
            onCrosshairUnlock={() => undefined}
            onHoverTooltipChange={() => undefined}
        />);

        const viewport = screen.getByTestId('chart-scroll-viewport');
        Object.defineProperties(viewport, {
            clientWidth: { value: 320, configurable: true },
            scrollWidth: { value: 800, configurable: true },
            scrollLeft: { value: 0, writable: true, configurable: true },
        });
        fireEvent(window, new Event('resize'));

        expect(screen.queryByTestId('chart-pan-slider')).toBeNull();
        expect(chartContainerRef.current?.style.minWidth).toBe('');
        expect(chartContainerRef.current?.style.touchAction).toBe('none');
        expect(recharts.barProps?.maxBarSize).toBe(10);
        expect(recharts.chartProps).not.toHaveProperty('onTouchStart');
        expect(recharts.chartProps).not.toHaveProperty('onTouchMove');
        expect(recharts.chartProps).not.toHaveProperty('onTouchEnd');
    });

    it('scrubs the tooltip with one finger over the X axis without resizing the chart', () => {
        const rows = Array.from({ length: 3 }, (_, index) => ({ fecha: `MES ${index}`, iso_fecha: `2026-0${index + 1}-01`, value: index }));
        const chartContainerRef = createRef<HTMLDivElement>();
        const onHoverTooltipChange = vi.fn();
        const onCrosshairClick = vi.fn();
        render(<CompositeChartCard
            title="Indicador" chartTitle="Gráfico" captureRef={createRef<HTMLDivElement>()}
            chartContainerRef={chartContainerRef} chartSize={{ width: 320, height: 360 }}
            visibleData={rows} sortedData={rows}
            areas={[{ key: 'value', name: 'Valor', color: '#FFD700', type: 'line' }]}
            methodology={[]} valueFormat="percent" yAxisDecimals={1} leftAxisDomain={[0, 20]}
            xAxisKey="iso_fecha" labelByXAxisValue={new Map()} highlightedAreas={new Set()}
            selectedMonth={null} selectByMonth={false} showTooltipTotal={false}
            referenceLines={[]} rangePreview={null} committedRange={[0, 2]}
            crosshair={null}
            captureTooltip={null}
            isMobile
            isCapturing={false}
            onPrepareDownload={() => undefined} onDownloadChart={() => undefined}
            onSelectMonth={() => undefined} onToggleHighlight={() => undefined}
            onCrosshairClick={onCrosshairClick} onCrosshairUnlock={() => undefined}
            onHoverTooltipChange={onHoverTooltipChange}
        />);

        const chart = chartContainerRef.current!;
        chart.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 360, width: 320, height: 360, toJSON: () => ({}) });
        const initialWidth = chart.style.minWidth;
        fireEvent.pointerDown(chart, { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 330, isPrimary: true });
        fireEvent.pointerMove(chart, { pointerId: 1, pointerType: 'touch', clientX: 280, clientY: 330, isPrimary: true });

        expect(onHoverTooltipChange).toHaveBeenLastCalledWith(expect.objectContaining({ label: 'MES 2' }));
        fireEvent.pointerUp(chart, { pointerId: 1, pointerType: 'touch', clientX: 280, clientY: 330, isPrimary: true });
        expect(chart.style.minWidth).toBe(initialWidth);
        expect(onCrosshairClick).not.toHaveBeenCalled();
        expect(screen.queryByTestId('chart-axis-zoom-feedback')).toBeNull();
    });

    it('keeps tracking the finger when the parent re-renders mid-gesture', () => {
        const rows = Array.from({ length: 3 }, (_, index) => ({ fecha: `MES ${index}`, iso_fecha: `2026-0${index + 1}-01`, value: index }));
        const areas = [{ key: 'value', name: 'Valor', color: '#FFD700', type: 'line' as const }];
        const chartContainerRef = createRef<HTMLDivElement>();
        const onHoverTooltipChange = vi.fn();
        const chart = (visible: typeof rows) => <CompositeChartCard
            title="Indicador"
            chartTitle="Gráfico"
            captureRef={createRef<HTMLDivElement>()}
            chartContainerRef={chartContainerRef}
            chartSize={{ width: 320, height: 360 }}
            visibleData={visible}
            sortedData={visible}
            areas={areas}
            methodology={[]}
            valueFormat="percent"
            yAxisDecimals={1}
            leftAxisDomain={[0, 20]}
            xAxisKey="iso_fecha"
            labelByXAxisValue={new Map()}
            highlightedAreas={new Set()}
            selectedMonth={null}
            selectByMonth={false}
            showTooltipTotal={false}
            referenceLines={[]}
            rangePreview={null}
            committedRange={[0, 2]}
            crosshair={null}
            captureTooltip={null}
            isMobile
            isCapturing={false}
            onPrepareDownload={() => undefined}
            onDownloadChart={() => undefined}
            onSelectMonth={() => undefined}
            onToggleHighlight={() => undefined}
            onCrosshairClick={() => undefined}
            onCrosshairUnlock={() => undefined}
            onHoverTooltipChange={onHoverTooltipChange}
        />;

        const { rerender } = render(chart(rows));
        const element = chartContainerRef.current!;
        element.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 360, width: 320, height: 360, toJSON: () => ({}) });

        fireEvent.pointerDown(element, { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 100, isPrimary: true });
        rerender(chart([...rows]));
        fireEvent.pointerMove(element, { pointerId: 1, pointerType: 'touch', clientX: 280, clientY: 100, isPrimary: true });

        expect(onHoverTooltipChange).toHaveBeenLastCalledWith(expect.objectContaining({ label: 'MES 2' }));
    });

    it('follows a thumb slide without locking the crosshair', () => {
        const rows = Array.from({ length: 3 }, (_, index) => ({ fecha: `MES ${index}`, iso_fecha: `2026-0${index + 1}-01`, value: index }));
        const chartContainerRef = createRef<HTMLDivElement>();
        const onCrosshairClick = vi.fn();
        const onHoverTooltipChange = vi.fn();
        render(<CompositeChartCard
            title="Indicador"
            chartTitle="Gráfico"
            captureRef={createRef<HTMLDivElement>()}
            chartContainerRef={chartContainerRef}
            chartSize={{ width: 320, height: 360 }}
            visibleData={rows}
            sortedData={rows}
            areas={[{ key: 'value', name: 'Valor', color: '#FFD700', type: 'line' }]}
            methodology={[]}
            valueFormat="percent"
            yAxisDecimals={1}
            leftAxisDomain={[0, 20]}
            xAxisKey="iso_fecha"
            labelByXAxisValue={new Map()}
            highlightedAreas={new Set()}
            selectedMonth={null}
            selectByMonth={false}
            showTooltipTotal={false}
            referenceLines={[]}
            rangePreview={null}
            committedRange={[0, 2]}
            crosshair={null}
            captureTooltip={null}
            isMobile
            isCapturing={false}
            onPrepareDownload={() => undefined}
            onDownloadChart={() => undefined}
            onSelectMonth={() => undefined}
            onToggleHighlight={() => undefined}
            onCrosshairClick={onCrosshairClick}
            onCrosshairUnlock={() => undefined}
            onHoverTooltipChange={onHoverTooltipChange}
        />);

        const chart = chartContainerRef.current!;
        chart.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 360, width: 320, height: 360, toJSON: () => ({}) });
        fireEvent.pointerDown(chart, { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 100, isPrimary: true });
        fireEvent.pointerMove(chart, { pointerId: 1, pointerType: 'touch', clientX: 220, clientY: 120, isPrimary: true });
        fireEvent.pointerUp(chart, { pointerId: 1, pointerType: 'touch', clientX: 220, clientY: 120, isPrimary: true });

        expect(onHoverTooltipChange).toHaveBeenCalled();
        expect(onHoverTooltipChange).toHaveBeenLastCalledWith(null);
        expect(onCrosshairClick).not.toHaveBeenCalled();

        fireEvent.click(chart.querySelector('[data-testid="chart-surface"]') ?? chart);
        expect(onCrosshairClick).not.toHaveBeenCalled();
    });

    it('locks the crosshair when the finger taps without sliding', () => {
        const rows = Array.from({ length: 3 }, (_, index) => ({ fecha: `MES ${index}`, iso_fecha: `2026-0${index + 1}-01`, value: index }));
        const chartContainerRef = createRef<HTMLDivElement>();
        const onCrosshairClick = vi.fn();
        render(<CompositeChartCard
            title="Indicador"
            chartTitle="Gráfico"
            captureRef={createRef<HTMLDivElement>()}
            chartContainerRef={chartContainerRef}
            chartSize={{ width: 320, height: 360 }}
            visibleData={rows}
            sortedData={rows}
            areas={[{ key: 'value', name: 'Valor', color: '#FFD700', type: 'line' }]}
            methodology={[]}
            valueFormat="percent"
            yAxisDecimals={1}
            leftAxisDomain={[0, 20]}
            xAxisKey="iso_fecha"
            labelByXAxisValue={new Map()}
            highlightedAreas={new Set()}
            selectedMonth={null}
            selectByMonth={false}
            showTooltipTotal={false}
            referenceLines={[]}
            rangePreview={null}
            committedRange={[0, 2]}
            crosshair={null}
            captureTooltip={null}
            isMobile
            isCapturing={false}
            onPrepareDownload={() => undefined}
            onDownloadChart={() => undefined}
            onSelectMonth={() => undefined}
            onToggleHighlight={() => undefined}
            onCrosshairClick={onCrosshairClick}
            onCrosshairUnlock={() => undefined}
            onHoverTooltipChange={() => undefined}
        />);

        const chart = chartContainerRef.current!;
        chart.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 360, width: 320, height: 360, toJSON: () => ({}) });
        fireEvent.pointerDown(chart, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 80, isPrimary: true });
        fireEvent.pointerUp(chart, { pointerId: 1, pointerType: 'touch', clientX: 44, clientY: 82, isPrimary: true });
        fireEvent.click(chart.querySelector('[data-testid="chart-surface"]') ?? chart);

        expect(onCrosshairClick).toHaveBeenCalledTimes(1);
        expect(onCrosshairClick.mock.calls[0][0].activeTooltipIndex).toBe(0);
    });

    it('unlocks a fixed crosshair when the same point is tapped again', () => {
        const rows = Array.from({ length: 3 }, (_, index) => ({ fecha: `MES ${index}`, iso_fecha: `2026-0${index + 1}-01`, value: index }));
        const chartContainerRef = createRef<HTMLDivElement>();
        const onCrosshairClick = vi.fn();
        const onCrosshairUnlock = vi.fn();
        render(<CompositeChartCard
            title="Indicador"
            chartTitle="Gráfico"
            captureRef={createRef<HTMLDivElement>()}
            chartContainerRef={chartContainerRef}
            chartSize={{ width: 320, height: 360 }}
            visibleData={rows}
            sortedData={rows}
            areas={[{ key: 'value', name: 'Valor', color: '#FFD700', type: 'line' }]}
            methodology={[]}
            valueFormat="percent"
            yAxisDecimals={1}
            leftAxisDomain={[0, 20]}
            xAxisKey="iso_fecha"
            labelByXAxisValue={new Map()}
            highlightedAreas={new Set()}
            selectedMonth={null}
            selectByMonth={false}
            showTooltipTotal={false}
            referenceLines={[]}
            rangePreview={null}
            committedRange={[0, 2]}
            crosshair={{ x: 8, y: 80, locked: true, label: 'MES 0' }}
            captureTooltip={null}
            isMobile
            isCapturing={false}
            onPrepareDownload={() => undefined}
            onDownloadChart={() => undefined}
            onSelectMonth={() => undefined}
            onToggleHighlight={() => undefined}
            onCrosshairClick={onCrosshairClick}
            onCrosshairUnlock={onCrosshairUnlock}
            onHoverTooltipChange={() => undefined}
        />);

        const chart = chartContainerRef.current!;
        chart.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 360, width: 320, height: 360, toJSON: () => ({}) });
        fireEvent.pointerDown(chart, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 80, isPrimary: true });
        fireEvent.pointerUp(chart, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 80, isPrimary: true });

        expect(onCrosshairUnlock).toHaveBeenCalledTimes(1);
        expect(onCrosshairClick).not.toHaveBeenCalled();
    });

    it('scrolls the page with two fingers instead of interacting with the chart', () => {
        const rows = Array.from({ length: 3 }, (_, index) => ({ fecha: `MES ${index}`, iso_fecha: `2026-0${index + 1}-01`, value: index }));
        const chartContainerRef = createRef<HTMLDivElement>();
        const onCrosshairClick = vi.fn();
        const onHoverTooltipChange = vi.fn();
        const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
        render(<CompositeChartCard
            title="Indicador"
            chartTitle="Gráfico"
            captureRef={createRef<HTMLDivElement>()}
            chartContainerRef={chartContainerRef}
            chartSize={{ width: 320, height: 360 }}
            visibleData={rows}
            sortedData={rows}
            areas={[{ key: 'value', name: 'Valor', color: '#FFD700', type: 'line' }]}
            methodology={[]}
            valueFormat="percent"
            yAxisDecimals={1}
            leftAxisDomain={[0, 20]}
            xAxisKey="iso_fecha"
            labelByXAxisValue={new Map()}
            highlightedAreas={new Set()}
            selectedMonth={null}
            selectByMonth={false}
            showTooltipTotal={false}
            referenceLines={[]}
            rangePreview={null}
            committedRange={[0, 2]}
            crosshair={null}
            captureTooltip={null}
            isMobile
            isCapturing={false}
            onPrepareDownload={() => undefined}
            onDownloadChart={() => undefined}
            onSelectMonth={() => undefined}
            onToggleHighlight={() => undefined}
            onCrosshairClick={onCrosshairClick}
            onCrosshairUnlock={() => undefined}
            onHoverTooltipChange={onHoverTooltipChange}
        />);

        const chart = chartContainerRef.current!;
        const viewport = screen.getByTestId('chart-scroll-viewport');
        Object.defineProperty(viewport, 'scrollLeft', { value: 0, writable: true, configurable: true });
        chart.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 360, width: 320, height: 360, toJSON: () => ({}) });
        fireEvent.pointerDown(chart, { pointerId: 1, pointerType: 'touch', clientX: 80, clientY: 160, isPrimary: true });
        fireEvent.pointerDown(chart, { pointerId: 2, pointerType: 'touch', clientX: 180, clientY: 160, isPrimary: false });
        fireEvent.pointerMove(chart, { pointerId: 1, pointerType: 'touch', clientX: 40, clientY: 120, isPrimary: true });
        fireEvent.pointerMove(chart, { pointerId: 2, pointerType: 'touch', clientX: 140, clientY: 120, isPrimary: false });

        expect(scrollBy).toHaveBeenCalled();
        expect(onCrosshairClick).not.toHaveBeenCalled();
        expect(onHoverTooltipChange).toHaveBeenLastCalledWith(null);
    });
});
