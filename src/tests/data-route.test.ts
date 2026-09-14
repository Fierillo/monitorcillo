import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '../lib/rate-limit';
import type { EmisionRawRow } from '@/types';

const mocks = vi.hoisted(() => ({
    getIndicators: vi.fn(),
    getNormalizedData: vi.fn(),
    isAuthenticated: vi.fn(),
    getRawData: vi.fn(),
    saveRawData: vi.fn(),
    replaceNormalizedData: vi.fn(),
    saveIndicators: vi.fn(),
}));

vi.mock('@/lib/indicators', () => ({ getIndicators: mocks.getIndicators, saveIndicators: mocks.saveIndicators }));
vi.mock('@/lib/auth', () => ({ isAuthenticated: mocks.isAuthenticated }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/db', () => ({
    default: {
        getNormalizedData: mocks.getNormalizedData,
        getRawData: mocks.getRawData,
        saveRawData: mocks.saveRawData,
        replaceNormalizedData: mocks.replaceNormalizedData,
    },
}));

import { GET, POST } from '../app/api/data/route';

function dataRequest(type?: string, ip = '203.0.113.20'): Request {
    const url = new URL('http://localhost/api/data');
    if (type) url.searchParams.set('type', type);
    return new Request(url, { headers: { 'x-real-ip': ip } });
}

function emisionRequest(data: unknown[], ip = '203.0.113.30'): Request {
    return new Request('http://localhost/api/data', {
        method: 'POST',
        headers: { 'x-real-ip': ip, 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'emision', data }),
    });
}

function storedEmision(row: Partial<EmisionRawRow>): EmisionRawRow {
    return { fecha: '2026-01-01', compra_dolares: 10, tc: 1000, bcra: 5, vencimientos: null, licitado: null, resultado_fiscal: null, ...row } as EmisionRawRow;
}

beforeEach(() => {
    resetRateLimits();
    Object.values(mocks).forEach(mock => mock.mockReset());
    mocks.isAuthenticated.mockResolvedValue(true);
    mocks.getRawData.mockResolvedValue([]);
    mocks.saveRawData.mockResolvedValue(undefined);
    mocks.replaceNormalizedData.mockResolvedValue(undefined);
});

describe('GET /api/data', () => {
    it('answers with the catalog when the database responds', async () => {
        mocks.getIndicators.mockResolvedValue([{ id: 'icg', dato: '2,41' }]);

        const response = await GET(dataRequest());

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual([{ id: 'icg', dato: '2,41' }]);
    });

    it('answers 503 instead of an empty catalog when the database is unreachable', async () => {
        mocks.getIndicators.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));

        const response = await GET(dataRequest());

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toEqual({ error: 'Indicator data is temporarily unavailable. The database could not be reached.' });
    });

    it('answers 503 instead of an empty series when the database is unreachable', async () => {
        mocks.getNormalizedData.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));

        const response = await GET(dataRequest('emision'));

        expect(response.status).toBe(503);
    });
});

describe('POST /api/data with manual Emision rows', () => {
    it('never rewrites the manual fields of a row the editor did not change', async () => {
        mocks.getRawData.mockResolvedValue([storedEmision({ vencimientos: 500, licitado: 300, resultado_fiscal: -100 })]);

        await POST(emisionRequest([{ iso_fecha: '2026-01-01', CompraDolares: 42 }]));

        const [, savedRows] = mocks.saveRawData.mock.calls[0];
        expect(savedRows).toEqual([{ fecha: '2026-01-01', compra_dolares: 42 }]);
    });

    it('stores an explicit zero typed over an empty manual field', async () => {
        mocks.getRawData.mockResolvedValue([storedEmision({ vencimientos: null })]);

        await POST(emisionRequest([{ iso_fecha: '2026-01-01', Vencimientos: 0 }]));

        const [, savedRows] = mocks.saveRawData.mock.calls[0];
        expect(savedRows).toEqual([{ fecha: '2026-01-01', vencimientos: 0 }]);
    });

    it('clears a manual field emptied in the editor instead of storing a NaN', async () => {
        mocks.getRawData.mockResolvedValue([storedEmision({ licitado: 700 })]);

        await POST(emisionRequest([{ iso_fecha: '2026-01-01', Licitado: '-' }]));

        const [, savedRows] = mocks.saveRawData.mock.calls[0];
        expect(savedRows).toEqual([{ fecha: '2026-01-01', licitado: null }]);
    });

    it('leaves an already empty manual field untouched', async () => {
        mocks.getRawData.mockResolvedValue([storedEmision({ licitado: null })]);

        await POST(emisionRequest([{ iso_fecha: '2026-01-01', Licitado: '-' }]));

        expect(mocks.saveRawData).not.toHaveBeenCalled();
    });

    it('reports the rows it discarded instead of claiming a clean save', async () => {
        const response = await POST(emisionRequest([
            { iso_fecha: '2026-01-01', Vencimientos: 10 },
            { fecha: 'no es una fecha', Vencimientos: 20 },
        ]));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ success: true, updated: 1, skipped: ['no es una fecha'] });
    });
});

describe('POST /api/data failure reporting', () => {
    it('answers 503 when the database is unreachable, not 400', async () => {
        mocks.getRawData.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED 10.0.0.1:5432'), { code: 'ECONNREFUSED' }));

        const response = await POST(emisionRequest([{ iso_fecha: '2026-01-01', Vencimientos: 10 }]));

        expect(response.status).toBe(503);
        expect(mocks.saveRawData).not.toHaveBeenCalled();
    });

    it('does not leak the internal database error to the client', async () => {
        mocks.getRawData.mockRejectedValue(new Error('connect ECONNREFUSED 10.0.0.1:5432'));

        const response = await POST(emisionRequest([{ iso_fecha: '2026-01-01', Vencimientos: 10 }]));

        await expect(response.json()).resolves.not.toHaveProperty('error', expect.stringContaining('10.0.0.1'));
    });

    it('still answers 400 when the payload itself is invalid', async () => {
        const response = await POST(new Request('http://localhost/api/data', {
            method: 'POST',
            headers: { 'x-real-ip': '203.0.113.31', 'content-type': 'application/json' },
            body: JSON.stringify({ type: 'otra cosa' }),
        }));

        expect(response.status).toBe(400);
    });
});
