import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
    query: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock('../lib/db/client', () => ({ sql: database }));

import { getRutasTramos, replaceRutasTramos } from '../lib/db/rutas';
import { seedTramos } from '../lib/rutas/seed';

beforeEach(() => {
    database.query.mockReset();
    database.transaction.mockReset();
    database.query.mockResolvedValue([]);
    database.transaction.mockImplementation(async (queries: Array<Promise<unknown>>) => Promise.all(queries));
});

describe('rutas tramos database', () => {
    it('returns manually stored sections with normalized fields', async () => {
        database.query.mockResolvedValueOnce([]);
        database.query.mockResolvedValueOnce([{
            id: 'oriental',
            nombre: 'Tramo Oriental',
            rutas: '9,12',
            km: '1200.5',
            concesionaria: 'Corredores Viales',
            fecha_toma_posesion: '2025-04-01',
            obras_iniciales_pct: '15.5',
            fecha_habilitacion_tarifa: null,
            etapa: 'concesionado',
            pavimento: 'regular',
        }]);

        await expect(getRutasTramos()).resolves.toEqual([{
            id: 'oriental',
            nombre: 'Tramo Oriental',
            rutas: ['9', '12'],
            km: 1200.5,
            concesionaria: 'Corredores Viales',
            fechaTomaPosesion: '2025-04-01',
            obrasInicialesPct: 15.5,
            fechaHabilitacionTarifa: null,
            etapa: 'concesionado',
            pavimento: 'regular',
        }]);
    });

    it('replaces the whole table inside a transaction and can clear it', async () => {
        await replaceRutasTramos([{
            id: 'oriental',
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

        expect(database.transaction).toHaveBeenCalledOnce();
        const statements = database.query.mock.calls.map(([query, params]) => `${query} ${JSON.stringify(params)}`);
        expect(statements.some(query => query.includes('CREATE TABLE IF NOT EXISTS rutas_tramos'))).toBe(true);
        expect(statements.some(query => query.includes('DELETE FROM rutas_tramos'))).toBe(true);
        const insert = statements.find(query => query.includes('INSERT INTO rutas_tramos'));
        expect(insert).toContain('oriental');
        expect(insert).toContain('9,12');
        expect(insert).toContain('en-licitacion');

        database.query.mockClear();
        database.transaction.mockClear();
        await replaceRutasTramos([]);
        const cleared = database.query.mock.calls.map(([query]) => String(query));
        expect(database.transaction).toHaveBeenCalledOnce();
        expect(cleared.some(query => query.includes('DELETE FROM rutas_tramos'))).toBe(true);
        expect(cleared.some(query => query.includes('INSERT INTO rutas_tramos'))).toBe(false);
    });

    it('returns the official seed when the table has no rows and does not write it', async () => {
        await expect(getRutasTramos()).resolves.toEqual(seedTramos());
        const statements = database.query.mock.calls.map(([query]) => String(query));
        expect(statements.some(query => query.includes('SELECT * FROM rutas_tramos'))).toBe(true);
        expect(statements.some(query => query.includes('INSERT INTO rutas_tramos'))).toBe(false);
        expect(statements.some(query => query.includes('DELETE FROM rutas_tramos'))).toBe(false);
    });

    it('keeps stored rows and ignores the seed once the table has data', async () => {
        database.query.mockResolvedValueOnce([]);
        database.query.mockResolvedValueOnce([{
            id: 'manual',
            nombre: 'Tramo manual',
            rutas: '40',
            km: null,
            concesionaria: 'Carga manual',
            fecha_toma_posesion: null,
            obras_iniciales_pct: null,
            fecha_habilitacion_tarifa: null,
            etapa: 'sin-concesionar',
            pavimento: 'bueno',
        }]);

        const rows = await getRutasTramos();
        expect(rows.map(row => row.id)).toEqual(['manual']);
        expect(rows[0]?.pavimento).toBe('bueno');
        expect(rows.some(row => row.id === 'oriental')).toBe(false);
    });
});
