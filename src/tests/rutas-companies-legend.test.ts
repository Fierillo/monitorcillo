import { expect, it } from 'vitest';
import { companiesOf, companiesOnRoute, compareRoutes, routeCodes } from '@/lib/rutas/companies';
import { legendFor } from '@/lib/rutas/legend';
import { tipAt, tipRow } from '@/lib/rutas/tooltip';
import { CONCESSION_COLORS, type PaintedRoute, type RutaTramo } from '@/lib/rutas/status';

const tramo = (id: string, concesionaria: string, rutas: string[]) => ({ id, nombre: id, rutas, km: null, concesionaria, etapa: 'concesionado', pavimento: 'sin-dato' }) as unknown as RutaTramo;

it('orders route codes numerically, A-roads before V variants', () => {
    expect(['40', 'A001', '3', '1V9', '9'].sort(compareRoutes)).toEqual(['A001', '1V9', '3', '9', '40']);
    expect(routeCodes([tramo('a', 'X', ['9', '3']), tramo('b', 'Y', ['3'])])).toEqual(['3', '9']);
});

it('groups tramos by company with the color painted on the map, gray when not drawn', () => {
    const routes = [{ segments: [{ tramoId: 'a', concesionaria: 'X', color: '#111111' }, { tramoId: null, concesionaria: 'Sin dato', color: '#94A3B8' }] }];
    expect(companiesOf([tramo('a', 'X', ['9']), tramo('b', ' ', ['3'])], routes)).toEqual([
        { name: 'X', color: '#111111', rutas: ['9'] },
        { name: 'Sin dato', color: '#94A3B8', rutas: ['3'] },
    ]);
    expect(companiesOf([tramo('c', 'Z', ['5'])], routes)[0].color).toBe(CONCESSION_COLORS['sin-dato']);
    expect(companiesOnRoute(routes[0].segments)).toEqual([{ name: 'X', color: '#111111' }]);
});

it('builds the legend per filter', () => {
    expect(legendFor('ninguno', 'concesion', new Set(), [], [], new Map()).map(item => item.label)).toEqual(['Concesionado', 'En licitación', 'Sin concesionar', 'Sin dato']);
    expect(legendFor('ninguno', 'pavimento', new Set(), [], [], new Map()).map(item => item.label)).toEqual(['Bueno', 'Regular', 'Malo', 'Sin dato']);
    expect(legendFor('ruta', 'concesion', new Set(['9']), ['9', '3'], [], new Map([['9', 'red']]))).toEqual([{ key: '9', color: 'red', label: 'RN 9' }]);
    expect(legendFor('concesionaria', 'concesion', new Set(['X']), [], [{ name: 'X', color: 'blue', rutas: ['9'] }], new Map()).map(item => item.label)).toEqual(['RN 9', 'Sin dato']);
});

it('tipRow returns the concession stage of the segment, null for pavement ratings', () => {
    const route = {
        code: '9', label: 'RN 9', km: 10, kmLabel: '10 km', concesionaria: 'X', tramo: 'a', status: 'concesionado', statusLabel: 'Concesionado', color: '#4ADE80', lines: [],
        assignments: [{ tramo: 'a', concesionaria: 'X', kmLabel: '5 km', status: 'en-licitacion', statusLabel: 'En licitación' }],
        segments: [{ tramoId: 'a', tramo: 'a', concesionaria: 'X', color: '#123456', km: 5, lines: [] }, { tramoId: null, tramo: null, concesionaria: 'Sin dato', color: '#94A3B8', km: 5, lines: [] }],
    } as PaintedRoute;
    expect(tipRow(route, 0)).toEqual({ tramo: 'a', concesionaria: 'X', kmLabel: '5 km', statusLabel: 'En licitación', color: '#123456', stage: 'en-licitacion' });
    expect(tipRow(route, 1)).toMatchObject({ statusLabel: 'Sin dato', stage: 'sin-dato' });
    expect(tipRow({ ...route, assignments: [{ ...route.assignments[0], status: 'bueno', statusLabel: 'Bueno' }] }, 0).stage).toBeNull();
});

it('tipAt flips the tooltip to stay inside the map', () => {
    expect(tipAt({ clientX: 10, clientY: 10 }, undefined)).toEqual({ x: 30, y: 30 });
    expect(tipAt({ clientX: 10, clientY: 10 }, { left: 0, top: 0, width: 1000, height: 1000 })).toEqual({ x: 24, y: 24 });
    expect(tipAt({ clientX: 990, clientY: 990 }, { left: 0, top: 0, width: 1000, height: 1000 })).toEqual({ x: 696, y: 844 });
});

it('falls back to the sin dato color for a selected route missing from the palette', () => {
    expect(legendFor('ruta', 'concesion', new Set(['999']), ['999'], [], new Map())).toEqual([{ key: '999', color: CONCESSION_COLORS['sin-dato'], label: 'RN 999' }]);
});
