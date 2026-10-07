import { cloneElement, createRef } from 'react';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CompositeChartCard from '../components/indicators/CompositeChartCard';

const recharts = vi.hoisted(() => ({ barProps: null as Record<string, unknown> | null, chartProps: null as Record<string, unknown> | null, xAxisProps: null as Record<string, unknown> | null }));

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
    XAxis: (props: Record<string, unknown>) => {
        recharts.xAxisProps = props;
        return null;
    },
    YAxis: () => null,
}));

afterEach(cleanup);

describe('mobile chart interaction', () => {
    it('keeps selected ticks separated within the plot after axes and edge padding', () => {
        const rows = Array.from({ length: 122 }, (_, index) => ({
            fecha: `P ${String(index).padStart(4, '0')}`,
            iso_fecha: new Date(Date.UTC(2016, index, 1)).toISOString().slice(0, 10),
            value: index,
        }));
        const chart = <CompositeChartCard
            title="Indicador" chartTitle="Gráfico"
            captureRef={createRef<HTMLDivElement>()} chartContainerRef={createRef<HTMLDivElement>()}
            chartSize={{ width: 640, height: 360 }} visibleData={rows} sortedData={rows}
            areas={[{ key: 'value', name: 'Valor', color: '#FFD700', type: 'line' }]}
            methodology={[]} valueFormat="currency" yAxisDecimals={1} leftAxisDomain={[0, 121]}
            secondaryYAxis={{ format: 'percent' }}
            xAxisKey="iso_fecha" labelByXAxisValue={new Map(rows.map(row => [row.iso_fecha, row.fecha]))}
            highlightedAreas={new Set()} selectedMonth={null} selectByMonth={false}
            showTooltipTotal={false} referenceLines={[]} rangePreview={null} committedRange={[0, 120]}
            crosshair={null} captureTooltip={null} isMobile={false} isCapturing={false}
            onPrepareDownload={() => undefined} onDownloadChart={() => undefined}
            onSelectMonth={() => undefined} onToggleHighlight={() => undefined}
            onCrosshairClick={() => undefined} onCrosshairUnlock={() => undefined}
            onHoverTooltipChange={() => undefined}
        />;
        const { rerender } = render(chart);

        const ticks = recharts.xAxisProps?.ticks as string[];
        const padding = (recharts.xAxisProps?.padding ?? { left: 0, right: 0 }) as { left: number; right: number };
        const margin = recharts.chartProps?.margin as { left: number; right: number };
        const plotWidth = 640 - margin.left - margin.right - 90 - 60 - padding.left - padding.right;
        const indices = ticks.map(tick => rows.findIndex(row => row.iso_fecha === tick));

        expect(ticks.length).toBeGreaterThan(1);
        for (let index = 1; index < indices.length; index++) {
            const distance = (indices[index] - indices[index - 1]) * plotWidth / (rows.length - 1);
            expect(distance).toBeGreaterThanOrEqual(53);
        }

        rerender(cloneElement(chart, { xAxisKey: 'fecha' }));
        expect(recharts.xAxisProps?.ticks).toBeInstanceOf(Array);
        const labelTicks = recharts.xAxisProps?.ticks as string[];
        expect(labelTicks.length).toBeLessThanOrEqual(Math.floor(plotWidth / 53) + 1);
        const labelIndices = labelTicks.map(tick => rows.findIndex(row => row.fecha === tick));
        for (let index = 1; index < labelIndices.length; index++) {
            expect((labelIndices[index] - labelIndices[index - 1]) * plotWidth / (rows.length - 1)).toBeGreaterThanOrEqual(53);
        }

        rerender(cloneElement(chart, { chartSize: { width: 1336, height: 360 } }));
        const wideTicks = recharts.xAxisProps?.ticks as string[];
        expect(wideTicks.length).toBeGreaterThanOrEqual(20);
        expect(wideTicks[0]).toBe(rows[0].iso_fecha);
        expect(wideTicks.at(-1)).toBe(rows.at(-1)?.iso_fecha);
        const wideIndices = wideTicks.map(tick => rows.findIndex(row => row.iso_fecha === tick));
        const widePlotWidth = plotWidth + 1336 - 640;
        for (let index = 1; index < wideIndices.length; index++) {
            expect((wideIndices[index] - wideIndices[index - 1]) * widePlotWidth / (rows.length - 1)).toBeGreaterThanOrEqual(53);
        }
        const labelWidth = 45;
        const firstDistance = (wideIndices[1] - wideIndices[0]) * widePlotWidth / (rows.length - 1);
        const lastDistance = (wideIndices.at(-1)! - wideIndices.at(-2)!) * widePlotWidth / (rows.length - 1);
        expect(firstDistance - labelWidth * 1.5).toBeGreaterThanOrEqual(8);
        expect(lastDistance - labelWidth * 1.5).toBeGreaterThanOrEqual(8);

        const fewRows = rows.slice(0, 4).map(row => ({ ...row, other: row.value + 1 }));
        rerender(cloneElement(chart, {
            secondaryYAxis: undefined,
            visibleData: fewRows,
            sortedData: fewRows,
            areas: [
                { key: 'value', name: 'Valor', color: '#FFD700', type: 'bar', maxBarSize: 200 },
                { key: 'other', name: 'Otro', color: '#00BFFF', type: 'bar', maxBarSize: 200 },
            ],
        }));
        const barMargin = recharts.chartProps?.margin as { right: number };
        expect((recharts.chartProps?.barSize as number) * 2).toBeLessThanOrEqual(barMargin.right * 2);
        expect(recharts.chartProps?.barGap).toBe(0);
    });

    it('uses the whole x axis for data and keeps endpoint labels inside it', () => {
        const rows = Array.from({ length: 50 }, (_, index) => ({ fecha: `MES ${index}`, iso_fecha: `2026-${String(index + 1).padStart(2, '0')}-01`, value: index }));
        render(<CompositeChartCard
            title="Indicador"
            chartTitle="Gráfico"
            captureRef={createRef<HTMLDivElement>()}
            chartContainerRef={createRef<HTMLDivElement>()}
            chartSize={{ width: 1000, height: 360 }}
            visibleData={rows}
            sortedData={rows}
            areas={[{ key: 'value', name: 'Valor', color: '#FFD700', type: 'bar' }]}
            methodology={[]}
            valueFormat="percent"
            yAxisDecimals={1}
            leftAxisDomain={[0, 20]}
            xAxisKey="iso_fecha"
            labelByXAxisValue={new Map([['2026-01-01', 'ENE 26']])}
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

        type TickProps = { index: number; visibleTicksCount: number; payload: { value: string }; tickFormatter?: (value: unknown, index: number) => string };
        const axisProps = recharts.xAxisProps as Record<string, unknown> & { tickFormatter: (value: unknown, index: number) => string };
        const tick = axisProps.tick as (props: TickProps) => { props: { textAnchor: string; children: string } };
        const tickCount = (axisProps.ticks as string[]).length;
        const renderTick = (index: number, value: string) => tick({ index, visibleTicksCount: tickCount, payload: { value }, tickFormatter: axisProps.tickFormatter });

        const padding = (axisProps.padding ?? { left: 0, right: 0 }) as { left: number; right: number };

        expect(tickCount).toBeGreaterThan(2);
        expect(padding).toEqual({ left: 0, right: 0 });
        expect(axisProps.scale).toBe('point');
        expect(renderTick(0, '2026-01-01').props.textAnchor).toBe('start');
        expect(renderTick(Math.floor(tickCount / 2), '2026-01-01').props.textAnchor).toBe('middle');
        expect(renderTick(tickCount - 1, '2026-01-01').props.textAnchor).toBe('end');
        expect(renderTick(0, '2026-01-01').props.children).toBe('ENE 26');
        expect(renderTick(0, '2026-02-01').props.children).toBe('2026-02-01');
        expect(tickCount).toBeLessThanOrEqual(rows.length);
    });

    it('selects sparse ticks before rendering rather than letting the axis prune them', () => {
        const rows = Array.from({ length: 200 }, (_, index) => ({ fecha: `Mes ${index}`, iso_fecha: `2020-${String((index % 12) + 1).padStart(2, '0')}-01`, value: index }));
        render(<CompositeChartCard
            title="Indicador"
            chartTitle="Gráfico"
            captureRef={createRef<HTMLDivElement>()}
            chartContainerRef={createRef<HTMLDivElement>()}
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
            committedRange={[0, 199]}
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

        expect(recharts.xAxisProps?.interval).toBe(0);
        expect((recharts.xAxisProps?.ticks as string[]).length).toBeLessThan(rows.length);
    });

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
        expect(recharts.chartProps?.barSize).toBe(10);
        expect(recharts.chartProps).not.toHaveProperty('onTouchStart');
        expect(recharts.chartProps).not.toHaveProperty('onTouchMove');
        expect(recharts.chartProps).not.toHaveProperty('onTouchEnd');
        expect(recharts.barProps?.isAnimationActive).toBe(true);
    });

    it('draws dense bar histories without animating every bar', () => {
        const rows = Array.from({ length: 501 }, (_, index) => ({ fecha: `Mes ${index}`, iso_fecha: String(index), value: index }));
        render(<CompositeChartCard
            title="Indicador" chartTitle="Gráfico"
            captureRef={createRef<HTMLDivElement>()} chartContainerRef={createRef<HTMLDivElement>()}
            chartSize={{ width: 320, height: 360 }} visibleData={rows} sortedData={rows}
            areas={[{ key: 'value', name: 'Valor', color: '#FFD700', type: 'bar' }]}
            methodology={[]} valueFormat="percent" yAxisDecimals={1} leftAxisDomain={[0, 501]}
            xAxisKey="iso_fecha" labelByXAxisValue={new Map()} highlightedAreas={new Set()}
            selectedMonth={null} selectByMonth={false} showTooltipTotal={false} referenceLines={[]}
            rangePreview={null} committedRange={[0, 500]} crosshair={null} captureTooltip={null}
            isMobile isCapturing={false}
            onPrepareDownload={() => undefined} onDownloadChart={() => undefined}
            onSelectMonth={() => undefined} onToggleHighlight={() => undefined}
            onCrosshairClick={() => undefined} onCrosshairUnlock={() => undefined}
            onHoverTooltipChange={() => undefined}
        />);

        expect(recharts.barProps?.isAnimationActive).toBe(false);
    });

    it('places the range selector next to the download button above the chart', () => {
        const rows = Array.from({ length: 6 }, (_, index) => ({ fecha: `MES ${index}`, iso_fecha: `2026-0${index + 1}-01`, value: index }));
        const chartContainerRef = createRef<HTMLDivElement>();
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
            committedRange={[0, 5]}
            crosshair={null}
            captureTooltip={null}
            isMobile
            isCapturing={false}
            onPrepareDownload={() => undefined}
            onDownloadChart={() => undefined}
            onSelectMonth={() => undefined}
            onToggleHighlight={() => undefined}
            rangeSelectControl={<button type="button">Acotar rango</button>}
            onCrosshairClick={() => undefined}
            onCrosshairUnlock={() => undefined}
            onHoverTooltipChange={() => undefined}
        />);

        const axis = screen.getByTestId('chart-scroll-viewport');
        const control = screen.getByRole('button', { name: 'Acotar rango' });
        const save = screen.getByTitle('Descargar gráfico');

        expect(control.parentElement).toBe(save.parentElement);
        expect(axis.compareDocumentPosition(control) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    });

    it('places the guide on the picked month when the chart shows only a slice', () => {
        const rows = Array.from({ length: 10 }, (_, index) => ({ fecha: `MES ${index}`, iso_fecha: `2026-${String((index % 12) + 1).padStart(2, '0')}-01`, value: index }));
        const chartContainerRef = createRef<HTMLDivElement>();
        render(<CompositeChartCard
            title="Indicador"
            chartTitle="Gráfico"
            captureRef={createRef<HTMLDivElement>()}
            chartContainerRef={chartContainerRef}
            chartSize={{ width: 320, height: 360 }}
            visibleData={rows.slice(3, 8)}
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
            committedRange={[3, 7]}
            crosshair={null}
            captureTooltip={null}
            isMobile
            isCapturing={false}
            onPrepareDownload={() => undefined}
            onDownloadChart={() => undefined}
            onSelectMonth={() => undefined}
            onToggleHighlight={() => undefined}
            rangeSelection={{ selection: { phase: 'end', index: 5, startIndex: 3, endIndex: 7 }, maxIndex: 9, onSelectionChange: () => undefined, onCommit: () => undefined, onCancel: () => undefined }}
            onCrosshairClick={() => undefined}
            onCrosshairUnlock={() => undefined}
            onHoverTooltipChange={() => undefined}
        />);

        expect(screen.getByTestId('range-picker-date').textContent).toBe('MES 5');
        expect(screen.getByTestId('range-picker-guide').style.left).toBe('160px');
    });

    it('anchors the range picker guide to the chart plot area on both viewports', () => {
        const rows = Array.from({ length: 5 }, (_, index) => ({ fecha: `MES ${index}`, iso_fecha: `2026-0${index + 1}-01`, value: index }));
        const chartContainerRef = createRef<HTMLDivElement>();
        const selection = { phase: 'end' as const, index: 2, startIndex: 1, endIndex: 4 };
        const card = (isMobile: boolean) => <CompositeChartCard
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
            committedRange={[0, 4]}
            crosshair={null}
            captureTooltip={null}
            isMobile={isMobile}
            isCapturing={false}
            onPrepareDownload={() => undefined}
            onDownloadChart={() => undefined}
            onSelectMonth={() => undefined}
            onToggleHighlight={() => undefined}
            rangeSelection={{ selection, maxIndex: 4, onSelectionChange: () => undefined, onCommit: () => undefined, onCancel: () => undefined }}
            onCrosshairClick={() => undefined}
            onCrosshairUnlock={() => undefined}
            onHoverTooltipChange={() => undefined}
        />;

        const { rerender } = render(card(true));
        const mobileGuide = screen.getByTestId('range-picker-guide').style.left;
        rerender(card(false));
        const desktopGuide = screen.getByTestId('range-picker-guide').style.left;

        expect(mobileGuide).toBe('160px');
        expect(desktopGuide).toBe('186px');
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
