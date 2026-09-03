import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '../lib/rate-limit';

const mocks = vi.hoisted(() => ({ saveFeedback: vi.fn() }));

vi.mock('@/lib/db/feedback', () => ({ saveFeedback: mocks.saveFeedback }));

import { POST } from '../app/api/feedback/route';

function feedbackRequest(message: string, ip = '203.0.113.10'): Request {
    return new Request('http://localhost/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({
            message,
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
});

describe('feedback route', () => {
    it('validates and stores feedback with its environment', async () => {
        const response = await POST(feedbackRequest('  La serie no se distingue.  '));

        expect(response.status).toBe(201);
        expect(mocks.saveFeedback).toHaveBeenCalledWith({
            message: 'La serie no se distingue.',
            context: expect.objectContaining({
                surface: 'chart',
                metricId: 'emae',
                viewId: 'sectores',
            }),
        });
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
