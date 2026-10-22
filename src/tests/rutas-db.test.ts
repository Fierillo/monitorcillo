import { beforeEach, describe, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({
    query: vi.fn(),
    transaction: vi.fn(),
}));

vi.mock('../lib/db/client', () => ({ sql: database }));

import { getRutasLargos, getRutasOfertas, getRutasRed, getRutasTramos, replaceRutasTramos } from '../lib/db/rutas';
import { RUTAS_OFERTAS, RUTAS_SECTORES, RUTAS_SEED, seedTramos } from './fixtures/rutas';

beforeEach(() => {
    database.query.mockReset();
    database.transaction.mockReset();
    database.query.mockResolvedValue([]);
    database.transaction.mockImplementation(async (queries: Array<Promise<unknown>>) => Promise.all(queries));
});

describe('rutas tramos database', () => {
    it('returns manually stored sections with normalized fields', async () => {
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

    it('returns no tramos when the table has no rows and does not write it', async () => {
        await expect(getRutasTramos()).resolves.toEqual([]);
        const statements = database.query.mock.calls.map(([query]) => String(query));
        expect(statements.some(query => query.includes('SELECT * FROM rutas_tramos'))).toBe(true);
        expect(statements.some(query => query.includes('INSERT INTO rutas_tramos'))).toBe(false);
        expect(statements.some(query => query.includes('DELETE FROM rutas_tramos'))).toBe(false);
    });

    it('keeps stored rows and ignores the seed once the table has data', async () => {
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

describe('rutas import', () => {
    it('upserts tramos with their sources and offers by unique key, inside one transaction', async () => {
        const { importRutas } = await import('../lib/db/rutas');
        const [tramo] = RUTAS_SEED;
        const [oferta] = RUTAS_OFERTAS;
        await importRutas([tramo], [oferta], []);
        const calls = database.query.mock.calls.map(([query, params]) => ({ query: String(query), params }));
        expect(calls.some(call => call.query.includes('ADD COLUMN IF NOT EXISTS fuentes'))).toBe(true);
        expect(calls.some(call => call.query.includes('CREATE UNIQUE INDEX IF NOT EXISTS rutas_ofertas_key'))).toBe(true);
        const upsertTramo = calls.find(call => call.query.includes('INSERT INTO rutas_tramos'));
        expect(upsertTramo?.query).toContain('ON CONFLICT (id) DO UPDATE');
        expect(upsertTramo?.params).toContain(tramo.sources.join('\n'));
        expect(upsertTramo?.params).toContain(tramo.sourceNote);
        const upsertOferta = calls.find(call => call.query.includes('INSERT INTO rutas_ofertas'));
        expect(upsertOferta?.query).toContain('ON CONFLICT (tramo_id, concesionaria, resolucion) DO UPDATE');
        expect(upsertOferta?.params).toEqual([oferta.tramoId, oferta.concesionaria, oferta.tarifa, oferta.gano, oferta.resolucion, oferta.fuenteUrl]);
        expect(database.transaction).toHaveBeenCalledOnce();
        expect(calls.some(call => call.query.includes('DELETE'))).toBe(false);
    });
});

it('admin replace keeps imported sources: deletes only missing ids and upserts the rest', async () => {
    await replaceRutasTramos(seedTramos().slice(0, 1));
    const queries = database.query.mock.calls.map(([query, params]) => ({ query: String(query), params }));
    expect(queries.find(call => call.query.includes('DELETE FROM rutas_tramos'))).toMatchObject({ query: expect.stringContaining('NOT (id = ANY($1))'), params: [['oriental']] });
    const insert = queries.find(call => call.query.includes('INSERT INTO rutas_tramos'));
    expect(insert?.query).toContain('ON CONFLICT (id) DO UPDATE');
    expect(insert?.query).not.toContain('fuentes');
});

describe('rutas sectores', () => {
    it('attaches stored km sectors to their tramo and none when the table is empty', async () => {
        database.query.mockImplementation(async (query: string) => {
            if (query.startsWith('SELECT * FROM rutas_tramos')) return [{ id: 'pampa', nombre: 'Pampa', rutas: '5', etapa: 'concesionado', pavimento: 'sin-dato' }, { id: 'cuyo', nombre: 'Cuyo', rutas: '7', etapa: 'concesionado', pavimento: 'sin-dato' }];
            if (query.startsWith('SELECT * FROM rutas_sectores')) return [{ tramo_id: 'pampa', ruta: '5', desde_km: '65', hasta_km: '606.65', km: '546.65', origin_km: '65' }];
            return [];
        });
        const [pampa, cuyo] = await getRutasTramos();
        expect(pampa.sectores).toEqual([{ tramoId: 'pampa', ruta: '5', desdeKm: 65, hastaKm: 606.65, km: 546.65, originKm: 65 }]);
        expect(cuyo.sectores).toBeUndefined();
        const statements = database.query.mock.calls.map(([query]) => String(query));
        expect(statements.every(query => query.startsWith('SELECT'))).toBe(true);
    });

    it('import upserts sectors by tramo, route and start km', async () => {
        const { importRutas } = await import('../lib/db/rutas');
        await importRutas([], [], RUTAS_SECTORES.slice(0, 1));
        const insert = database.query.mock.calls.map(([query, params]) => ({ query: String(query), params })).find(call => call.query.includes('INSERT INTO rutas_sectores'));
        expect(insert?.query).toContain('ON CONFLICT (tramo_id, ruta, desde_km) DO UPDATE');
        const [first] = RUTAS_SECTORES;
        expect(insert?.params).toEqual([first.tramoId, first.ruta, first.desdeKm, first.hastaKm, first.km, first.originKm ?? null]);
    });
});

describe('rutas readers', () => {
    const missingTable = () => Object.assign(new Error('relation "rutas_tramos" does not exist'), { code: '42P01' });

    it('only SELECT and return empty when the tables were never imported', async () => {
        database.query.mockRejectedValue(missingTable());
        await expect(getRutasTramos()).resolves.toEqual([]);
        await expect(getRutasOfertas()).resolves.toEqual([]);
        const statements = database.query.mock.calls.map(([query]) => String(query));
        expect(statements.every(query => query.startsWith('SELECT'))).toBe(true);
    });

    it('rethrow any other database error', async () => {
        database.query.mockRejectedValue(new Error('connection refused'));
        await expect(getRutasTramos()).rejects.toThrow('connection refused');
        await expect(getRutasOfertas()).rejects.toThrow('connection refused');
    });
});

describe('rutas admin replace', () => {
    it('creates every rutas table before writing', async () => {
        await replaceRutasTramos([]);
        const statements = database.query.mock.calls.map(([query]) => String(query));
        for (const table of ['rutas_tramos', 'rutas_ofertas', 'rutas_sectores']) {
            expect(statements.some(query => query.includes(`CREATE TABLE IF NOT EXISTS ${table}`))).toBe(true);
        }
    });

    it('deletes the sectors and offers of removed tramos in the same transaction', async () => {
        await replaceRutasTramos(seedTramos().slice(0, 1));
        const [queries] = database.transaction.mock.calls[0] as [unknown[]];
        const inTransaction = database.query.mock.calls.slice(-queries.length).map(([query, params]) => ({ query: String(query), params }));
        for (const table of ['rutas_sectores', 'rutas_ofertas']) {
            expect(inTransaction.find(call => call.query.includes(`DELETE FROM ${table}`))).toMatchObject({
                query: expect.stringContaining('NOT (tramo_id = ANY($1))'),
                params: [['oriental']],
            });
        }
    });
});

describe('rutas red nacional', () => {
    it('reads the stored national network total with its source', async () => {
        database.query.mockResolvedValueOnce([{ id: 'nacional', km: '40198', fuente: 'Gobierno nacional', fuente_url: 'https://example.com/red' }]);
        await expect(getRutasRed()).resolves.toEqual({ km: 40198, fuente: 'Gobierno nacional', fuenteUrl: 'https://example.com/red' });
        expect(String(database.query.mock.calls[0]?.[0])).toContain('FROM rutas_red');
    });
    it('is null when nothing is stored', async () => {
        await expect(getRutasRed()).resolves.toBeNull();
    });
    it('import upserts the network total in the same transaction', async () => {
        const { importRutas } = await import('../lib/db/rutas');
        await importRutas([], [], [], { km: 40198, fuente: 'Gobierno nacional', fuenteUrl: 'https://example.com/red' });
        const calls = database.query.mock.calls.map(([query, params]) => ({ query: String(query), params }));
        expect(calls.some(call => call.query.includes('CREATE TABLE IF NOT EXISTS rutas_red'))).toBe(true);
        const upsert = calls.find(call => call.query.includes('INSERT INTO rutas_red'));
        expect(upsert?.query).toContain('ON CONFLICT (id) DO UPDATE');
        expect(upsert?.params).toEqual(['nacional', 40198, 'Gobierno nacional', 'https://example.com/red']);
        expect(database.transaction).toHaveBeenCalledOnce();
    });
});

describe('rutas largos', () => {
    const largo = { ruta: '5', km: 590.4, fuente: 'IGN', fuenteUrl: 'https://wms.ign.gob.ar/geoserver/ows' };
    it('reads the stored route lengths', async () => {
        database.query.mockResolvedValueOnce([{ ruta: '5', km: '590.4', fuente: 'IGN', fuente_url: 'https://wms.ign.gob.ar/geoserver/ows' }]);
        await expect(getRutasLargos()).resolves.toEqual([largo]);
        expect(String(database.query.mock.calls[0]?.[0])).toContain('FROM rutas_largo');
    });
    it('import upserts each route length in the same transaction', async () => {
        const { importRutas } = await import('../lib/db/rutas');
        await importRutas([], [], [], undefined, [largo]);
        const calls = database.query.mock.calls.map(([query, params]) => ({ query: String(query), params }));
        expect(calls.some(call => call.query.includes('CREATE TABLE IF NOT EXISTS rutas_largo'))).toBe(true);
        const upsert = calls.find(call => call.query.includes('INSERT INTO rutas_largo'));
        expect(upsert?.query).toContain('ON CONFLICT (ruta) DO UPDATE');
        expect(upsert?.params).toEqual(['5', 590.4, 'IGN', 'https://wms.ign.gob.ar/geoserver/ows']);
        expect(database.transaction).toHaveBeenCalledOnce();
    });
});
