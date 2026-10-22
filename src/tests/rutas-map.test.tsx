import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RutasMap from '../components/rutas/RutasMap';
import type { RutaTramo, RutasGeometry } from '@/lib/rutas/status';
import { RUTAS_OFERTAS, seedTramos } from './fixtures/rutas';

afterEach(cleanup);
beforeEach(() => window.localStorage.clear());

const geometry: RutasGeometry = {
    source: {
        routes: 'https://datos.transporte.gob.ar/dataset/rutas-nacionales',
        outline: 'https://apis.datos.gob.ar/georef/api/v2.0/provincias.geojson',
        retrieved: '2026-10-19',
    },
    outline: [[[-70, -50], [-55, -50], [-55, -25], [-70, -25], [-70, -50]]],
    routes: [
        { code: '9', label: 'RN 9', km: 1975.46, lines: [[[-64, -31], [-62, -34]]] },
        { code: '12', label: 'RN 12', km: 1641.76, lines: [[[-58, -27], [-57, -29]]] },
    ],
};

const tramos: RutaTramo[] = [{
    id: 'oriental',
    nombre: 'Tramo Oriental',
    rutas: ['9'],
    km: 320,
    concesionaria: 'Corredores Viales',
    fechaTomaPosesion: '2025-04-01',
    obrasInicialesPct: 15,
    fechaHabilitacionTarifa: null,
    etapa: 'concesionado',
    pavimento: 'regular',
}];

it('switches color mode and shows route, km, concessionaire and status on hover and tap', () => {
    render(<RutasMap tramos={tramos} geometry={geometry} largos={[{ ruta: '9', km: 383, fuente: 'IGN', fuenteUrl: 'https://wms.ign.gob.ar/geoserver/ows' }]} />);

    const route9 = screen.getByRole('button', { name: 'RN 9' });
    const route12 = screen.getByRole('button', { name: 'RN 12' });
    expect(route9.getAttribute('stroke')).toBe('#4ADE80');
    expect(route12.getAttribute('stroke')).toBe('#94A3B8');
    expect(screen.getByRole('list', { name: 'Referencias' }).textContent).toContain('Sin dato');
    expect(screen.getByRole('list', { name: 'Referencias' }).textContent).not.toContain('Malo');
    expect(screen.getByText(/Boletín Oficial/)).toBeDefined();

    const svg = screen.getByRole('group', { name: 'Mapa de rutas nacionales de Argentina' });
    const [, , viewWidth, viewHeight] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
    expect(viewWidth).toBeLessThan(600);
    expect(viewHeight).toBe(1000);
    expect(svg.getAttribute('class') ?? '').not.toContain('min-w-');

    fireEvent.pointerMove(route9);
    const status = screen.getByRole('status');
    expect(screen.getByTestId('rutas-map').contains(status)).toBe(true);
    expect(status.className).not.toContain('fixed');
    expect(status.getAttribute('style')).toContain('rgba(11, 20, 38, 0.4)');
    expect(status.getAttribute('style')).toContain('rgb(201, 164, 76)');
    expect(status.getAttribute('style')).toContain('blur(2px)');
    expect(status.textContent).toContain('RN 9');
    // New contract: a tramo without stored sectors has no section km, so the tooltip shows the route's stored length.
    expect(status.textContent).toContain('Km: 383 km');
    expect(status.textContent).not.toContain(' de ');
    expect(status.textContent).toContain('Corredores Viales');
    expect(status.textContent).toContain('Concesionado');
    expect(status.textContent).toContain('Tramo Oriental');

    fireEvent.pointerLeave(route9);
    expect(screen.queryByRole('status')).toBeNull();

    fireEvent.click(route9);
    fireEvent.pointerLeave(route9);
    expect(screen.getByRole('status').textContent).toContain('Corredores Viales');

    fireEvent.click(screen.getByRole('button', { name: 'Pavimento' }));
    expect(route9.getAttribute('stroke')).toBe('#FBBF24');
    expect(screen.getByRole('list', { name: 'Referencias' }).textContent).toContain('Malo');
    expect(screen.getByText(/2023-2024/)).toBeDefined();
    expect(screen.getByRole('status').textContent).toContain('Regular');

    fireEvent.click(screen.getByRole('button', { name: /Fuentes y metodología/ }));
    expect(document.body.textContent).toContain('https://datos.transporte.gob.ar/dataset/rutas-nacionales');
    expect(document.body.textContent).toContain('https://sigvial.vialidad.gob.ar/geoserver/dnv/ows');
});

