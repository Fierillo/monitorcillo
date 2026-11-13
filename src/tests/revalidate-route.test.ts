import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '../lib/rate-limit';

const mocks = vi.hoisted(() => ({
    revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));

import { POST } from '../app/api/revalidate/route';

const originalAdminPassword = process.env.ADMIN_PASSWORD;
const ADMIN_PASSWORD = 'strong-admin-password';

function revalidateRequest(body: unknown, ip = '203.0.113.40'): Request {
    return new Request('http://localhost/api/revalidate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-real-ip': ip },
        body: JSON.stringify(body),
    });
}

beforeEach(() => {
    resetRateLimits();
    mocks.revalidatePath.mockReset();
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
});

afterEach(() => {
    if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdminPassword;
});

describe('POST /api/revalidate', () => {
    it('rejects requests without the admin password', async () => {
        const response = await POST(revalidateRequest({}));

        expect(response.status).toBe(401);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it('rejects requests with the wrong admin password', async () => {
        const response = await POST(revalidateRequest({ password: 'wrong-admin-password' }));

        expect(response.status).toBe(401);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it('revalidates the home page and indicator layout when the admin password matches', async () => {
        const response = await POST(revalidateRequest({ password: ADMIN_PASSWORD }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ success: true });
        expect(mocks.revalidatePath).toHaveBeenCalledWith('/');
        expect(mocks.revalidatePath).toHaveBeenCalledWith('/indicador', 'layout');
    });

    it('applies the same global rate limit as /api/auth across distinct IPs', async () => {
        for (let i = 0; i < 20; i += 1) {
            const response = await POST(revalidateRequest({ password: ADMIN_PASSWORD }, `198.51.100.${i}`));
            expect(response.status).toBe(200);
        }

        const callsBeforeBlock = mocks.revalidatePath.mock.calls.length;
        const blocked = await POST(revalidateRequest({ password: ADMIN_PASSWORD }, '198.51.100.200'));
        expect(blocked.status).toBe(429);
        expect(mocks.revalidatePath).toHaveBeenCalledTimes(callsBeforeBlock);
    });
});
