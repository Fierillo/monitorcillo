import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import SeriesColorMarker from '../components/chart/SeriesColorMarker';

describe('SeriesColorMarker', () => {
    it('renders solid and dashed line styles', () => {
        const solid = renderToStaticMarkup(<SeriesColorMarker color="#22C55E" />);
        const dashed = renderToStaticMarkup(<SeriesColorMarker color="#F97316" dash={[8, 5]} />);

        expect(solid).not.toContain('stroke-dasharray');
        expect(dashed).toContain('stroke-dasharray="8 5"');
    });

    it('overlays the secondary line treatment', () => {
        const markup = renderToStaticMarkup(<SeriesColorMarker color="#000000" secondaryColor="#EF4444" />);

        expect(markup).toContain('stroke="#000000"');
        expect(markup).toContain('stroke="#EF4444"');
        expect(markup).toContain('stroke-dasharray="5 15"');
    });
});