it('shows a visible tooltip for a seed route and for a route without a tramo', () => {
    const seeded: RutasGeometry = {
        ...geometry,
        routes: [
            { code: '5', label: 'RN 5', km: 606.65, lines: [[[-65, -36], [-63, -37]]] },
            { code: '40', label: 'RN 40', km: 5080.16, lines: [[[-68, -30], [-67, -40]]] },
        ],
    };
    render(<RutasMap tramos={seedTramos()} ofertas={RUTAS_OFERTAS} geometry={seeded} />);

    const frame = screen.getByTestId('rutas-map');
    const route5 = screen.getByRole('button', { name: 'RN 5' });
    const [hit, casing, visible] = route5.querySelectorAll('path');
    expect(hit?.getAttribute('pointer-events')).toBe('stroke');
    expect(Number(hit?.getAttribute('stroke-width'))).toBeGreaterThan(Number(visible?.getAttribute('stroke-width')));
    expect(Number(hit?.getAttribute('stroke-width'))).toBeLessThanOrEqual(6);
    expect(hit?.getAttribute('stroke')).toBe('transparent');
    expect(casing?.getAttribute('stroke')).toBe('#020617');
    expect(Number(casing?.getAttribute('stroke-width'))).toBeGreaterThan(Number(visible?.getAttribute('stroke-width')));
    expect(visible?.getAttribute('pointer-events')).toBe('none');
    const route40 = screen.getByRole('button', { name: 'RN 40' });
    const [, casing40, visible40] = route40.querySelectorAll('path');
    expect(visible?.getAttribute('stroke-width')).toBe('1.5');
    expect(visible40?.getAttribute('stroke-width')).toBe(visible?.getAttribute('stroke-width'));
    expect(casing?.getAttribute('stroke-width')).toBe(casing40?.getAttribute('stroke-width'));

    fireEvent.pointerMove(route5);
    const tooltip = screen.getByRole('status');
    expect(frame.contains(tooltip)).toBe(true);
    expect(tooltip.className).not.toContain('fixed');
    expect(tooltip.getAttribute('style')).toContain('rgba(11, 20, 38, 0.4)');
    expect(tooltip.getAttribute('style')).toContain('rgb(201, 164, 76)');
    expect(tooltip.textContent).toContain('RN 5');
    expect(tooltip.textContent).toContain('Pampa');
    expect(tooltip.textContent).toContain('CORREDOR VIAL 5 S.A.U.');
    expect(tooltip.textContent).toContain('Concesionado');
    expect(tooltip.textContent).toMatch(/Km: 547 km de [\d.]+ km/);
    expect(tooltip.textContent).toContain('Tarifa ofertada: $2.355,37 sin IVA');
    expect(tooltip.textContent).toContain('Ofertas: 6 ($2.355,37 – $3.354)');
    for (const name of ['Tarifa ofertada: ', 'Ofertas: ']) {
        const line = [...tooltip.children].find(child => child.textContent?.startsWith(name))!;
        expect([...line.querySelectorAll('span')].map(span => span.style.color)).toEqual(['var(--color-imperial-gold)', 'var(--color-imperial-gold)']);
    }

    fireEvent.pointerMove(screen.getByRole('button', { name: 'RN 40' }));
    expect(tooltip.textContent).toContain('RN 40');
    expect(tooltip.textContent).toContain('Sin dato');
    // New contract: a route without a tramo shows its own trace length, not the final milestone.
    expect(tooltip.textContent).toMatch(/Km: [\d.]+ km$/);

    fireEvent.click(screen.getByRole('button', { name: 'Pavimento' }));
    expect(tooltip.textContent).toContain('Sin dato');
    expect(tooltip.textContent).not.toContain('Concesionado');
});

