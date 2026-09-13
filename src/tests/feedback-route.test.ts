import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '../lib/rate-limit';

const mocks = vi.hoisted(() => ({
    saveFeedback: vi.fn(),
    setFeedbackImplemented: vi.fn(),
    isAuthenticated: vi.fn(),
}));

vi.mock('@/lib/db/feedback', () => ({
    saveFeedback: mocks.saveFeedback,
    setFeedbackImplemented: mocks.setFeedbackImplemented,
}));
vi.mock('@/lib/auth', () => ({ isAuthenticated: mocks.isAuthenticated }));

import { PATCH, POST } from '../app/api/feedback/route';

function feedbackRequest(message: string, ip = '203.0.113.10', twitterHandle?: string): Request {
    return new Request('http://localhost/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-real-ip': ip },
        body: JSON.stringify({
            message,
            twitterHandle,
            context: {
                surface: 'chart',
                path: '/indicador/emae',
                metricId: 'emae',
                metricTitle: 'EMAE',
                chartTitle: 'EMAE por sector',
                viewId: 'sectores',
                viewTitle: 'Sectores',
            },
        }),
    });
}

beforeEach(() => {
    resetRateLimits();
    mocks.saveFeedback.mockReset();
    mocks.saveFeedback.mockResolvedValue(undefined);
    mocks.setFeedbackImplemented.mockReset();
    mocks.isAuthenticated.mockReset();
    mocks.isAuthenticated.mockResolvedValue(true);
});

describe('feedback route', () => {
    it('validates and stores feedback with its environment', async () => {
        const response = await POST(feedbackRequest('  La serie no se distingue.  '));

        expect(response.status).toBe(201);
        expect(mocks.saveFeedback).toHaveBeenCalledWith({
            message: 'La serie no se distingue.',
            twitterHandle: undefined,
            context: expect.objectContaining({
                surface: 'chart',
                metricId: 'emae',
                viewId: 'sectores',
            }),
        });
    });

    it('stores a twitter handle for credits', async () => {
        const response = await POST(feedbackRequest('La serie no se distingue.', '203.0.113.10', '@Fierillo'));
        expect(response.status).toBe(201);
        expect(mocks.saveFeedback).toHaveBeenCalledWith(expect.objectContaining({ twitterHandle: 'Fierillo' }));
    });

    it('rejects an invalid twitter handle', async () => {
        const response = await POST(feedbackRequest('La serie no se distingue.', '203.0.113.10', 'not a handle'));
        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: 'El usuario de X no es válido. Usá @usuario, sin espacios.' });
        expect(mocks.saveFeedback).not.toHaveBeenCalled();
    });

    it('allows only one feedback per IP every five minutes', async () => {
        await POST(feedbackRequest('Primer mensaje'));
        const blocked = await POST(feedbackRequest('Segundo mensaje'));
        const otherIp = await POST(feedbackRequest('Otra persona', '203.0.113.11'));

        expect(blocked.status).toBe(429);
        await expect(blocked.json()).resolves.toEqual({ error: 'Ya enviaste feedback recientemente. Intentá de nuevo en 5 minutos.' });
        expect(blocked.headers.get('Retry-After')).toBe('300');
        expect(otherIp.status).toBe(201);
        expect(mocks.saveFeedback).toHaveBeenCalledTimes(2);
    });

    it('rejects messages longer than 500 characters', async () => {
        const response = await POST(feedbackRequest('a'.repeat(501)));

        expect(response.status).toBe(400);
        expect(mocks.saveFeedback).not.toHaveBeenCalled();
    });
});

describe('feedback implemented patch', () => {
    function patchRequest(body: unknown): Request {
        return new Request('http://localhost/api/feedback', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
    }

    it('rejects unauthenticated updates', async () => {
        mocks.isAuthenticated.mockResolvedValueOnce(false);
        const response = await PATCH(patchRequest({ id: 3, implemented: true }));
        expect(response.status).toBe(401);
        expect(mocks.setFeedbackImplemented).not.toHaveBeenCalled();
    });

    it('marks feedback as implemented', async () => {
        mocks.setFeedbackImplemented.mockResolvedValueOnce(true);
        const response = await PATCH(patchRequest({ id: 3, implemented: true }));
        expect(response.status).toBe(200);
        expect(mocks.setFeedbackImplemented).toHaveBeenCalledWith(3, true);
    });

    it('returns not found when the feedback does not exist', async () => {
        mocks.setFeedbackImplemented.mockResolvedValueOnce(false);
        const response = await PATCH(patchRequest({ id: 99, implemented: false }));
        expect(response.status).toBe(404);
    });
});
