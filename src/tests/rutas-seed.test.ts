import { describe, expect, it } from 'vitest';
import geometry from '@/lib/rutas/geometry.json';
import { CONCESSION_COLORS, CONCESSION_STAGES, PAVEMENT_CONDITIONS, RUTAS_METHODOLOGY, paintRoutes } from '@/lib/rutas/status';
import { RUTAS_SEED, seedTramos } from '@/lib/rutas/seed';

const geometryCodes = new Set(geometry.routes.map(route => route.code));

describe('official route concession seed', () => {
    it('keeps unique ids, valid stages and routes that exist in the geometry', () => {
        const ids = RUTAS_SEED.map(tramo => tramo.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toHaveLength(16);
        for (const tramo of RUTAS_SEED) {
            expect(CONCESSION_STAGES).toContain(tramo.etapa);
            expect(tramo.pavimento).toBe('sin-dato');
            expect(PAVEMENT_CONDITIONS).toContain(tramo.pavimento);
            expect(tramo.rutas.length).toBeGreaterThan(0);
            expect(tramo.obrasInicialesPct).toBeNull();
            expect(tramo.fechaHabilitacionTarifa).toBeNull();
            for (const code of tramo.rutas) expect(geometryCodes.has(code)).toBe(true);
            expect(tramo.sources.length).toBeGreaterThan(0);
            for (const source of tramo.sources) {
                expect(source.startsWith('https://www.argentina.gob.ar/') || source.startsWith('https://www.boletinoficial.gob.ar/')).toBe(true);
            }
            expect(tramo.sourceNote.length).toBeGreaterThan(0);
        }
        expect(seedTramos().map(tramo => tramo.id)).toEqual(ids);
        expect(seedTramos()[0]).not.toHaveProperty('sources');
    });

    it('records possession companies and leaves unverified concession fields empty', () => {
        const byId = Object.fromEntries(RUTAS_SEED.map(tramo => [tramo.id, tramo]));
        expect(byId.oriental).toMatchObject({
            nombre: 'Oriental',
            rutas: ['12', '14', '135', 'A15', '117'],
            km: 682.28,
            concesionaria: 'Autovía Construcciones y Servicios S.A.',
            fechaTomaPosesion: '2026-01-07',
            etapa: 'concesionado',
        });
        expect(byId.conexion).toMatchObject({
            nombre: 'Conexión',
            rutas: ['174'],
            km: 59.34,
            concesionaria: 'Conexión Alto Delta S.A.',
            fechaTomaPosesion: '2026-01-07',
            etapa: 'concesionado',
        });
        expect(byId['sur-atlantico-acceso-sur']).toMatchObject({
            rutas: ['3', '205', '226'],
            km: 1325.17,
            concesionaria: 'RUTAS SUR ATLANTICO S.A.',
            fechaTomaPosesion: '2026-07-01',
        });
        expect(byId.pampa).toMatchObject({
            rutas: ['5'],
            km: 546.65,
            concesionaria: 'CORREDOR VIAL 5 S.A.U.',
            fechaTomaPosesion: '2026-07-01',
        });
        expect(byId.mediterraneo.concesionaria).toBe('CREDITECH S.A. - PLANTEL S.A.');
        expect(byId.mediterraneo.fechaTomaPosesion).toBeNull();
        expect(byId.puntano.concesionaria).toBe('BASAA S.A. - CECOSA S.A.');
        expect(byId['portuario-sur'].concesionaria).toBe('CREDITECH S.A. - PLANTEL S.A.');
        expect(byId['portuario-norte'].concesionaria).toBe('CPC S.A.');
        expect(byId.centro).toMatchObject({ concesionaria: 'COVICEN S.A.', fechaTomaPosesion: '2026-10-07', km: 681.92 });
        expect(byId['centro-norte'].concesionaria).toBe('AUTOVÍA AL NORTE S.A.U.');
        expect(byId.noroeste.concesionaria).toBe('AUTOVIA DEL NOA S.A.');
        expect(byId.cuyo.concesionaria).toBe('CAMINOS DEL ACONCAGUA');
        expect(byId['chaco-santa-fe'].concesionaria).toBe('VÍAS DEL PARANÁ MEDIO S.A.');
        const methodology = RUTAS_METHODOLOGY.map(item => item.description).join('\n');
        expect(methodology).toContain('carga inicial');
        const painted = paintRoutes(geometry.routes, seedTramos(), 'concesion');
        expect(painted.find(route => route.code === '5')?.color).toBe(CONCESSION_COLORS.concesionado);
        expect(painted.find(route => route.code === '40')?.status).toBe('sin-dato');
    });
});
