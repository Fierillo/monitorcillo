import { createRef } from 'react';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CompositeChartCard from '../components/indicators/CompositeChartCard';

const recharts = vi.hoisted(() => ({ chartProps: null as Record<string, unknown> | null }));

vi.mock('recharts', () => ({
    Area: () => null,
    Bar: () => null,
    CartesianGrid: () => null,
    ComposedChart: (props: Record<string, unknown>) => {
        recharts.chartProps = props;
        return <div>{props.children as ReactNode}</div>;
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
    it('uses a dedicated slider to pan a chart with narrower bars', async () => {
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
            timeRangeSlider={<div data-testid="time-range-slider" />}
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

        const panSlider = await screen.findByRole('slider', { name: 'Desplazar gráfico horizontalmente' });
        const rangeSlider = screen.getByTestId('time-range-slider');
        expect(panSlider.compareDocumentPosition(rangeSlider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(chartContainerRef.current?.style.minWidth).toBe('400px');
        expect(recharts.chartProps).not.toHaveProperty('onTouchStart');
        expect(recharts.chartProps).not.toHaveProperty('onTouchMove');
        expect(recharts.chartProps).not.toHaveProperty('onTouchEnd');

        fireEvent.change(panSlider, { target: { value: '130' } });
        expect(viewport.scrollLeft).toBe(130);
    });
});
