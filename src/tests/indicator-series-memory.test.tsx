import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IndicatorCompositeView, { restoreHighlightedAreasByView } from '../components/IndicatorCompositeView';
import CompositeChartCard from '../components/indicators/CompositeChartCard';

vi.mock('../components/indicators/CompositeChartCard', () => ({
    default: (props: ComponentProps<typeof CompositeChartCard>) => (
        <div>
            <div data-testid="highlighted">{[...props.highlightedAreas].join(',')}</div>
            <button type="button" onClick={() => props.onToggleHighlight('industria_mm12')}>Seleccionar industria</button>
            {props.axisModeSelector}
        </div>
    ),
}));

const areas = [
    { key: 'industria_mm12', name: 'Industria', color: '#fff', type: 'line' as const },
    { key: 'pesca_mm12', name: 'Pesca', color: '#0ff', type: 'line' as const },
];
const normalData = [{ fecha: 'ENE 17', iso_fecha: '2017-01-01', industria_mm12: 100, pesca_mm12: 100 }];
const perCapitaData = [{ fecha: 'ENE 17', iso_fecha: '2017-01-01', industria_mm12: 95, pesca_mm12: 105 }];

describe('indicator series memory', () => {
    beforeEach(() => window.localStorage.clear());
    afterEach(cleanup);

    it('keeps selected series when switching between normal and per capita', async () => {
        render(<IndicatorCompositeView
            title="EMAE"
            chartTitle="EMAE por sector"
            data={normalData}
            areas={areas}
            methodology={[]}
            indicatorId="emae"
            valueFormat="index"
            views={[{
                id: 'sectores',
                label: 'Por sectores',
                chartTitle: 'EMAE por sector',
                data: normalData,
                areas,
                methodology: [],
                modes: [
                    { id: 'normal', label: 'Normal', chartTitle: 'EMAE por sector', data: normalData, yAxisLabel: 'EMAE por sector' },
                    { id: 'per-capita', label: 'Per cápita', chartTitle: 'EMAE por sector per cápita', data: perCapitaData, yAxisLabel: 'EMAE por sector' },
                ],
            }]}
        />);

        expect(screen.getAllByRole('button', { name: 'Enviar feedback' })).toHaveLength(1);
        fireEvent.click(screen.getByRole('button', { name: 'Seleccionar industria' }));
        await waitFor(() => expect(screen.getByTestId('highlighted').textContent).toBe('industria_mm12'));

        fireEvent.click(screen.getByRole('button', { name: 'Per cápita' }));

        await waitFor(() => expect(screen.getByTestId('highlighted').textContent).toBe('industria_mm12'));
    });

    it('migrates mode-specific memory to its parent view', () => {
        const restored = restoreHighlightedAreasByView({ 'sectores:normal': ['pesca_mm12'] }, [{
            id: 'sectores',
            label: 'Sectores',
            chartTitle: 'Sectores',
            areas,
            methodology: [],
            modes: [{ id: 'normal', label: 'Normal', chartTitle: 'Sectores', data: normalData, yAxisLabel: 'Sectores' }],
        }]);

        expect([...restored.sectores]).toEqual(['pesca_mm12']);
    });
});
