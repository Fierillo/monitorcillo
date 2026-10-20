import { describe, expect, it } from 'vitest';
import {
    CONCESSION_COLORS,
    PAVEMENT_COLORS,
    PAVEMENT_SOURCE_NOTE,
    RUTAS_METHODOLOGY,
    normalizeRouteCode,
    paintRoutes,
    parseRouteList,
    parseRutasPayload,
    frameMapSize,
    projectMap,
    routeSign,
    type RouteGeometry,
    type RutaTramo,
} from '@/lib/rutas/status';
import geometryAsset from '@/lib/rutas/geometry.json';

const routes: RouteGeometry[] = [
    { code: '9', label: 'RN 9', km: 1975.46, lines: [[[-64, -31], [-63, -32], [-62, -33]]] },
    { code: '12', label: 'RN 12', km: 1641.76, lines: [[[-58, -27], [-57, -28]]] },
    { code: 'A12', label: 'RN A12', km: 66.71, lines: [[[-60.5, -32], [-60, -32.2]]] },
];

const outline = [[[-72, -55], [-54, -55], [-54, -22], [-72, -22], [-72, -55]]];

function tramo(overrides: Partial<RutaTramo> = {}): RutaTramo {
    return {
        id: 'oriental',
        nombre: 'Tramo Oriental',
        rutas: ['9', '12'],
        km: 1200,
        concesionaria: 'Corredores Viales',
        fechaTomaPosesion: '2025-04-01',
        obrasInicialesPct: 15,
        fechaHabilitacionTarifa: null,
        etapa: 'concesionado',
        pavimento: 'regular',
        ...overrides,
    };
}

describe('national route codes', () => {
    it('normalizes the official DNV codes and the forms an editor would type', () => {
        expect(normalizeRouteCode('RN 0009')).toBe('9');
        expect(normalizeRouteCode('9')).toBe('9');
        expect(normalizeRouteCode('A012')).toBe('A12');
        expect(normalizeRouteCode('RN A012')).toBe('A12');
        expect(normalizeRouteCode('1V09')).toBe('1V09');
        expect(normalizeRouteCode('24CA')).toBe('24CA');
        expect(normalizeRouteCode('')).toBeNull();
        expect(normalizeRouteCode('calle 12')).toBeNull();
    });

    it('reads the routes included in a tramo from a single text field', () => {
        expect(parseRouteList('RN 9, 12 y A012')).toEqual(['9', '12', 'A12']);
        expect(parseRouteList('9 12')).toEqual(['9', '12']);
    });
});

describe('route color modes', () => {
    it('colors a route by the last tramo that includes it and leaves the rest gray', () => {
        const painted = paintRoutes(routes, [
            tramo({ rutas: ['9'], etapa: 'en-licitacion', concesionaria: 'Primera' }),
            tramo({ id: 'segundo', rutas: ['9', 'A12'], etapa: 'concesionado', concesionaria: 'Corredores Viales', km: 320 }),
        ], 'concesion');

        const route9 = painted.find(route => route.code === '9');
        const route12 = painted.find(route => route.code === '12');
        expect(route9).toMatchObject({
            color: '#4ADE80',
            status: 'concesionado',
            statusLabel: 'Concesionado',
            concesionaria: 'Corredores Viales',
            tramo: 'Tramo Oriental',
            km: 320,
            kmLabel: '320 km',
        });
        expect(route12).toMatchObject({
            color: '#94A3B8',
            status: 'sin-dato',
            statusLabel: 'Sin dato',
            concesionaria: 'Sin dato',
            tramo: null,
            km: 1641.76,
        });
        expect(route12?.kmLabel).toBe('1.641,76 km');
        expect(route9?.assignments.map(item => item.concesionaria)).toEqual(['Primera', 'Corredores Viales']);
    });

    it('uses pavement ratings independently and keeps unmeasured segments gray', () => {
        const painted = paintRoutes(routes, [tramo({ pavimento: 'malo', rutas: ['12'] })], 'pavimento');

        expect(painted.find(route => route.code === '12')).toMatchObject({
            color: '#F87171',
            status: 'malo',
            statusLabel: 'Malo',
        });
        expect(painted.find(route => route.code === '9')).toMatchObject({
            color: '#94A3B8',
            status: 'sin-dato',
            statusLabel: 'Sin dato',
        });
        expect(CONCESSION_COLORS['sin-concesionar']).toBe('#38BDF8');
        expect(PAVEMENT_COLORS.bueno).toBe('#4ADE80');
        expect(PAVEMENT_COLORS.regular).toBe('#FBBF24');
    });
});

