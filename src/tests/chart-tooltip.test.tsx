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
    it.each([false, true])('wraps long headers and names inside a max width instead of truncating (compact=%s)', compact => {
        const header = '2026 · Nación al 21/10, provincias al 30/06';
        const markup = renderToStaticMarkup(<ChartTooltip
            chartData={[{ fecha: '2026', tooltipHeader: header, a: 12.3 }]}
            areaConfigs={[{ key: 'a', name: 'Una serie con un nombre bastante largo', color: '#8B5CF6', type: 'bar' }]}
            valueFormat="percent"
            compact={compact}
            tooltipProps={{ active: true, label: '2026' }}
        />);

        expect(markup).toContain(header);
        expect(markup).toContain('Una serie con un nombre bastante largo');
        expect(markup).not.toMatch(/ellipsis|overflow:hidden/);
        expect(markup).toMatch(/max-width:min\(\d+px, \d+vw\)/);
        expect(markup).toContain('white-space:normal');
        expect(markup).toContain('overflow-wrap:anywhere');
        // Only the value stays on one line, next to its (possibly wrapped) label.
        expect(markup.match(/white-space:nowrap/g)).toHaveLength(1);
    });

    it('uses a row tooltipHeader and renders sectioned series last, in a dotted box with its own header', () => {
        const markup = renderToStaticMarkup(<ChartTooltip
            chartData={[{ fecha: '2026', tooltipHeader: '2026 · al 21/10/2026', acc: 12.3, proj: 15.2 }]}
            areaConfigs={[
                { key: 'proj', name: 'Nación', color: 'transparent', tooltipColor: '#8B5CF6', type: 'line', tooltipSection: '2026 estimado' },
                { key: 'acc', name: 'Nación', color: '#8B5CF6', type: 'bar', stackId: 's' },
            ]}
            valueFormat="percent"
            showTotal
            tooltipProps={{ active: true, label: '2026' }}
        />);

        expect(markup).toContain('2026 · al 21/10/2026');
        expect(markup).not.toContain('>2026<');
        expect(markup.indexOf('12,3')).toBeLessThan(markup.indexOf('2026 estimado'));
        expect(markup.indexOf('2026 estimado')).toBeLessThan(markup.indexOf('15,2'));
        expect(markup).toContain('border:1px dotted');
        expect(markup).not.toContain('color:transparent');
    });

    it('leaves tooltips without sections or row headers unchanged', () => {
        const markup = renderToStaticMarkup(<ChartTooltip {...props} />);
        expect(markup).toContain('>ENE 26<');
        expect(markup).not.toContain('dotted');
    });

    it('writes a tooltip-only series (invisible in the chart) with its tooltipColor, outlined in white when black', () => {
        const markup = renderToStaticMarkup(<ChartTooltip
            chartData={[{ fecha: '2026', ghost: 15.2 }]}
            areaConfigs={[{ key: 'ghost', name: 'Nación anualizado', color: 'transparent', tooltipColor: '#000000', type: 'line' }]}
            valueFormat="percent"
            tooltipProps={{ active: true, label: '2026' }}
        />);

        expect(markup).not.toContain('color:transparent');
        expect(markup).toContain('color:#000000');
        expect(markup).toContain('-webkit-text-stroke:3px rgba(255, 255, 255, 0.9)');
    });

    it('uses a light outward outline for near-black series text', () => {
        const markup = renderToStaticMarkup(<ChartTooltip
            chartData={[{ fecha: 'ENE 26', negro: 95.4 }]}
            areaConfigs={[{ key: 'negro', name: 'PA [IS negro/IPCC]', color: '#000000', type: 'line' }]}
            valueFormat="index"
            tooltipProps={{ active: true, label: 'ENE 26' }}
        />);

        expect(markup).toContain('color:#000000');
        expect(markup).toContain('-webkit-text-stroke:3px rgba(255, 255, 255, 0.9)');
        expect(markup).toContain('paint-order:stroke fill');
        expect(markup).not.toContain('background-color:rgba(255, 255, 255, 0.9)');
    });

    it('keeps series colors with an outward text outline on the translucent panel', () => {
        const markup = renderToStaticMarkup(<ChartTooltip
            chartData={[{ fecha: 'ENE 26', dark: 95.4 }]}
            areaConfigs={[{ key: 'dark', name: 'Serie oscura', color: '#2E2D2C', type: 'line' }]}
            valueFormat="index"
            tooltipProps={{ active: true, label: 'ENE 26' }}
        />);

        expect(markup).toContain('color:#2E2D2C');
        expect(markup).toContain('-webkit-text-stroke:3px rgba(0, 0, 0, 0.85)');
        expect(markup).toContain('paint-order:stroke fill');
        expect(markup).toContain('background-color:rgba(11, 20, 38, 0.4)');
    });

    it('hides totals by default for stacked series', () => {
        const markup = renderToStaticMarkup(<ChartTooltip {...props} />);

        expect(markup).not.toContain('Total:');
        expect(markup).toContain('color:#C9A44C;font-weight:bold');
        expect(markup).toContain('background-color:rgba(11, 20, 38, 0.4)');
    });

    it('shows totals when explicitly enabled', () => {
        expect(renderToStaticMarkup(<ChartTooltip {...props} showTotal />)).toContain('Total: 5,0%');
    });

    it('excludes line series from the stack total', () => {
        const markup = renderToStaticMarkup(<ChartTooltip
            chartData={[{ fecha: '2024', first: 10, second: -6, resultado: 4 }]}
            areaConfigs={[
                { key: 'first', name: 'Recursos', color: '#0f0', type: 'bar', stackId: 'presupuesto' },
                { key: 'second', name: 'Gastos', color: '#f00', type: 'bar', stackId: 'presupuesto' },
                { key: 'resultado', name: 'Resultado financiero', color: '#C9A44C', type: 'line' },
            ]}
            valueFormat="percent"
            tooltipProps={{ active: true, label: '2024' }}
            showTotal
        />);

        expect(markup).toContain('Total: 4,0%');
        expect(markup).toContain('Resultado financiero');
    });

    it('renders line series below a separator instead of mixing them with stacked bars', () => {
        const markup = renderToStaticMarkup(<ChartTooltip
            chartData={[{ fecha: '2024', first: 10, second: -6, resultado: 4 }]}
            areaConfigs={[
                { key: 'first', name: 'Recursos', color: '#0f0', type: 'bar', stackId: 'presupuesto' },
                { key: 'second', name: 'Gastos', color: '#f00', type: 'bar', stackId: 'presupuesto' },
                { key: 'resultado', name: 'Resultado financiero', color: '#C9A44C', type: 'line' },
            ]}
            valueFormat="percent"
            tooltipProps={{ active: true, label: '2024' }}
        />);

        const separatorIndex = markup.indexOf('border-top:1px solid #666');
        const resultadoIndex = markup.indexOf('Resultado financiero');
        const recursosIndex = markup.indexOf('Recursos');

        expect(separatorIndex).toBeGreaterThan(-1);
        expect(recursosIndex).toBeGreaterThan(-1);
        expect(recursosIndex).toBeLessThan(separatorIndex);
        expect(resultadoIndex).toBeGreaterThan(separatorIndex);
        expect(markup).not.toContain('Total:');
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
        expect(markup).toContain('<span style="color:#000000;min-width:0;white-space:normal;overflow-wrap:anywhere;-webkit-text-stroke:3px rgba(255, 255, 255, 0.9);paint-order:stroke fill">Salario informal:');
        expect(markup).toContain('<span style="color:#FFFFFF;min-width:0;white-space:normal;overflow-wrap:anywhere;-webkit-text-stroke:3px rgba(0, 0, 0, 0.85);paint-order:stroke fill">Salario formal:');
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
            areaConfigs={[{ key: 'icg', name: 'ICG', color: '#C9A44C', type: 'line', comparisonMode: 'mandate-month' }]}
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
        expect(markup).toContain('background-color:rgba(11, 20, 38, 0.4)');
        expect(markup).toContain('-webkit-text-stroke:3px rgba(0, 0, 0, 0.85)');
        expect(markup).toContain('paint-order:stroke fill');
        expect(markup).toContain('backdrop-filter:blur(2px)');
    });
});
