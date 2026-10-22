import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IndicatorsTable from '@/components/IndicatorsTable';
import { contrastRatio } from '@/lib/color-contrast';
import type { Indicator } from '@/types';

beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

const row = (id: string, overrides: Partial<Indicator>): Indicator => ({ id, fecha: '1 ENE 26', fuente: 'INDEC', indicador: id, referencia: 'Mes anterior', dato: '1%', ...overrides });

const data: Indicator[] = [
    row('emae', { fecha: 'JUL 26', fuente: 'Ministerio', dato: '10,2%', proximaFecha: '31 AGOSTO 2026' }),
    row('ipc', { fecha: '2025', fuente: 'Ámbito', dato: '-1,5%', proximaFecha: '5 SEPT 26' }),
    row('balanza', { fecha: '31 JUL 26', fuente: 'BCRA', dato: 'USD 2,3 M', proximaFecha: '1 AGO 26' }),
];

const ids = () => screen.getAllByRole('row').slice(1).map(tr => within(tr).getAllByRole('cell')[0].textContent);
const header = (name: RegExp) => screen.getByRole('button', { name });

describe('IndicatorsTable columns and sorting', () => {
    it('shows the metric first, then the source, then the dates', () => {
        render(<IndicatorsTable data={data} />);
        expect(screen.getAllByRole('columnheader').map(th => th.textContent?.replace(/[▲▼]/g, '').trim()))
            .toEqual(['Indicador', 'Fuente', 'Última fecha', 'Próxima', 'Referencia', 'Último dato']);
    });

    it('starts by next date, soonest first, with its wedge shown, until a header is clicked, then toggles text with Spanish collation', () => {
        render(<IndicatorsTable data={[...data, row('sin-proxima', { fecha: '2027' })]} />);
        expect(ids(), 'rows without a next date go last').toEqual(['balanza', 'emae', 'ipc', 'sin-proxima']);
        expect(screen.getAllByRole('columnheader').filter(th => th.hasAttribute('aria-sort')).map(th => [th.textContent, th.getAttribute('aria-sort')]), 'the default date order shows its wedge')
            .toEqual([['Próxima▲', 'ascending']]);

        fireEvent.click(header(/Fuente/));
        expect(ids()).toEqual(['ipc', 'balanza', 'sin-proxima', 'emae']);
        expect(header(/Fuente/).closest('th')?.getAttribute('aria-sort')).toBe('ascending');

        fireEvent.click(header(/Fuente/));
        expect(ids()).toEqual(['emae', 'sin-proxima', 'balanza', 'ipc']);
        expect(header(/Fuente/).closest('th')?.getAttribute('aria-sort')).toBe('descending');
    });

    it('sorts values as numbers and next dates as dates, full month names included', () => {
        render(<IndicatorsTable data={data} />);
        fireEvent.click(header(/Último dato/));
        expect(ids()).toEqual(['ipc', 'balanza', 'emae']);
        fireEvent.click(header(/Próxima/));
        expect(ids()).toEqual(['balanza', 'emae', 'ipc']);
    });

    it('draws the sort indicator with enough contrast on the header background', () => {
        render(<IndicatorsTable data={data} />);
        fireEvent.click(header(/Última fecha/));
        const indicator = header(/Última fecha/).querySelector('[data-sort-indicator]');
        const token = indicator?.className.match(/text-(imperial-[a-z-]+)/)?.[1];
        const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
        const color = (name: string) => css.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`))?.[1] ?? '';
        expect(token, 'sort indicator needs an imperial text color token').toBeTruthy();
        expect(contrastRatio(color(token!), color('imperial-night'))).toBeGreaterThanOrEqual(3);
    });
});

describe('IndicatorsTable next release highlight', () => {
    const upcoming: Indicator[] = [
        row('emision', { daily: true, proximaFecha: '22 OCT 26' }),
        row('pasado', { proximaFecha: '20 OCT 26' }),
        row('icg', { proximaFecha: '23 OCTUBRE 2026' }),
        row('ipc', { proximaFecha: '12 NOV 26' }),
        row('emae', { proximaFecha: '23 OCT 26' }),
    ];
    const highlighted = () => screen.getAllByText('Próximo dato a publicarse').map(label => label.closest('tr')!.querySelector('td')!.textContent?.replace('Próximo dato a publicarse', ''));

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2026-10-22T02:00:00Z')); // 21 OCT 23:00 in Buenos Aires
    });
    afterEach(() => vi.useRealTimers());

    it('pins every soonest upcoming non-daily release first in the default order', () => {
        render(<IndicatorsTable data={upcoming} />);
        expect(highlighted()).toEqual(['icg', 'emae']);
        expect(ids().map(id => id?.replace('Próximo dato a publicarse', ''))).toEqual(['emision', 'icg', 'emae', 'pasado', 'ipc']); // daily first, then the pinned releases
    });

    it('honours a clicked sort without pinning, still marking the rows', () => {
        render(<IndicatorsTable data={upcoming} />);
        fireEvent.click(header(/Indicador/));
        expect(highlighted()).toEqual(['emae', 'icg']);
        expect(ids().map(id => id?.replace('Próximo dato a publicarse', ''))).toEqual(['emae', 'emision', 'icg', 'ipc', 'pasado']);
    });

    it('pins only today\'s releases (Buenos Aires) when there are any, the rest stays as the normal table', () => {
        render(<IndicatorsTable data={[...upcoming, row('fiscal', { proximaFecha: '21 OCT 26' })]} />);
        expect(highlighted()).toEqual(['fiscal']);
        expect(ids().map(id => id?.replace('Próximo dato a publicarse', ''))).toEqual(['emision', 'fiscal', 'pasado', 'icg', 'emae', 'ipc']); // the rest by next date
    });

    it('keeps the «Diaria» rows on top of the date sort in both directions', () => {
        render(<IndicatorsTable data={[row('viejo', { fecha: '1 ENE 25' }), row('bma', { daily: true, fecha: '20 OCT 26' }), row('nuevo', { fecha: '1 OCT 26' })]} />);
        fireEvent.click(header(/Última fecha/));
        expect(header(/Última fecha/).closest('th')?.getAttribute('aria-sort')).toBe('ascending');
        expect(ids().map(id => id?.replace('Próximo dato a publicarse', ''))).toEqual(['bma', 'viejo', 'nuevo']);
        fireEvent.click(header(/Última fecha/));
        expect(ids().map(id => id?.replace('Próximo dato a publicarse', ''))).toEqual(['bma', 'nuevo', 'viejo']);
    });

    it('pins only what was published today even if its next date already rolled over', () => {
        render(<IndicatorsTable data={[...upcoming, row('emae-hoy', { fecha: '21 OCT 26', publishedAt: '2026-10-21', proximaFecha: '21 NOV 26' })]} />);
        expect(highlighted()).toEqual(['emae-hoy']);
    });

    it('shows the data type of the date on hover, clamped to two lines', () => {
        render(<IndicatorsTable data={[row('poder', { fecha: '21 OCT 26', fechaDescription: 'Índice de salarios', proximaFecha: '1 NOV 26', proximaFechaDescription: 'RIPTE' })]} />);
        fireEvent.mouseEnter(screen.getByText('21 OCT 26'));
        expect(screen.getByText('Índice de salarios', { selector: 'div' }).className, 'tooltips stay within two lines').toMatch(/(^|\s)line-clamp-2(\s|$)/);
    });

    it('pulses every cell of the released rows only, all on the page clock so sorting neither restarts nor desyncs them', () => {
        const animations = new Map<Element, { startTime: number | null }>();
        Element.prototype.getAnimations = function (this: Element) {
            if (!animations.has(this)) animations.set(this, { startTime: 500 });
            return [animations.get(this)] as unknown as Animation[];
        };
        render(<IndicatorsTable data={upcoming} />);
        const pulsingRows = () => screen.getAllByRole('row').slice(1).filter(tr => tr.classList.contains('next-release-pulse')).map(tr => tr.querySelector('td')!.textContent?.replace('Próximo dato a publicarse', ''));
        expect(pulsingRows()).toEqual(['icg', 'emae']);
        fireEvent.click(header(/Fuente/));
        expect(pulsingRows().sort()).toEqual(['emae', 'icg']);
        const cells = [...document.querySelectorAll('tr.next-release-pulse td')];
        expect(cells.length).toBe(12);
        expect(cells.every(cell => cell.getAnimations()[0].startTime === 0)).toBe(true);
        delete (Element.prototype as Partial<Element>).getAnimations;
    });

    it('pulses by fading, never overriding a cell colour, and stays still for reduced motion', () => {
        const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
        const keyframes = css.match(/@keyframes next-release-pulse\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
        expect(keyframes, 'the pulse must not override column colours').not.toMatch(/(?<!-)color\s*:/);
        const opacities = [...keyframes.matchAll(/opacity:\s*([\d.]+)/g)].map(match => Number(match[1]));
        expect(Math.min(...opacities), 'faded text stays readable').toBeGreaterThanOrEqual(0.4);
        expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.next-release-pulse td\s*\{\s*animation:\s*none;\s*\}/);
    });
});