describe('manual tramo payload', () => {
    it('accepts an editor row and normalizes its fields', () => {
        expect(parseRutasPayload([{
            nombre: ' Tramo Oriental ',
            rutas: '9, 12',
            km: '1.200,5',
            concesionaria: ' Corredores Viales ',
            fechaTomaPosesion: '2025-04-01',
            obrasInicialesPct: '15,5',
            fechaHabilitacionTarifa: '',
            etapa: 'en-licitacion',
            pavimento: '',
        }])).toEqual([{
            id: 'tramo-1',
            nombre: 'Tramo Oriental',
            rutas: ['9', '12'],
            km: 1200.5,
            concesionaria: 'Corredores Viales',
            fechaTomaPosesion: '2025-04-01',
            obrasInicialesPct: 15.5,
            fechaHabilitacionTarifa: null,
            etapa: 'en-licitacion',
            pavimento: 'sin-dato',
        }]);
    });

    it('skips a completely empty row and rejects an invalid stage with a message that says how to fix it', () => {
        expect(parseRutasPayload([{ nombre: '', rutas: '', km: '', concesionaria: '', fechaTomaPosesion: '', obrasInicialesPct: '', fechaHabilitacionTarifa: '', etapa: '', pavimento: '' }])).toEqual([]);

        expect(() => parseRutasPayload([{ nombre: 'Oriental', rutas: '9', etapa: 'adjudicado' }])).toThrow(
            'La etapa del tramo Oriental no es válida. Usá concesionado, en-licitacion o sin-concesionar.',
        );
        expect(() => parseRutasPayload([{ nombre: 'Oriental', rutas: 'calle falsa', etapa: 'concesionado' }])).toThrow(
            /ninguna ruta reconocible/,
        );
        expect(() => parseRutasPayload([{ nombre: '', rutas: '9', etapa: 'concesionado' }])).toThrow(/nombre/);
    });
});

describe('route signs', () => {
    it('uses the national shield for RN and accesos, and a circle for provincial routes', () => {
        expect(routeSign('9')).toBe('nacional');
        expect(routeSign('A15')).toBe('nacional');
        expect(routeSign('1V66')).toBe('nacional');
        expect(routeSign('P8')).toBe('provincial');
        expect(routeSign('RP11')).toBe('provincial');
    });
});

describe('map projection', () => {
    it('projects north upward and keeps one degree of latitude taller than one degree of longitude', () => {
        const projected = projectMap(outline, paintRoutes(routes, [], 'concesion'), 800, 1000);
        expect(projected.viewBox).toBe('0 0 800 1000');
        expect(projected.outlinePaths[0]?.startsWith('M')).toBe(true);

        const route9 = projected.routes.find(route => route.code === '9');
        const [first, , last] = route9?.paths[0]?.match(/-?\d+\.?\d*/g) ?? [];
        expect(Number(first)).toBeLessThan(Number(last));

        const north = projectMap([[[-60, -30], [-59, -30], [-59, -31], [-60, -31], [-60, -30]]], [], 200, 200);
        const numbers = north.outlinePaths[0]?.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
        const lonPixels = Math.abs(numbers[2] - numbers[0]);
        const latPixels = Math.abs(numbers[5] - numbers[1]);
        expect(latPixels).toBeGreaterThan(lonPixels);
    });

    it('stops the frame at the Malvinas and drops the islands farther east', () => {
        const continent = [[[-73, -55], [-54, -55], [-54, -22], [-72, -22], [-73, -55]]];
        const malvinas = [[[-61, -52.3], [-57.7, -52.3], [-57.7, -51.2], [-61, -51.2], [-61, -52.3]]];
        const georgias = [[[-38, -54.9], [-35.8, -54.9], [-35.8, -54], [-38, -54], [-38, -54.9]]];
        const fitted = frameMapSize([...continent, ...malvinas], [], 1000);
        const withGeorgias = frameMapSize([...continent, ...malvinas, ...georgias], [], 1000);
        expect(withGeorgias).toEqual(fitted);
        expect(fitted.width).toBeLessThan(fitted.height);

        const projected = projectMap([...continent, ...malvinas, ...georgias], [], fitted.width, fitted.height);
        expect(projected.outlinePaths).toHaveLength(2);
        const xs = projected.outlinePaths[0]?.match(/-?\d+\.?\d*/g)?.map(Number).filter((_, index) => index % 2 === 0) ?? [];
        expect(Math.max(...xs)).toBeGreaterThan(fitted.width - 40);

        const stored = frameMapSize(geometryAsset.outline, geometryAsset.routes, 1000);
        expect(stored.width).toBeGreaterThan(430);
        expect(stored.width).toBeLessThan(560);
        expect(projectMap(geometryAsset.outline, [], stored.width, stored.height).outlinePaths).toHaveLength(geometryAsset.outline.length - 2);
    });
});

describe('sources', () => {
    it('cites the official geometry, outline and the reports that are not an API', () => {
        const text = RUTAS_METHODOLOGY.map(item => `${item.title}: ${item.description}`).join('\n');
        expect(text).toContain('https://datos.transporte.gob.ar/dataset/rutas-nacionales');
        expect(text).toContain('https://apis.datos.gob.ar/georef/api/v2.0/provincias.geojson');
        expect(text).toContain('https://sigvial.vialidad.gob.ar/geoserver/dnv/ows');
        expect(text).toContain('Informe Anual de Evaluación de Estado de Pavimentos 2023-2024');
        expect(text).toContain('Boletín Oficial');
        expect(text).toContain('sin dato');
        expect(text).toContain('Malvinas');
        expect(PAVEMENT_SOURCE_NOTE).toContain('2023-2024');
        expect(PAVEMENT_SOURCE_NOTE).toContain('Dirección Nacional de Vialidad');
    });
});
