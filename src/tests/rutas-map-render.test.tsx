import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RutaTramo, RutasGeometry } from '@/lib/rutas/status';
import type { RutaOferta } from '@/lib/rutas/ofertas';

// Every drawn segment asks segmentPicked once per render: its call count is the route layer's render count.
const hit = vi.hoisted(() => ({ calls: 0, byRoute: new Map<string, number>() }));
vi.mock('@/lib/rutas/hit', async importOriginal => {
    const actual = await importOriginal<typeof import('@/lib/rutas/hit')>();
    return { ...actual, segmentPicked: (...args: Parameters<typeof actual.segmentPicked>) => { hit.calls += 1; hit.byRoute.set(args[1], (hit.byRoute.get(args[1]) ?? 0) + 1); return actual.segmentPicked(...args); } };
});

import * as React from 'react';
import RutasMap from '../components/rutas/RutasMap';

/** The same component with React.memo turned off: the baseline every incremental render must match. */
async function loadUnmemoized(): Promise<typeof RutasMap> {
    vi.resetModules();
    vi.doMock('react', () => ({ ...React, default: React, memo: <T,>(component: T) => component }));
    const unmemoized = await import('../components/rutas/RutasMap');
    vi.doUnmock('react');
    return unmemoized.default;
}

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => { window.localStorage.clear(); hit.calls = 0; hit.byRoute.clear(); vi.useFakeTimers(); });

const geometry: RutasGeometry = {
    source: { routes: 'r', outline: 'o', retrieved: '2026-10-19' },
    outline: [[[-70, -50], [-55, -50], [-55, -25], [-70, -25], [-70, -50]]],
    routes: [{ code: '9', label: 'RN 9', km: 1000, lines: [[[-64, -40], [-64, -20]]] }],
};
const tramos: RutaTramo[] = [{ id: 'a', nombre: 'A', rutas: ['9'], km: 1000, concesionaria: 'X', fechaTomaPosesion: null, obrasInicialesPct: null, fechaHabilitacionTarifa: null, etapa: 'concesionado', pavimento: 'sin-dato' }];

it('moving the crosshair along the same tramo re-renders the crosshair but not the route paths', () => {
    const { container } = render(<RutasMap tramos={tramos} geometry={geometry} />);
    const svg = screen.getByRole('group', { name: 'Mapa de rutas nacionales de Argentina' });
    Object.assign(svg, { getScreenCTM: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }) });
    const [x, y] = container.querySelector('[data-company="X"] path')!.getAttribute('d')!.match(/-?[\d.]+/g)!.map(Number);
    const touch = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', clientX: number, clientY: number) => fireEvent[type](svg, { pointerType: 'touch', clientX, clientY, pointerId: 1 });
    touch('pointerDown', x, y);
    act(() => { vi.advanceTimersByTime(500); });
    expect(container.querySelector('[data-marked="true"]')).not.toBeNull();

    const before = hit.calls;
    const line = () => Number(container.querySelector('[data-crosshair] line')!.getAttribute('y1') ?? 0) + Number(container.querySelector('[data-crosshair] line + line')!.getAttribute('y1'));
    const start = line();
    touch('pointerMove', x, y + 1);
    touch('pointerMove', x, y + 2);
    expect(line()).not.toBe(start);
    expect(container.querySelector('[data-marked="true"]')).not.toBeNull();
    expect(hit.calls).toBe(before);
});

const three: RutasGeometry = {
    ...geometry,
    routes: [
        { code: '9', label: 'RN 9', km: 1000, lines: [[[-64, -40], [-64, -20]]] },
        { code: '12', label: 'RN 12', km: 1000, lines: [[[-58, -30], [-57, -28]]] },
        { code: '40', label: 'RN 40', km: 1000, lines: [[[-68, -45], [-67, -30]]] },
    ],
};
const base = tramos[0];
const network: RutaTramo[] = [
    { ...base, id: 'sur', rutas: ['9'], concesionaria: 'CREDITECH', sectores: [{ ruta: '9', desdeKm: 0, hastaKm: 400, km: 400 }] },
    { ...base, id: 'norte', rutas: ['9', '12'], concesionaria: 'CPC', etapa: 'en-licitacion', pavimento: 'regular', sectores: [{ ruta: '9', desdeKm: 600, hastaKm: 1000, km: 400 }, { ruta: '12', desdeKm: 0, hastaKm: 1000, km: 1000 }] },
];

