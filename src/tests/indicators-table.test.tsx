import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import IndicatorsTable from '@/components/IndicatorsTable';
import { compactText, fitTextToWidth, sortIndicators } from '@/components/IndicatorsTable';

function constrainedText(textWidth: number, availableWidth: number, initialFontSize = 16): HTMLElement {
    const element = document.createElement('span');
    let fontSize = initialFontSize;

    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ fontSize: `${initialFontSize}px` } as CSSStyleDeclaration);
    Object.defineProperty(element, 'clientWidth', { value: availableWidth });
    Object.defineProperty(element, 'scrollWidth', {
        get: () => {
            fontSize = Number.parseFloat(element.style.fontSize) || initialFontSize;
            return textWidth * fontSize / initialFontSize;
        },
    });

    return element;
}

describe('IndicatorsTable text fitting', () => {
    it('simplifies known long labels before rendering', () => {
        expect(compactText('Poder adquisitivo (ajustado por IPC nucleo)')).toBe('Poder adquisitivo');
        expect(compactText('USD 46.708 M aprobados')).toBe('USD 46.708 M');
    });

    it('reduces overflowing text until it fits its cell', () => {
        const element = constrainedText(240, 120);

        fitTextToWidth(element);

        expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
        expect(Number.parseFloat(element.style.fontSize)).toBeLessThan(16);
    });

    it('does not reduce text that already fits', () => {
        const element = constrainedText(100, 120);

        fitTextToWidth(element);

        expect(element.scrollWidth).toBeLessThanOrEqual(element.clientWidth);
        expect(element.style.fontSize).toBe('');
    });

    it('sorts annual, monthly and daily dates from oldest to newest', () => {
        const indicator = { fuente: 'Fuente', indicador: 'Indicador', referencia: 'Referencia', dato: 'Dato' };
        const sorted = sortIndicators([
            { ...indicator, id: 'unknown', fecha: '-' },
            { ...indicator, id: 'daily', fecha: '31 JUL 26' },
            { ...indicator, id: 'annual', fecha: '2025' },
            { ...indicator, id: 'fallback', fecha: 'Feb-26' },
            { ...indicator, id: 'monthly', fecha: 'FEB 26' },
        ], { key: 'fecha', direction: 'ascending' });

        expect(sorted.map(row => row.id)).toEqual(['annual', 'fallback', 'monthly', 'daily', 'unknown']);
    });

    it('never truncates cell text on mobile', () => {
        const markup = renderToStaticMarkup(<IndicatorsTable data={[{
            id: 'test',
            fecha: '31 JUL 26',
            proximaFecha: '31 AGOSTO 2026',
            fuente: 'Una fuente oficial extremadamente extensa',
            indicador: 'Un indicador extremadamente extenso que debe reducirse',
            referencia: 'Una referencia extremadamente extensa que debe reducirse',
            dato: 'USD 123.456.789 M aprobados',
            hasDetails: true,
        }]} />);

        expect(markup).toContain('Un indicador extremadamente extenso que debe reducirse');
        expect(markup).not.toMatch(/\b(truncate|text-ellipsis|line-clamp-1)\b/);
        expect(markup).not.toMatch(/class="[^"]*(?<!lg:)overflow-hidden/);
    });

    it('marks estimated next dates with an asterisk explained by a footnote below the table', () => {
        const row = { id: 'deuda', fecha: '1 SEPT 26', proximaFecha: '15 NOV 26', fuente: 'Finanzas', indicador: 'Deuda', referencia: '-', dato: '1', hasDetails: false };
        const estimated = renderToStaticMarkup(<IndicatorsTable data={[{ ...row, proximaEstimada: true }]} />);
        expect(estimated).toContain('15 NOV 26*');
        expect(estimated).toContain('* Fecha estimada: la fuente no publica calendario propio.');
        const official = renderToStaticMarkup(<IndicatorsTable data={[row]} />);
        expect(official).not.toContain('15 NOV 26*');
        expect(official).not.toContain('Fecha estimada');
    });

    it('shows «Diaria» as Fecha and «-» as Próxima for daily indicators, and lists them first in the date order', () => {
        const base = { fuente: 'BCRA', referencia: '-', dato: '1', hasDetails: false };
        const daily = { ...base, id: 'bma', indicador: 'BMA', fecha: '20 OCT 26', proximaFecha: '21 OCT 26', proximaEstimada: true, daily: true };
        const monthly = { ...base, id: 'ipc', indicador: 'IPC', fecha: '1 SEPT 26', proximaFecha: '5 NOV 26' };
        const markup = renderToStaticMarkup(<IndicatorsTable data={[daily, monthly]} />);
        expect(markup).toContain('>Diaria<');
        expect(markup).not.toContain('20 OCT 26');
        expect(markup).not.toContain('21 OCT 26');
        expect(markup).not.toContain('Fecha estimada');
        expect(sortIndicators([monthly, daily], { key: 'fecha', direction: 'ascending' }).map(row => row.id), '«Diaria» rows go first').toEqual(['bma', 'ipc']);
    });
});
