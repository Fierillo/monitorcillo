import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '../lib/rate-limit';

const mocks = vi.hoisted(() => ({
    getIndicators: vi.fn(),
    getNormalizedData: vi.fn(),
    isAuthenticated: vi.fn(),
    getRawData: vi.fn(),
    saveRawData: vi.fn(),
    replaceNormalizedData: vi.fn(),
    saveIndicators: vi.fn(),
    getRutasTramos: vi.fn(),
    replaceRutasTramos: vi.fn(),
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
        getRutasTramos: mocks.getRutasTramos,
        replaceRutasTramos: mocks.replaceRutasTramos,
    },
}));

import { GET, POST } from '../app/api/data/route';

beforeEach(() => {
    resetRateLimits();
    Object.values(mocks).forEach(mock => mock.mockReset());
    mocks.isAuthenticated.mockResolvedValue(true);
    mocks.getRutasTramos.mockResolvedValue([]);
    mocks.replaceRutasTramos.mockResolvedValue(undefined);
});

function request(type: string, method = 'GET', body?: unknown, ip = '203.0.113.80'): Request {
    return new Request(`http://localhost/api/data?type=${type}`, {
        method,
        headers: { 'x-real-ip': ip, 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

describe('rutas manual data route', () => {
    it('returns the stored sections', async () => {
        mocks.getRutasTramos.mockResolvedValue([{ id: 'oriental', nombre: 'Tramo Oriental', rutas: ['9'] }]);

        const response = await GET(request('rutas'));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ data: [{ id: 'oriental', nombre: 'Tramo Oriental', rutas: ['9'] }] });
    });

    it('saves a valid editor payload and refreshes the indicator', async () => {
        const response = await POST(request('rutas', 'POST', {
            type: 'rutas',
            data: [{ nombre: 'Tramo Oriental', rutas: '9, 12', km: '320', concesionaria: 'Corredores Viales', etapa: 'concesionado', pavimento: 'regular' }],
        }, '203.0.113.81'));

        expect(response.status).toBe(200);
        expect(mocks.replaceRutasTramos).toHaveBeenCalledWith([expect.objectContaining({
            nombre: 'Tramo Oriental',
            rutas: ['9', '12'],
            km: 320,
            etapa: 'concesionado',
            pavimento: 'regular',
        })]);
    });

    it('rejects an invalid stage before touching the database', async () => {
        const response = await POST(request('rutas', 'POST', {
            type: 'rutas',
            data: [{ nombre: 'Oriental', rutas: '9', etapa: 'adjudicado' }],
        }, '203.0.113.82'));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: 'La etapa del tramo Oriental no es válida. Usá concesionado, en-licitacion o sin-concesionar.',
        });
        expect(mocks.replaceRutasTramos).not.toHaveBeenCalled();
    });

    it('requires an authenticated admin', async () => {
        mocks.isAuthenticated.mockResolvedValue(false);

        const response = await POST(request('rutas', 'POST', { type: 'rutas', data: [] }, '203.0.113.83'));

        expect(response.status).toBe(401);
        expect(mocks.replaceRutasTramos).not.toHaveBeenCalled();
    });
});
