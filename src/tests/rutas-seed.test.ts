import { describe, expect, it } from 'vitest';
import geometry from '@/lib/rutas/geometry.json';
import { CONCESSION_COLORS, CONCESSION_STAGES, PAVEMENT_CONDITIONS, RUTAS_METHODOLOGY, paintRoutes } from '@/lib/rutas/status';
import { RUTAS_SEED, seedTramos } from './fixtures/rutas';

const geometryCodes = new Set(geometry.routes.map(route => route.code));

describe('official route concession import data', () => {
    it('keeps unique ids, valid stages and routes that exist in the geometry', () => {
        const ids = RUTAS_SEED.map(tramo => tramo.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const tramo of RUTAS_SEED) {
            expect(CONCESSION_STAGES).toContain(tramo.etapa);
            expect(PAVEMENT_CONDITIONS).toContain(tramo.pavimento);
            expect(tramo.rutas.length).toBeGreaterThan(0);
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

    it('gives every concessioned tramo a company and ISO dates', () => {
        const isoOrNull = (value: string | null) => value === null || /^\d{4}-\d{2}-\d{2}$/.test(value);
        for (const tramo of RUTAS_SEED) {
            if (tramo.etapa === 'concesionado') expect(tramo.concesionaria.trim()).not.toBe('');
            expect(isoOrNull(tramo.fechaTomaPosesion)).toBe(true);
            expect(isoOrNull(tramo.fechaHabilitacionTarifa)).toBe(true);
        }
        const methodology = RUTAS_METHODOLOGY.map(item => item.description).join('\n');
        expect(methodology).not.toContain('carga inicial');
        const painted = paintRoutes(geometry.routes, seedTramos(), 'concesion');
        const concessioned = new Set(RUTAS_SEED.filter(tramo => tramo.etapa === 'concesionado').flatMap(tramo => tramo.rutas));
        const untouched = painted.filter(route => !RUTAS_SEED.some(tramo => tramo.rutas.includes(route.code)));
        expect(painted.some(route => concessioned.has(route.code) && route.color === CONCESSION_COLORS.concesionado)).toBe(concessioned.size > 0);
        expect(untouched.every(route => route.status === 'sin-dato')).toBe(true);
    });
});
