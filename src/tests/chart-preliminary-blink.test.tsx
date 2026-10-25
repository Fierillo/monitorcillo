import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import CompositeChartCard from '../components/indicators/CompositeChartCard';
import CustomLegend from '../components/chart/CustomLegend';
import type { AreaConfig, CustomLegendProps } from '@/types/chart';

const PRELIMINARY_COLOR = 'rgba(139, 92, 246, 0.45)';

const partialArea: AreaConfig = {
    key: 'nationPartial',
    name: 'Nación',
    color: '#8B5CF6',
    type: 'bar',
    stackId: 'spending',
    preliminaryKey: 'partial',
    preliminaryColor: PRELIMINARY_COLOR,
    preliminaryBlink: true,
    preliminaryLabel: '2026 parcial: ejecución anualizada',
};

const rows = [
    { fecha: '2025', iso_fecha: '2025-01-01', nationEstimate: 15 },
    { fecha: '2026', iso_fecha: '2026-01-01', nationPartial: 15.22, partial: true },
];

afterEach(cleanup);

function renderChart(area: AreaConfig) {
    const chart = <CompositeChartCard
        title="Indicador" chartTitle="Gráfico"
        captureRef={createRef<HTMLDivElement>()} chartContainerRef={createRef<HTMLDivElement>()}
        chartSize={{ width: 800, height: 400 }} visibleData={rows} sortedData={rows}
        areas={[area]} methodology={[]} valueFormat="percent" yAxisDecimals={1} leftAxisDomain={[0, 20]}
        xAxisKey="iso_fecha" labelByXAxisValue={new Map()} highlightedAreas={new Set()}
        selectedMonth={null} selectByMonth={false} showTooltipTotal={false} referenceLines={[]}
        rangePreview={null} committedRange={[0, 1]} crosshair={null} captureTooltip={null}
        isMobile={false} isCapturing
        onPrepareDownload={() => undefined} onDownloadChart={() => undefined} onSelectMonth={() => undefined}
        onToggleHighlight={() => undefined} onCrosshairClick={() => undefined} onCrosshairUnlock={() => undefined}
        onHoverTooltipChange={() => undefined}
    />;
    return render(chart);
}

const legend = (areas: CustomLegendProps['areas']) => renderToStaticMarkup(
    <CustomLegend areas={areas} highlightedAreas={new Set()} onToggleHighlight={() => {}} />,
);

describe('blinking preliminary bars', () => {
    it('renders the partial bar with the faded solid style and a blink class', () => {
        const { container } = renderChart(partialArea);
        const bar = container.querySelector('.recharts-bar-rectangle .recharts-rectangle')!;

        expect(bar.getAttribute('class')).toContain('preliminary-blink');
        expect(bar.getAttribute('fill')).toBe(PRELIMINARY_COLOR);
        expect(bar.getAttribute('fill-opacity')).toBe('0.45');
        expect(bar.getAttribute('stroke-dasharray')).toBe('4 3');
    });

    it('leaves preliminary bars without the blink flag static', () => {
        const { container } = renderChart({ ...partialArea, preliminaryBlink: false });
        const bar = container.querySelector('.recharts-bar-rectangle .recharts-rectangle')!;

        expect(bar.getAttribute('class')).not.toContain('preliminary-blink');
    });

    it('blinks the preliminary swatch in the legend', () => {
        const markup = legend([partialArea]);

        expect(markup).toContain('class="preliminary-blink"');
        expect(markup).not.toContain('legend-pattern');
    });
});
