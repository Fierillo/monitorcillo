import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    revalidatePath: vi.fn(),
    runSync: vi.fn(),
}));

vi.mock('next/cache', () => ({
    revalidatePath: mocks.revalidatePath,
}));

vi.mock('@/lib/sync', () => ({
    runSync: mocks.runSync,
}));

import { POST } from '../app/api/sync/route';
import { resetRateLimits } from '../lib/rate-limit';

const originalAdminPassword = process.env.ADMIN_PASSWORD;

function syncRequest(apiKey?: string): Request {
    return new Request('http://localhost/api/sync', {
        method: 'POST',
        headers: apiKey ? { 'x-api-key': apiKey } : {},
    });
}

beforeEach(() => {
    resetRateLimits();
    mocks.revalidatePath.mockReset();
    mocks.runSync.mockReset();
});

afterEach(() => {
    if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdminPassword;
});

describe('sync route auth', () => {
    it('fails closed when ADMIN_PASSWORD is missing', async () => {
        delete process.env.ADMIN_PASSWORD;

        const response = await POST(syncRequest('anything'));

        expect(response.status).toBe(503);
        expect(mocks.runSync).not.toHaveBeenCalled();
    });

    it('rejects requests without the admin password header', async () => {
        process.env.ADMIN_PASSWORD = 'strong-admin-password';

        const response = await POST(syncRequest('wrong-password'));

        expect(response.status).toBe(401);
        expect(mocks.runSync).not.toHaveBeenCalled();
    });

    it('does not spend the sync rate limit on unauthorized requests', async () => {
        process.env.ADMIN_PASSWORD = 'strong-admin-password';
        mocks.runSync.mockResolvedValue({ bma: { appended: 0, total: 1 } });

        const unauthorizedResponse = await POST(syncRequest('wrong-password'));
        const authorizedResponse = await POST(syncRequest('strong-admin-password'));

        expect(unauthorizedResponse.status).toBe(401);
        expect(authorizedResponse.status).toBe(200);
        expect(mocks.runSync).toHaveBeenCalledOnce();
    });

    it('accepts x-api-key equal to ADMIN_PASSWORD', async () => {
        process.env.ADMIN_PASSWORD = 'strong-admin-password';
        mocks.runSync.mockResolvedValue({ bma: { appended: 0, total: 1 } });

        const response = await POST(syncRequest('strong-admin-password'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mocks.runSync).toHaveBeenCalledOnce();
    });

    it('rate limits repeated sync attempts', async () => {
        process.env.ADMIN_PASSWORD = 'strong-admin-password';
        mocks.runSync.mockResolvedValue({ bma: { appended: 0, total: 1 } });

        const firstResponse = await POST(syncRequest('strong-admin-password'));
        const secondResponse = await POST(syncRequest('strong-admin-password'));

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(429);
        expect(mocks.runSync).toHaveBeenCalledOnce();
    });
});
