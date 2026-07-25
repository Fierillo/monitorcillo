import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import ChartTooltip from '../components/chart/ChartTooltip';

const props = {
    chartData: [{ fecha: 'ENE 26', first: 2, second: 3 }],
    areaConfigs: [
        { key: 'first', name: 'Primero', color: '#fff', type: 'bar' as const, stackId: 'stack' },
        { key: 'second', name: 'Segundo', color: '#000', type: 'bar' as const, stackId: 'stack' },
    ],
    valueFormat: 'percent' as const,
    tooltipProps: { active: true, label: 'ENE 26' },
};

describe('ChartTooltip', () => {
    it('hides totals by default for stacked series', () => {
        expect(renderToStaticMarkup(<ChartTooltip {...props} />)).not.toContain('Total:');
    });

    it('shows totals when explicitly enabled', () => {
        expect(renderToStaticMarkup(<ChartTooltip {...props} showTotal />)).toContain('Total: 5,0%');
    });
});