it('moving the hover from a tramo on one route to another re-renders only those two routes', () => {
    vi.useRealTimers();
    const { container } = render(<RutasMap tramos={network} geometry={three} />);
    const known = (code: string) => container.querySelector(`g[role="button"][data-route="${code}"]`)!;
    fireEvent.pointerMove(known('9').querySelector('[data-company="CPC"] path')!);
    hit.byRoute.clear();
    fireEvent.pointerMove(known('12').querySelector('[data-company="CPC"] path')!);
    expect(known('12').querySelector('[data-marked="true"]')).not.toBeNull();
    expect(hit.byRoute.get('9')).toBeGreaterThan(0);
    expect(hit.byRoute.get('12')).toBeGreaterThan(0);
    expect(hit.byRoute.get('40') ?? 0).toBe(0);
});

it('moving the pick from one route to another re-renders only those two routes', () => {
    vi.useRealTimers();
    const { container } = render(<RutasMap tramos={network} geometry={three} />);
    const segment = (code: string, company: string) => container.querySelector(`g[role="button"][data-route="${code}"] [data-company="${company}"]`)!;
    fireEvent.click(segment('9', 'CREDITECH'));
    fireEvent.pointerLeave(segment('9', 'CREDITECH').closest('g[role="button"]')!);
    hit.byRoute.clear();
    fireEvent.click(segment('12', 'CPC'));
    expect(segment('12', 'CPC').getAttribute('data-picked')).toBe('true');
    expect(hit.byRoute.get('9')).toBeGreaterThan(0);
    expect(hit.byRoute.get('12')).toBeGreaterThan(0);
    expect(hit.byRoute.get('40') ?? 0).toBe(0);
});

/** Everything that paints a segment: what a stale memo would leave behind. */
function paint(container: HTMLElement) {
    return [...container.querySelectorAll('svg[role="group"] g[data-segment-index]')].map(group => {
        const fill = group.querySelector('path[data-fill]') as SVGPathElement;
        const parent = group.parentElement!;
        return [
            group.getAttribute('data-route'), group.getAttribute('data-company'), group.getAttribute('opacity'),
            group.getAttribute('data-marked'), group.getAttribute('data-picked'), parent.getAttribute('opacity'), parent.getAttribute('stroke'),
            fill.getAttribute('stroke'), fill.getAttribute('stroke-dasharray'), fill.style.filter, fill.getAttribute('d'),
        ].join('|');
    });
}

