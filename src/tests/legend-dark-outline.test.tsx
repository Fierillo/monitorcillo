import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SeriesColorMarker from '../components/chart/SeriesColorMarker';
import CustomLegend from '../components/chart/CustomLegend';
import { needsLegendOutline, LEGEND_OUTLINE_COLOR } from '../lib/color-contrast';
import type { CustomLegendProps } from '@/types/chart';

const legend = (areas: CustomLegendProps['areas']) => renderToStaticMarkup(
    <CustomLegend areas={areas} highlightedAreas={new Set()} onToggleHighlight={() => {}} />,
);

describe('legend markers on dark backgrounds', () => {
    it('flags only low-contrast colors against the chart background', () => {
        expect(needsLegendOutline('#000000')).toBe(true);
        expect(needsLegendOutline('#1F2937')).toBe(true);
        expect(needsLegendOutline('#C9A44C')).toBe(false);
        expect(needsLegendOutline('#22C55E')).toBe(false);
        expect(needsLegendOutline('rgba(201, 164, 76, 0.7)')).toBe(false);
    });

    it('outlines a dark line marker in white and leaves a bright one alone', () => {
        const dark = renderToStaticMarkup(<SeriesColorMarker color="#000000" />);
        const bright = renderToStaticMarkup(<SeriesColorMarker color="#C9A44C" />);
        expect(dark).toContain('data-legend-outline="true"');
        expect(dark).toContain(`stroke="${LEGEND_OUTLINE_COLOR}"`);
        expect(bright).not.toContain('data-legend-outline');
        expect(bright).not.toContain(`stroke="${LEGEND_OUTLINE_COLOR}"`);
    });

    it('outlines dark bar/area swatches and preliminary swatches in the custom legend', () => {
        const dark = legend([
            { key: 'a', name: 'Negro', color: '#000000', type: 'bar', preliminaryLabel: 'Prelim' },
        ]);
        const bright = legend([
            { key: 'b', name: 'Oro', color: '#C9A44C', type: 'bar', preliminaryLabel: 'Prelim' },
        ]);
        expect(dark.match(/stroke="#FFFFFF"/g)?.length).toBe(2);
        expect(bright).not.toContain('stroke="#FFFFFF"');
    });
});
