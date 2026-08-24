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
        const markup = renderToStaticMarkup(<ChartTooltip {...props} />);

        expect(markup).not.toContain('Total:');
        expect(markup).toContain('color:#FFD700;font-weight:bold');
        expect(markup).toContain('background-color:rgba(0, 20, 63, 0.4)');
    });

    it('shows totals when explicitly enabled', () => {
        expect(renderToStaticMarkup(<ChartTooltip {...props} showTotal />)).toContain('Total: 5,0%');
    });

    it('uses the reduced mobile footprint in compact mode', () => {
        const markup = renderToStaticMarkup(<ChartTooltip {...props} compact />);

        expect(markup).toContain('data-compact="true"');
        expect(markup).toContain('max-width:176px');
        expect(markup).toContain('max-height:38vh');
        expect(markup).toContain('font-size:9px');
        expect(markup).toContain('padding:4px');
    });

    it('honors series tooltip decimals', () => {
        const markup = renderToStaticMarkup(<ChartTooltip
            chartData={[{ fecha: 'Mes 1', cristina_1: 2.61 }]}
            areaConfigs={[{ key: 'cristina_1', name: 'Cristina Fernández I', color: '#EC4899', type: 'line', valueDecimals: 2 }]}
            valueFormat="index"
            tooltipProps={{ active: true, label: 'Mes 1' }}
        />);

        expect(markup).toContain('2,61');
    });

    it('blurs chart data behind tooltips', () => {
        const markup = renderToStaticMarkup(<ChartTooltip {...props} />);

        expect(markup).toContain('background-color:rgba(0, 20, 63, 0.4)');
        expect(markup).toContain('line-height:1.35');
        expect(markup).toContain('white-space:nowrap');
        expect(markup).toContain('backdrop-filter:blur(2px)');
        expect(markup).toContain('-webkit-backdrop-filter:blur(2px)');
    });

    it('uses fixed rows when rendering an exported tooltip', () => {
        const markup = renderToStaticMarkup(<ChartTooltip {...props} isCapturing />);

        expect(markup).toContain('height:22px');
        expect(markup).toContain('line-height:22px');
        expect(markup).toContain('align-items:center');
        expect(markup).toContain('Primero</span><span style="color:#fff">: 2,0%');
    });

    it('does not apply chart borders to tooltip text', () => {
        const markup = renderToStaticMarkup(<ChartTooltip
            chartData={[{ fecha: 'ENE 26', informal: 95.4 }]}
            areaConfigs={[{ key: 'informal', name: 'Salario informal', color: '#2E2D2C', borderColor: '#FFFFFF', type: 'line' }]}
            valueFormat="index"
            tooltipProps={{ active: true, label: 'ENE 26' }}
        />);

        expect(markup).toContain('color:#2E2D2C');
        expect(markup).not.toContain('-webkit-text-stroke');
    });

    it('applies an explicit tooltip background only to the configured series', () => {
        const markup = renderToStaticMarkup(<ChartTooltip
            chartData={[{ fecha: 'ENE 26', informal: 95.4, formal: 102.1 }]}
            areaConfigs={[
                { key: 'informal', name: 'Salario informal', color: '#000000', tooltipBackgroundColor: 'rgba(255, 255, 255, 0.9)', type: 'line' },
                { key: 'formal', name: 'Salario formal', color: '#FFFFFF', type: 'line' },
            ]}
            valueFormat="index"
            tooltipProps={{ active: true, label: 'ENE 26' }}
        />);

        expect(markup).toContain('background-color:rgba(255, 255, 255, 0.9)');
        expect(markup).not.toContain('-webkit-text-stroke');
        expect(markup).toContain('<span style="color:#FFFFFF">Salario formal:');
    });

    it('omits every series without a value for the active month', () => {
        const markup = renderToStaticMarkup(<ChartTooltip
            chartData={[{ fecha: 'Mes reciente', informal: null, formal: 104.2 }]}
            areaConfigs={[
                { key: 'informal', name: 'Empleo informal', color: '#333', type: 'line' },
                { key: 'formal', name: 'Empleo formal', color: '#fff', type: 'line' },
                { key: 'ripte', name: 'RIPTE', color: '#0f0', type: 'line' },
            ]}
            valueFormat="index"
            tooltipProps={{ active: true, label: 'Mes reciente' }}
        />);

        expect(markup).not.toContain('Empleo informal');
        expect(markup).not.toContain('RIPTE');
        expect(markup).toContain('Empleo formal');
    });

    it('compares the same mandate month for ICG', () => {
        const markup = renderToStaticMarkup(<ChartTooltip
            chartData={[
                { fecha: 'ENE 02', iso_fecha: '2002-01-01', icg: 1.36, mandate_name: 'Eduardo Duhalde', mandate_color: '#38BDF8', mandate_secondary_color: '#64748B', comparison_month: 2, comparison_term: 1, comparison_group: '1:2' },
                { fecha: 'ENE 06', iso_fecha: '2006-01-01', icg: 2.63, mandate_name: 'Néstor Kirchner', mandate_color: '#38BDF8', comparison_month: 2, comparison_term: 1, comparison_group: '1:2' },
                { fecha: 'ENE 10', iso_fecha: '2010-01-01', icg: 2.42, mandate_name: 'Cristina Fernández I', mandate_color: '#EC4899', comparison_month: 2, comparison_term: 1, comparison_group: '1:2' },
                { fecha: 'ENE 14', iso_fecha: '2014-01-01', icg: 1.78, mandate_name: 'Cristina Fernández II', mandate_color: '#7C3AED', comparison_month: 2, comparison_term: 2, comparison_group: '2:2' },
                { fecha: 'ENE 18', iso_fecha: '2018-01-01', icg: 2.91, mandate_name: 'Mauricio Macri', mandate_color: '#FACC15', comparison_month: 2, comparison_term: 1, comparison_group: '1:2' },
                { fecha: 'ENE 22', iso_fecha: '2022-01-01', icg: 1.42, mandate_name: 'Alberto Fernández', mandate_color: '#14B8A6', comparison_month: 2, comparison_term: 1, comparison_group: '1:2' },
                { fecha: 'ENE 26', iso_fecha: '2026-01-01', icg: 2.4, mandate_name: 'Javier Milei', mandate_color: '#A855F7', comparison_month: 2, comparison_term: 1, comparison_group: '1:2' },
            ]}
            areaConfigs={[{ key: 'icg', name: 'ICG', color: '#FFD700', type: 'line', comparisonMode: 'mandate-month' }]}
            valueFormat="index"
            tooltipProps={{ active: true, label: 'ENE 26' }}
        />);

        expect(markup).toContain('Mauricio Macri');
        expect(markup).toContain('ENE 26');
        expect(markup).toContain('Eduardo Duhalde');
        expect(markup).toContain('#38BDF8');
        expect(markup).toContain('#64748B');
        expect(markup).toContain('Néstor Kirchner');
        expect(markup).toContain('Cristina Fernández I');
        expect(markup).not.toContain('Cristina Fernández II');
        expect(markup).toContain('Alberto Fernández');
        expect(markup).toContain('Javier Milei');
        expect(markup).toContain('2,40');
        expect(markup).toContain('background-color:rgba(0, 20, 63, 0.4)');
        expect(markup).toContain('backdrop-filter:blur(2px)');
    });
});
