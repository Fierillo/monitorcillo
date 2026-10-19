import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import RutasMap from '../components/rutas/RutasMap';
import type { RutaTramo, RutasGeometry } from '@/lib/rutas/status';
import { seedTramos } from '@/lib/rutas/seed';

afterEach(cleanup);

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
    render(<RutasMap tramos={tramos} geometry={geometry} />);

    const route9 = screen.getByRole('button', { name: 'RN 9' });
    const route12 = screen.getByRole('button', { name: 'RN 12' });
    expect(route9.getAttribute('stroke')).toBe('#4ADE80');
    expect(route12.getAttribute('stroke')).toBe('#94A3B8');
    expect(screen.getByRole('list', { name: 'Referencias' }).textContent).toContain('En licitación');
    expect(screen.getByRole('list', { name: 'Referencias' }).textContent).not.toContain('Malo');
    expect(screen.getByText(/Boletín Oficial/)).toBeDefined();

    const svg = screen.getByRole('group', { name: 'Mapa de rutas nacionales de Argentina' });
    const [, , viewWidth, viewHeight] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number);
    expect(viewWidth).toBeLessThan(600);
    expect(viewHeight).toBe(1000);
    expect(svg.getAttribute('class') ?? '').not.toContain('min-w-');

    fireEvent.pointerEnter(route9);
    const status = screen.getByRole('status');
    expect(screen.getByTestId('rutas-map').contains(status)).toBe(true);
    expect(status.className).not.toContain('fixed');
    expect(status.getAttribute('style')).toContain('rgba(0, 20, 63, 0.4)');
    expect(status.getAttribute('style')).toContain('rgb(255, 215, 0)');
    expect(status.getAttribute('style')).toContain('blur(2px)');
    expect(status.textContent).toContain('RN 9');
    expect(status.textContent).toContain('320 km');
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
    render(<RutasMap tramos={seedTramos()} geometry={seeded} />);

    const frame = screen.getByTestId('rutas-map');
    const route5 = screen.getByRole('button', { name: 'RN 5' });
    const [hit, casing, visible] = route5.querySelectorAll('path');
    expect(hit?.getAttribute('pointer-events')).toBe('stroke');
    expect(Number(hit?.getAttribute('stroke-width'))).toBeGreaterThanOrEqual(16);
    expect(hit?.getAttribute('stroke')).toBe('transparent');
    expect(casing?.getAttribute('stroke')).toBe('#020617');
    expect(Number(casing?.getAttribute('stroke-width'))).toBeGreaterThan(Number(visible?.getAttribute('stroke-width')));
    expect(visible?.getAttribute('pointer-events')).toBe('none');

    fireEvent.pointerEnter(route5);
    const tooltip = screen.getByRole('status');
    expect(frame.contains(tooltip)).toBe(true);
    expect(tooltip.className).not.toContain('fixed');
    expect(tooltip.getAttribute('style')).toContain('rgba(0, 20, 63, 0.4)');
    expect(tooltip.getAttribute('style')).toContain('rgb(255, 215, 0)');
    expect(tooltip.textContent).toContain('RN 5');
    expect(tooltip.textContent).toContain('Pampa');
    expect(tooltip.textContent).toContain('CORREDOR VIAL 5 S.A.U.');
    expect(tooltip.textContent).toContain('Concesionado');
    expect(tooltip.textContent).toContain('546,65 km');

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'RN 40' }));
    expect(tooltip.textContent).toContain('RN 40');
    expect(tooltip.textContent).toContain('Sin dato');
    expect(tooltip.textContent).toContain('5.080,16 km');

    fireEvent.click(screen.getByRole('button', { name: 'Pavimento' }));
    expect(tooltip.textContent).toContain('Sin dato');
    expect(tooltip.textContent).not.toContain('Concesionado');
});