describe('incremental renders match a fresh mount', () => {
    type Props = { tramos: RutaTramo[]; ofertas: RutaOferta[]; geometry: RutasGeometry };
    type Live = { container: HTMLElement; rerender: (props: Props) => void };
    const ui = within;
    type Transient = { props: Props; hover: string | null; touch: boolean };
    const replay = (container: HTMLElement, state: Transient) => {
        const svg = container.querySelector('svg[role="group"]')!;
        if (state.touch) {
            fireEvent.pointerDown(svg, { pointerType: 'touch', clientX: 1, clientY: 1, pointerId: 1 });
            fireEvent.pointerUp(svg, { pointerType: 'touch', clientX: 1, clientY: 1, pointerId: 1 });
        }
        if (state.hover) fireEvent.pointerMove(container.querySelector(`g[role="button"][data-route="${state.hover}"] [data-segment-index] path`)!);
    };
    const steps: Array<[string, (live: Live, state: Transient) => void]> = [
        ['hover a tramo', (_, state) => { state.hover = '9'; }],
        ['move the hover to another route', (_, state) => { state.hover = '12'; }],
        ['pick a tramo on the map', live => fireEvent.click(live.container.querySelector('g[role="button"][data-route="12"] [data-company="CPC"]')!)],
        ['switch to pavement', live => fireEvent.click(ui(live.container).getByRole('button', { name: 'Pavimento' }))],
        ['back to concession', live => fireEvent.click(ui(live.container).getByRole('button', { name: 'Concesión' }))],
        ['filter by route', live => fireEvent.change(ui(live.container).getByRole('combobox', { name: 'Filtrar por' }), { target: { value: 'ruta' } })],
        ['open a route shield', live => fireEvent.click(ui(live.container).getByRole('button', { name: 'Escudo RN 9' }))],
        ['pick from the sidebar', live => fireEvent.click(ui(live.container).getByRole('button', { name: 'Seleccionar CPC en RN 9' }))],
        ['clear that pick', live => fireEvent.click(ui(live.container).getByRole('button', { name: 'Seleccionar CPC en RN 9' }))],
        ['pick another tramo on the same route', live => fireEvent.click(ui(live.container).getByRole('button', { name: 'Seleccionar CREDITECH en RN 9' }))],
        ['filter by concessionaire', live => fireEvent.change(ui(live.container).getByRole('combobox', { name: 'Filtrar por' }), { target: { value: 'concesionaria' } })],
        ['open a concessionaire', live => fireEvent.click(ui(live.container).getByRole('button', { name: 'Concesionaria CPC' }))],
        ['pick one of its routes', live => fireEvent.click(ui(live.container).getByRole('button', { name: 'Seleccionar RN 12 de CPC' }))],
        ['remove the filter', live => fireEvent.change(ui(live.container).getByRole('combobox', { name: 'Filtrar por' }), { target: { value: 'ninguno' } })],
        ['re-fetch tramos with a new stage', (live, state) => {
            state.props = { ...state.props, tramos: state.props.tramos.map(tramo => tramo.id === 'norte' ? { ...tramo, etapa: 'concesionado' } : tramo) };
            live.rerender(state.props);
        }],
        ['re-fetch tramos with a renamed company and the same stages', (live, state) => {
            state.props = { ...state.props, tramos: state.props.tramos.map(tramo => tramo.id === 'sur' ? { ...tramo, concesionaria: 'CREDITECH S.A.' } : tramo) };
            live.rerender(state.props);
        }],
        ['re-fetch offers', (live, state) => {
            state.props = { ...state.props, ofertas: [{ tramoId: 'norte', concesionaria: 'CPC', tarifa: 10, gano: true, resolucion: 'R', fuenteUrl: 'https://x' }] };
            live.rerender(state.props);
        }],
        ['route color map changes under the route filter', (live, state) => {
            fireEvent.change(ui(live.container).getByRole('combobox', { name: 'Filtrar por' }), { target: { value: 'ruta' } });
            state.props = { ...state.props, geometry: { ...three, routes: [three.routes[2], three.routes[1], three.routes[0]] } };
            live.rerender(state.props);
        }],
        ['leave the map', (live, state) => { fireEvent.pointerLeave(live.container.querySelector('svg[role="group"]')!); state.hover = null; }],
        ['switch to touch, where the pick shows no tooltip', (_, state) => { state.touch = true; }],
        ['open RN 9 and pick one of its tramos', live => {
            const shield = ui(live.container).getByRole('button', { name: 'Escudo RN 9' });
            if (shield.getAttribute('aria-pressed') !== 'true') fireEvent.click(shield);
            fireEvent.click(ui(live.container).getByRole('button', { name: 'Seleccionar CPC en RN 9' }));
        }],
        ['move the pick to another tramo of the same route (only the pick changes)', live => fireEvent.click(ui(live.container).getByRole('button', { name: 'Seleccionar CREDITECH S.A. en RN 9' }))],
    ];

    it('after every paint input change', async () => {
        vi.useRealTimers();
        const Reference = await loadUnmemoized();
        const state: Transient = { props: { tramos: network, ofertas: [], geometry: three }, hover: null, touch: false };
        const first = render(<RutasMap {...state.props} />);
        const live: Live = { container: first.container, rerender: props => first.rerender(<RutasMap {...props} />) };
        for (const [name, step] of steps) {
            step(live, state);
            replay(live.container, state);
            const fresh = render(<Reference {...state.props} />);
            replay(fresh.container, state);
            expect(paint(live.container), name).toEqual(paint(fresh.container));
            fresh.unmount();
        }
    });
});
