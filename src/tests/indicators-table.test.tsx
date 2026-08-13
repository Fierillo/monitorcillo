import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import IndicatorsTable from '@/components/IndicatorsTable';
import { compactText, fitTextToWidth } from '@/components/IndicatorsTable';

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

    it('uses natural content width without truncation on mobile', () => {
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

        expect(markup).toContain('w-max min-w-full');
        expect(markup).toContain('lg:w-[13%]');
        expect(markup).toContain('lg:w-[23%]');
        expect(markup).toContain('Último dato');
        expect(markup).not.toMatch(/class="[^"]*(?<!lg:)overflow-hidden/);
        expect(markup).toContain('block w-max min-w-full whitespace-nowrap lg:w-full lg:min-w-0 lg:overflow-hidden');
    });
});