it('lists one shield per route and colors only the stretch each company operates', () => {
    const shared: RutasGeometry = {
        ...geometry,
        routes: [
            { code: '9', label: 'RN 9', km: 1000, lines: [[[-64, -40], [-64, -20]]] },
            { code: '12', label: 'RN 12', km: 1000, lines: [[[-58, -30], [-57, -28]]] },
        ],
    };
    const rows: RutaTramo[] = [
        { ...tramos[0], id: 'sur', rutas: ['9'], concesionaria: 'CREDITECH S.A. - PLANTEL S.A.', sectores: [{ ruta: '9', desdeKm: 0, hastaKm: 200, km: 200 }] },
        { ...tramos[0], id: 'norte', rutas: ['9', '12'], concesionaria: 'CPC S.A.', sectores: [{ ruta: '9', desdeKm: 800, hastaKm: 1000, km: 200 }, { ruta: '12', desdeKm: 0, hastaKm: 1000, km: 1000 }] },
    ];
    render(<RutasMap tramos={rows} geometry={shared} />);

    const filter = screen.getByRole('combobox', { name: 'Filtrar por' }) as HTMLSelectElement;
    const routesAside = screen.getByRole('complementary', { name: 'Rutas' });
    expect(routesAside.contains(filter)).toBe(true);
    expect(routesAside.className).toContain('route-scroll');
    expect(screen.getByRole('group', { name: 'Modo de color' }).contains(filter)).toBe(false);
    expect(filter.value).toBe('ninguno');
    expect(screen.queryByRole('button', { name: 'Escudo RN 9' })).toBeNull();
    expect(screen.getByRole('option', { name: 'Concesionaria' })).toBeTruthy();
    const map9 = screen.getByRole('button', { name: 'RN 9' });
    const map12 = screen.getByRole('button', { name: 'RN 12' });
    const creditechOnMap = map9.querySelector('[data-company="CREDITECH S.A. - PLANTEL S.A."] path[stroke-width="1.5"]')?.getAttribute('stroke');
    const cpcOnMap = map9.querySelector('[data-company="CPC S.A."] path[stroke-width="1.5"]')?.getAttribute('stroke');
    expect(creditechOnMap).toBe('#4ADE80');
    expect(cpcOnMap).toBe('#4ADE80');
    fireEvent.pointerMove(map9.querySelector('[data-company="CREDITECH S.A. - PLANTEL S.A."]')!);
    expect(screen.getByRole('status').textContent).toContain('CREDITECH S.A. - PLANTEL S.A.');
    expect(screen.getByRole('status').textContent).not.toContain('CPC S.A.');
    expect(map9.querySelector('[data-company="CREDITECH S.A. - PLANTEL S.A."]')?.getAttribute('data-marked')).toBe('true');
    const hovered = map9.querySelector('[data-company="CREDITECH S.A. - PLANTEL S.A."]') as SVGGElement;
    expect(hovered.style.filter).toBe('');
    expect((hovered.querySelector('path[data-fill]') as SVGPathElement).style.filter).toBe('brightness(1.6)');
    expect(hovered.querySelector('path[data-fill]')?.getAttribute('stroke-width')).toBe(hovered.parentElement!.querySelector('[data-company]:not([data-marked]) path[data-fill]')?.getAttribute('stroke-width') ?? '1.5');
    expect(map9.querySelector('[data-company="CPC S.A."]')?.hasAttribute('data-marked')).toBe(false);
    fireEvent.pointerLeave(map9);
    expect(map9.querySelector('[data-company="CREDITECH S.A. - PLANTEL S.A."]')?.hasAttribute('data-marked')).toBe(false);
    expect(screen.getByRole('list', { name: 'Referencias' }).textContent).toContain('Concesionado');
    expect(screen.getByRole('list', { name: 'Referencias' }).textContent).not.toContain('CPC S.A.');
    const gap9 = document.querySelector('[data-route="9"][data-company="Sin dato"]');
    expect(gap9?.getAttribute('opacity')).toBe('0.5');
    expect(map9.compareDocumentPosition(gap9 as Node) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();

    fireEvent.change(filter, { target: { value: 'ruta' } });
    expect(screen.getByRole('list', { name: 'Referencias' }).textContent).not.toContain('Concesionado');
    const shield9 = screen.getByRole('button', { name: 'Escudo RN 9' });
    const shield12 = screen.getByRole('button', { name: 'Escudo RN 12' });
    expect(shield9.className).toContain('justify-center');
    expect(shield9.querySelector('[data-sign="nacional"]')?.getAttribute('class')).toContain('h-16');
    expect(shield9.querySelector('[data-sign="nacional"] path')).toBeTruthy();
    expect(screen.queryByText('CREDITECH S.A. - PLANTEL S.A.')).toBeNull();

    fireEvent.click(shield9);
    const routeCompanies = screen.getByRole('list', { name: 'Concesionarias de RN 9' });
    expect(routesAside.contains(routeCompanies)).toBe(true);
    expect(routeCompanies.textContent).toContain('CREDITECH S.A. - PLANTEL S.A.');
    expect(routeCompanies.textContent).toContain('CPC S.A.');
    expect(screen.queryByRole('list', { name: 'Concesionarias de RN 12' })).toBeNull();
    const creditechColor = routeCompanies.querySelector('[data-company-color]')?.getAttribute('data-company-color');
    const cpcColor = [...routeCompanies.querySelectorAll('li')].find(item => item.textContent?.includes('CPC S.A.'))?.querySelector('[data-company-color]')?.getAttribute('data-company-color');
    expect(creditechColor).toBeTruthy();
    expect(cpcColor).toBeTruthy();
    expect(creditechColor).not.toBe(cpcColor);
    expect(map9.querySelector('[data-company="CREDITECH S.A. - PLANTEL S.A."] path[stroke-width="1.5"]')?.getAttribute('stroke')).toBe(map9.querySelector('[data-company="CPC S.A."] path[stroke-width="1.5"]')?.getAttribute('stroke'));
    expect(map9.querySelector('[data-company="CPC S.A."] path[stroke-width="1.5"]')?.getAttribute('stroke')).not.toBe(cpcColor);
    expect(map9.getAttribute('opacity')).toBe('1');
    expect(Number(map12.getAttribute('opacity'))).toBeLessThan(0.5);

    fireEvent.click(shield12);
    expect(map12.getAttribute('opacity')).toBe('1');
    fireEvent.click(shield9);
    fireEvent.click(shield12);
    expect(screen.queryByRole('list', { name: 'Concesionarias de RN 9' })).toBeNull();
    expect(map9.getAttribute('opacity')).toBe('1');
    expect(map12.getAttribute('opacity')).toBe('1');

    fireEvent.change(filter, { target: { value: 'concesionaria' } });
    expect(screen.queryByRole('button', { name: 'Escudo RN 9' })).toBeNull();
    const creditechButton = screen.getByRole('button', { name: 'Concesionaria CREDITECH S.A. - PLANTEL S.A.' });
    expect(creditechButton.className).toContain('h-8');
    expect(creditechButton.querySelector('[data-company-color]')?.getAttribute('data-company-color')).toBe(creditechColor);
    expect(screen.queryByText('RN 9')).toBeNull();

    fireEvent.click(creditechButton);
    const companyRoutes = screen.getByRole('list', { name: 'Rutas de CREDITECH S.A. - PLANTEL S.A.' });
    expect(routesAside.contains(companyRoutes)).toBe(true);
    expect(companyRoutes.textContent).toContain('9');
    expect(companyRoutes.textContent).not.toContain('12');
    const routeLegend = screen.getByText('RN 9').closest('li');
    expect(routeLegend?.querySelector('[data-company-color]')?.getAttribute('data-company-color')).toBe(creditechColor);
    expect(screen.queryByText('RN 12')).toBeNull();
    expect(map9.querySelector('[data-company="CREDITECH S.A. - PLANTEL S.A."]')?.getAttribute('opacity')).toBe('1');
    expect(Number(map9.querySelector('[data-company="CPC S.A."]')?.getAttribute('opacity'))).toBeLessThan(0.5);
    expect(Number(map12.querySelector('[data-company="CPC S.A."]')?.getAttribute('opacity'))).toBeLessThan(0.5);

    fireEvent.click(creditechButton);
    expect(screen.queryByRole('list', { name: 'Rutas de CREDITECH S.A. - PLANTEL S.A.' })).toBeNull();
    expect(map9.querySelector('[data-company="CPC S.A."]')?.getAttribute('opacity')).toBe('1');
    expect(map12.querySelector('[data-company="CPC S.A."]')?.getAttribute('opacity')).toBe('1');
});

it('shares one tramo selection between map clicks and the sidebar', () => {
    const shared: RutasGeometry = {
        ...geometry,
        routes: [
            { code: '9', label: 'RN 9', km: 1000, lines: [[[-64, -40], [-64, -20]]] },
            { code: '12', label: 'RN 12', km: 1000, lines: [[[-58, -30], [-57, -28]]] },
        ],
    };
    const rows: RutaTramo[] = [
        { ...tramos[0], id: 'sur', rutas: ['9'], concesionaria: 'CREDITECH', sectores: [{ ruta: '9', desdeKm: 0, hastaKm: 200, km: 200 }] },
        { ...tramos[0], id: 'norte', rutas: ['9', '12'], concesionaria: 'CPC', sectores: [{ ruta: '9', desdeKm: 800, hastaKm: 1000, km: 200 }, { ruta: '12', desdeKm: 0, hastaKm: 1000, km: 1000 }] },
    ];
    render(<RutasMap tramos={rows} geometry={shared} />);
    const map9 = screen.getByRole('button', { name: 'RN 9' });
    const map12 = screen.getByRole('button', { name: 'RN 12' });
    const seg = (route: HTMLElement, company: string) => route.querySelector(`[data-company="${company}"]`)!;
    const filter = screen.getByRole('combobox', { name: 'Filtrar por' });

    fireEvent.click(seg(map9, 'CREDITECH'));
    expect(seg(map9, 'CREDITECH').getAttribute('data-picked')).toBe('true');
    expect(seg(map9, 'CREDITECH').querySelector('path[data-outline]')).toBeNull();
    expect((seg(map9, 'CREDITECH') as SVGGElement).style.filter).toBe('');
    expect((seg(map9, 'CREDITECH').querySelector('path[data-fill]') as SVGPathElement).style.filter).toBe('brightness(1.6) drop-shadow(0 0 1.5px #ffffff)');
    expect(seg(map9, 'CPC').hasAttribute('data-picked')).toBe(false);
    expect(screen.queryByRole('list', { name: 'Concesionarias de RN 9' })).toBeNull();

    fireEvent.change(filter, { target: { value: 'ruta' } });
    const fill = (company: string) => seg(map9, company).querySelector('path[data-fill]')!.getAttribute('stroke');
    expect(fill('CREDITECH')).toBe(fill('CPC'));
    expect(fill('CREDITECH')).not.toBe(seg(map12, 'CPC').querySelector('path[data-fill]')!.getAttribute('stroke'));
    fireEvent.click(seg(map9, 'CREDITECH'));
    expect(screen.getByRole('button', { name: 'Escudo RN 9' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Seleccionar CREDITECH en RN 9' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar CPC en RN 9' }));
    expect(seg(map9, 'CPC').getAttribute('data-picked')).toBe('true');
    expect(seg(map9, 'CPC').getAttribute('opacity')).toBe('1');
    expect(Number(seg(map9, 'CREDITECH').getAttribute('opacity'))).toBeLessThan(0.5);
    expect(Number(seg(map12, 'CPC').getAttribute('opacity'))).toBeLessThan(0.5);

    fireEvent.change(filter, { target: { value: 'concesionaria' } });
    fireEvent.click(screen.getByRole('button', { name: 'Concesionaria CPC' }));
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar RN 12 de CPC' }));
    expect(seg(map12, 'CPC').getAttribute('data-picked')).toBe('true');
    expect(Number(seg(map9, 'CPC').getAttribute('opacity'))).toBeLessThan(0.5);

    fireEvent.click(seg(map9, 'CREDITECH'));
    expect(screen.getByRole('button', { name: 'Concesionaria CREDITECH' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Seleccionar RN 9 de CREDITECH' }).getAttribute('aria-pressed')).toBe('true');
});

it('a second click on the same tramo clears the selection and leaves no gold halo', () => {
    const { container } = render(<RutasMap tramos={tramos} geometry={geometry} />);
    const picked = () => container.querySelectorAll('[data-picked="true"]');
    const halos = () => [...container.querySelectorAll('path')].filter(path => path.getAttribute('stroke') === '#C9A44C' && !path.getAttribute('fill'));
    const segment = container.querySelector('[data-company]:not([data-company="Sin dato"])')!;
    fireEvent.click(segment);
    expect(picked()).toHaveLength(1);
    expect(halos()).toHaveLength(0);
    fireEvent.click(segment);
    expect(picked()).toHaveLength(0);
    expect(container.querySelector('[data-marked="true"]')).toBeNull();
});

it('shows the concession stage legend when the filter is Ninguno', () => {
    render(<RutasMap tramos={tramos} geometry={geometry} />);
    const legend = screen.getByRole('list', { name: 'Referencias' });
    expect(legend.textContent).toContain('Concesionado');
    expect(legend.textContent).toContain('En licitación');
    expect(legend.textContent).toContain('Sin concesionar');
    expect(legend.textContent).toContain('Sin dato');
});

it('remembers mode, filter and selection in localStorage like the other indicators', () => {
    window.localStorage.clear();
    const first = render(<RutasMap tramos={tramos} geometry={geometry} />);
    fireEvent.click(screen.getByRole('button', { name: 'Pavimento' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por' }), { target: { value: 'ruta' } });
    first.unmount();
    render(<RutasMap tramos={tramos} geometry={geometry} />);
    expect((screen.getByRole('combobox', { name: 'Filtrar por' }) as HTMLSelectElement).value).toBe('ruta');
    expect(screen.getByRole('button', { name: 'Pavimento' }).className).toContain('bg-imperial-gold');
    window.localStorage.clear();
});

it('with the Ruta filter, stretches without a concession stay dashed in the route color', () => {
    const { container } = render(<RutasMap tramos={tramos} geometry={geometry} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por' }), { target: { value: 'ruta' } });
    const gap = container.querySelector('[data-company="Sin dato"]') as SVGGElement;
    const known = container.querySelector(`[data-route="${gap.getAttribute('data-route')}"][data-company]:not([data-company="Sin dato"])`) as SVGGElement | null;
    expect(gap.querySelector('path[data-fill]')?.getAttribute('stroke-dasharray')).toBeTruthy();
    if (known) {
        expect(known.querySelector('path[data-fill]')?.hasAttribute('stroke-dasharray')).toBe(false);
        expect(gap.querySelector('path[data-fill]')?.getAttribute('stroke')).toBe(known.querySelector('path[data-fill]')?.getAttribute('stroke'));
    }
});

it('restores a picked tramo after a reload, also under StrictMode', () => {
    const first = render(<RutasMap tramos={tramos} geometry={geometry} />);
    const segment = first.container.querySelector('[data-company]:not([data-company="Sin dato"])')!;
    const company = segment.getAttribute('data-company');
    fireEvent.click(segment);
    first.unmount();
    const { container } = render(<StrictMode><RutasMap tramos={tramos} geometry={geometry} /></StrictMode>);
    expect(container.querySelector('[data-picked="true"]')?.getAttribute('data-company')).toBe(company);
});

describe('selection tooltip', () => {
    const pickSegment = (container: HTMLElement) => container.querySelector('[data-company="Corredores Viales"]')!;

    it('on desktop shows the tooltip of the persisted pick, also after a reload, and hides it once deselected', () => {
        const first = render(<RutasMap tramos={tramos} geometry={geometry} />);
        fireEvent.click(pickSegment(first.container));
        fireEvent.pointerLeave(pickSegment(first.container));
        expect(screen.getByRole('status').textContent).toContain('Corredores Viales');
        first.unmount();

        const { container } = render(<RutasMap tramos={tramos} geometry={geometry} />);
        expect(screen.getByRole('status').textContent).toContain('Corredores Viales');
        fireEvent.click(pickSegment(container));
        expect(screen.queryByRole('status')).toBeNull();
    });

    it('a sidebar pick shows its tooltip on desktop', () => {
        render(<RutasMap tramos={tramos} geometry={geometry} />);
        fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por' }), { target: { value: 'ruta' } });
        fireEvent.click(screen.getByRole('button', { name: 'Escudo RN 9' }));
        fireEvent.click(screen.getByRole('button', { name: 'Seleccionar Corredores Viales en RN 9' }));
        expect(screen.getByRole('status').textContent).toContain('Corredores Viales');
    });

    it('Enter on a route selects its tramo and shows the tooltip', () => {
        const { container } = render(<RutasMap tramos={tramos} geometry={geometry} />);
        fireEvent.keyDown(screen.getByRole('button', { name: 'RN 9' }), { key: 'Enter' });
        expect(container.querySelector('[data-picked="true"]')?.getAttribute('data-company')).toBe('Corredores Viales');
        expect(screen.getByRole('status').textContent).toContain('Corredores Viales');
    });

    it('never pins the tooltip on touch, even with a persisted pick', () => {
        window.localStorage.setItem('monitorcillo:chart:rutas-nacionales', JSON.stringify({ mode: 'concesion', filterBy: 'ninguno', selected: [], pick: { code: '9', company: 'Corredores Viales' } }));
        const { container } = render(<RutasMap tramos={tramos} geometry={geometry} />);
        const svg = screen.getByRole('group', { name: 'Mapa de rutas nacionales de Argentina' });
        fireEvent.pointerDown(svg, { pointerType: 'touch', clientX: 1, clientY: 1, pointerId: 1 });
        fireEvent.pointerUp(svg, { pointerType: 'touch', clientX: 1, clientY: 1, pointerId: 1 });
        expect(container.querySelector('[data-picked="true"]')).not.toBeNull();
        expect(screen.queryByRole('status')).toBeNull();
    });
});

const red = { km: 40198, fuente: 'Gobierno nacional / Vialidad Nacional, 8-jul-2025', fuenteUrl: 'https://example.com/red' };

it('divides the concessioned km by the stored national network total', () => {
    render(<RutasMap tramos={tramos} geometry={geometry} red={red} />);
    expect(screen.getByTestId('concession-share').textContent).toMatch(/4,9\s?%/);
});

it('shows only the concessioned km when the network total is not stored', () => {
    render(<RutasMap tramos={tramos} geometry={geometry} />);
    const share = screen.getByTestId('concession-share');
    expect(share.textContent).not.toContain('%');
    expect(share.textContent).toMatch(/1\.975 km/);
});

it('cites the network total source in the methodology', () => {
    render(<RutasMap tramos={tramos} geometry={geometry} red={red} />);
    fireEvent.click(screen.getByRole('button', { name: /Fuentes y metodología/ }));
    expect(document.body.textContent).toContain('40.198 km');
    expect(document.body.textContent).toContain(red.fuente);
    expect(document.body.textContent).toContain(red.fuenteUrl);
});

it('shows a big concessioned-share figure only in the unfiltered concession view', () => {
    render(<RutasMap tramos={tramos} geometry={geometry} red={red} />);
    expect(screen.getByTestId('concession-share').textContent).toMatch(/\d+(,\d)?\s?%/);
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por' }), { target: { value: 'ruta' } });
    expect(screen.queryByTestId('concession-share')).toBeNull();
});

describe('touch crosshair', () => {
    beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
    afterEach(() => vi.useRealTimers());
    const touchSetup = () => {
        const utils = render(<RutasMap tramos={tramos} geometry={geometry} />);
        const svg = screen.getByRole('group', { name: 'Mapa de rutas nacionales de Argentina' }) as unknown as SVGSVGElement;
        Object.assign(svg, { getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) });
        const segment = utils.container.querySelector('[data-company]:not([data-company="Sin dato"]) path') as SVGPathElement;
        const [x, y] = segment.getAttribute('d')!.match(/-?[\d.]+/g)!.map(Number);
        return { ...utils, svg, x, y };
    };
    const touch = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', target: Element, clientX: number, clientY: number) => fireEvent[type](target, { pointerType: 'touch', clientX, clientY, pointerId: 1 });
    const longPress = (target: Element, clientX: number, clientY: number) => {
        touch('pointerDown', target, clientX, clientY);
        act(() => { vi.advanceTimersByTime(500); });
        touch('pointerUp', target, clientX, clientY);
    };

    it('a long press shows a dotted crosshair and hovers the tramo under it, without pinning or selecting', () => {
        const { container, svg, x, y } = touchSetup();
        longPress(svg, x, y);
        fireEvent.click(svg);
        const lines = container.querySelectorAll('[data-crosshair] line');
        expect(lines).toHaveLength(2);
        expect(lines[0].getAttribute('stroke-dasharray')).toBe('2 3');
        expect(screen.getByRole('status')).toBeDefined();
        expect(container.querySelector('[data-marked="true"]')).not.toBeNull();
        expect(container.querySelector('[data-picked="true"]')).toBeNull();
    });

    it('a short tap does nothing; a long press off the continent also activates it', () => {
        const { container, svg } = touchSetup();
        touch('pointerDown', svg, 1, 1);
        touch('pointerUp', svg, 1, 1);
        act(() => { vi.advanceTimersByTime(600); });
        expect(container.querySelector('[data-crosshair]')).toBeNull();
        longPress(svg, 1, 1);
        expect(container.querySelector('[data-crosshair]')).not.toBeNull();
    });

    it('while active, sliding moves it by the finger delta; a simple tap anywhere hides it', () => {
        const { container, svg, x, y } = touchSetup();
        longPress(svg, x, y);
        touch('pointerDown', svg, x, y);
        touch('pointerMove', svg, x + 30, y + 40);
        const vertical = container.querySelector('[data-crosshair] line')!;
        expect(Number(vertical.getAttribute('x1'))).toBeCloseTo(x + 30);
        touch('pointerUp', svg, x + 30, y + 40);
        expect(container.querySelector('[data-crosshair]')).not.toBeNull();
        touch('pointerDown', svg, x, y);
        touch('pointerUp', svg, x, y);
        expect(container.querySelector('[data-crosshair]')).toBeNull();
        longPress(svg, x, y);
        touch('pointerDown', document.body, 5, 5);
        touch('pointerUp', document.body, 5, 5);
        expect(container.querySelector('[data-crosshair]')).toBeNull();
    });

    it('lets the page scroll while inactive and blocks the native long-press menu and selection', () => {
        const { container, svg, x, y } = touchSetup();
        expect(svg.getAttribute('class')).not.toContain('touch-none');
        expect(svg.getAttribute('class')).toContain('touch-pan-y');
        expect(svg.getAttribute('class')).toContain('select-none');
        touch('pointerDown', svg, x, y);
        expect(fireEvent.contextMenu(svg)).toBe(false);
        touch('pointerMove', svg, x, y + 40);
        act(() => { vi.advanceTimersByTime(600); });
        touch('pointerUp', svg, x, y + 40);
        expect(container.querySelector('[data-crosshair]')).toBeNull();
        longPress(svg, x, y);
        expect(svg.getAttribute('class')).toContain('touch-none');
    });

    it('auto-scrolls the page while the crosshair is dragged near the bottom of the viewport', () => {
        const frames: FrameRequestCallback[] = [];
        const raf = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback));
        vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
        let scrolled = 0;
        const scrollBy = vi.spyOn(window, 'scrollBy').mockImplementation(((options: ScrollToOptions) => { scrolled += options.top ?? 0; Object.assign(window, { scrollY: scrolled }); }) as typeof window.scrollBy);
        Object.assign(window, { innerHeight: 800, scrollY: 0 });
        const { container, svg, x, y } = touchSetup();
        longPress(svg, x, y);
        touch('pointerDown', svg, x, y);
        touch('pointerMove', svg, x, y + (790 - y));
        const before = Number(container.querySelector('[data-crosshair] line + line')!.getAttribute('y1'));
        act(() => { frames.shift()?.(0); });
        expect(scrollBy).toHaveBeenCalled();
        expect(scrolled).toBeGreaterThan(0);
        expect(Number(container.querySelector('[data-crosshair] line + line')!.getAttribute('y1'))).toBeGreaterThan(before - 1e-9);
        touch('pointerUp', svg, x, 790);
        const calls = scrollBy.mock.calls.length;
        act(() => { frames.splice(0).forEach(frame => frame(0)); });
        expect(scrollBy.mock.calls.length).toBe(calls);
        raf.mockRestore();
        vi.restoreAllMocks();
    });

    it('a touch tap on a tramo does not toggle the selection', () => {
        const { container, svg, x, y } = touchSetup();
        const segment = container.querySelector('[data-company]:not([data-company="Sin dato"])')!;
        longPress(svg, x, y);
        fireEvent.click(segment);
        expect(container.querySelector('[data-picked="true"]')).toBeNull();
    });
});

it('renders the map without tramos or offers when the tables are empty', () => {
    render(<RutasMap tramos={[]} ofertas={[]} />);
    expect(screen.getByTestId('rutas-map')).toBeTruthy();
});
