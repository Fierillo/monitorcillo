import { beforeEach, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));
vi.mock('../lib/db/client', () => ({ sql: database }));

import { getInversiones, importInversiones } from '../lib/db/inversiones';
import { INVERSIONES } from './fixtures/inversiones';

beforeEach(() => {
    database.query.mockReset();
    database.transaction.mockReset();
    database.query.mockResolvedValue([]);
    database.transaction.mockImplementation(async (queries: Array<Promise<unknown>>) => Promise.all(queries));
});

it('returns empty data when the tables are empty, only reading them', async () => {
    await expect(getInversiones()).resolves.toEqual({ approvals: [], observations: [], nonRigi: [] });
    const statements = database.query.mock.calls.map(([query]) => String(query));
    expect(statements).toHaveLength(4);
    expect(statements.every(query => query.startsWith('SELECT'))).toBe(true);
});

it('returns empty data when the tables were never imported', async () => {
    database.query.mockRejectedValue(Object.assign(new Error('relation does not exist'), { code: '42P01' }));
    await expect(getInversiones()).resolves.toEqual({ approvals: [], observations: [], nonRigi: [] });
});

it('rethrows any other database error', async () => {
    database.query.mockRejectedValue(new Error('connection refused'));
    await expect(getInversiones()).rejects.toThrow('connection refused');
});

it('creates the tables, including the approval note column, before importing', async () => {
    await importInversiones({ approvals: [], observations: [], nonRigi: [] });
    const statements = database.query.mock.calls.map(([query]) => String(query));
    for (const table of ['rigi_aprobaciones', 'rigi_observaciones', 'inversiones_no_rigi', 'inversiones_no_rigi_revisiones']) {
        expect(statements.some(query => query.includes(`CREATE TABLE IF NOT EXISTS ${table} `))).toBe(true);
    }
    expect(statements.some(query => query.includes('ALTER TABLE rigi_aprobaciones ADD COLUMN IF NOT EXISTS nota TEXT'))).toBe(true);
});

it('round-trips the approval note', async () => {
    await importInversiones({ approvals: [{ month: '2026-06-01', amountUsdMillions: 5, note: 'PSJ Cobre Mendocino' }], observations: [], nonRigi: [] });
    const insert = database.query.mock.calls.find(([query]) => String(query).includes('INSERT INTO rigi_aprobaciones'));
    expect(insert?.[0]).toContain('nota = EXCLUDED.nota');
    expect(insert?.[1]).toEqual(['2026-06-01', 5, 'PSJ Cobre Mendocino']);
    database.query.mockImplementation(async (query: string) => query.startsWith('SELECT * FROM rigi_aprobaciones')
        ? [{ mes: '2026-06-01', monto_usd_millones: '5', nota: 'PSJ Cobre Mendocino' }, { mes: '2026-07-01', monto_usd_millones: '1', nota: null }]
        : []);
    const { approvals } = await getInversiones();
    expect(approvals).toEqual([{ month: '2026-06-01', amountUsdMillions: 5, note: 'PSJ Cobre Mendocino' }, { month: '2026-07-01', amountUsdMillions: 1 }]);
});

it('maps stored rows, nesting confirmation and revisions', async () => {
    database.query.mockImplementation(async (query: string) => {
        if (query.startsWith('SELECT * FROM rigi_aprobaciones')) return [{ mes: '2025-01-01', monto_usd_millones: '211' }];
        if (query.startsWith('SELECT * FROM rigi_observaciones')) return [{ fecha: new Date('2025-01-03T00:00:00Z'), proyectos_aprobados: 1, monto_aprobado_usd_millones: '211', proyectos_evaluacion: null, monto_evaluacion_usd_millones: '8655', fuente_url: 'https://a' }];
        if (query.startsWith('SELECT * FROM inversiones_no_rigi_revisiones')) return [{ inversion_id: 'x', fecha: '2024-07-11', monto_usd_millones: '870', fuente_url: 'https://r' }];
        if (query.startsWith('SELECT * FROM inversiones_no_rigi')) return [
            { id: 'x', nombre: 'X', empresa: 'E', sector: 'S', monto_usd_millones: '400', anuncio_fecha: '2024-01-01', anuncio_url: 'https://n', confirmacion_fecha: '2024-02-01', confirmacion_url: 'https://c', confirmacion_evidencia: 'Obra' },
            { id: 'y', nombre: 'Y', empresa: 'F', sector: 'S', monto_usd_millones: '5', anuncio_fecha: '2024-01-01', anuncio_url: 'https://m', confirmacion_fecha: null, confirmacion_url: null, confirmacion_evidencia: null },
        ];
        return [];
    });
    await expect(getInversiones()).resolves.toEqual({
        approvals: [{ month: '2025-01-01', amountUsdMillions: 211 }],
        observations: [{ observedAt: '2025-01-03', approvedProjects: 1, approvedAmountUsdMillions: 211, evaluationProjects: null, evaluationAmountUsdMillions: 8655, source: 'https://a' }],
        nonRigi: [
            { id: 'x', name: 'X', company: 'E', sector: 'S', amountUsdMillions: 400, announcement: { date: '2024-01-01', url: 'https://n' }, confirmation: { date: '2024-02-01', url: 'https://c', evidence: 'Obra' }, revisions: [{ date: '2024-07-11', amountUsdMillions: 870, url: 'https://r' }] },
            { id: 'y', name: 'Y', company: 'F', sector: 'S', amountUsdMillions: 5, announcement: { date: '2024-01-01', url: 'https://m' }, confirmation: null },
        ],
    });
});

it('imports all data with idempotent upserts in one transaction', async () => {
    await importInversiones(INVERSIONES);
    expect(database.transaction).toHaveBeenCalledOnce();
    const inserts = database.query.mock.calls.map(([query]) => String(query)).filter(query => query.includes('INSERT INTO'));
    const revisions = INVERSIONES.nonRigi.reduce((sum, item) => sum + (item.revisions?.length ?? 0), 0);
    expect(inserts).toHaveLength(INVERSIONES.approvals.length + INVERSIONES.observations.length + INVERSIONES.nonRigi.length + revisions);
    expect(inserts.every(query => query.includes('ON CONFLICT'))).toBe(true);
    expect(database.query.mock.calls.some(([query]) => String(query).includes('DELETE'))).toBe(false);
});
