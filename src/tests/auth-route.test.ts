import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from '../app/api/auth/route';
import { resetRateLimits } from '../lib/rate-limit';

const originalAdminPassword = process.env.ADMIN_PASSWORD;

function authRequest(password: string): Request {
    return new Request('http://localhost/api/auth', {
        method: 'POST',
        body: JSON.stringify({ password }),
    });
}

beforeEach(() => {
    resetRateLimits();
});

afterEach(() => {
    if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdminPassword;
});

describe('auth route', () => {
    it('fails closed when ADMIN_PASSWORD is missing', async () => {
        delete process.env.ADMIN_PASSWORD;

        const response = await POST(authRequest('anything'));

        expect(response.status).toBe(503);
    });

    it('rate limits login attempts to one request per five minutes', async () => {
        process.env.ADMIN_PASSWORD = 'strong-admin-password';

        const firstResponse = await POST(authRequest('wrong-password'));
        const secondResponse = await POST(authRequest('strong-admin-password'));

        expect(firstResponse.status).toBe(401);
        expect(secondResponse.status).toBe(429);
    });

    it('sets a signed auth cookie on successful login', async () => {
        process.env.ADMIN_PASSWORD = 'strong-admin-password';

        const response = await POST(authRequest('strong-admin-password'));

        expect(response.status).toBe(200);
        expect(response.headers.get('set-cookie')).toContain('auth_token=');
        expect(response.headers.get('set-cookie')).not.toContain('auth_token=authenticated');
    });
});
