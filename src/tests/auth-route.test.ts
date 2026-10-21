import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DELETE, POST } from '../app/api/auth/route';
import { resetRateLimits } from '../lib/rate-limit';
import { isAuthTokenActive } from '../lib/auth-token';
import { resetRevokedAuthTokens } from '../lib/auth-revocation';

const AUTH_SECRET = 'test-auth-secret-0123456789abcdef';
const originalAuthSecret = process.env.AUTH_SECRET;

const originalAdminPassword = process.env.ADMIN_PASSWORD;

function authRequest(password: string, ip?: string): Request {
    return new Request('http://localhost/api/auth', {
        method: 'POST',
        headers: ip ? { 'x-real-ip': ip } : {},
        body: JSON.stringify({ password }),
    });
}

beforeEach(() => {
    resetRateLimits();
    resetRevokedAuthTokens();
    process.env.AUTH_SECRET = AUTH_SECRET;
});

afterEach(() => {
    if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdminPassword;
    if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalAuthSecret;
});

describe('auth route', () => {
    it('fails closed when ADMIN_PASSWORD is missing', async () => {
        delete process.env.ADMIN_PASSWORD;

        const response = await POST(authRequest('anything'));

        expect(response.status).toBe(503);
    });

    it('rate limits login attempts to three requests per five minutes', async () => {
        process.env.ADMIN_PASSWORD = 'strong-admin-password';

        await POST(authRequest('wrong-1'));
        await POST(authRequest('wrong-2'));
        await POST(authRequest('wrong-3'));
        const blocked = await POST(authRequest('strong-admin-password'));

        expect(blocked.status).toBe(429);
    });

    it('sets a signed auth cookie on successful login', async () => {
        process.env.ADMIN_PASSWORD = 'strong-admin-password';

        const response = await POST(authRequest('strong-admin-password'));

        expect(response.status).toBe(200);
        expect(response.headers.get('set-cookie')).toContain('auth_token=');
        expect(response.headers.get('set-cookie')).not.toContain('auth_token=authenticated');
    });

    it('fails closed when AUTH_SECRET is missing or shorter than 32 characters', async () => {
        process.env.ADMIN_PASSWORD = 'strong-admin-password';
        delete process.env.AUTH_SECRET;
        expect((await POST(authRequest('strong-admin-password', '192.0.2.1'))).status).toBe(503);
        process.env.AUTH_SECRET = 'too-short';
        expect((await POST(authRequest('strong-admin-password', '192.0.2.2'))).status).toBe(503);
    });

    it('fails closed when ADMIN_PASSWORD is shorter than 16 characters', async () => {
        process.env.ADMIN_PASSWORD = 'short-pass';

        const response = await POST(authRequest('short-pass'));

        expect(response.status).toBe(503);
    });

    it('limits login attempts globally across IPs', async () => {
        process.env.ADMIN_PASSWORD = 'strong-admin-password';
        for (let i = 0; i < 20; i += 1) {
            expect((await POST(authRequest('wrong', `198.51.100.${i}`))).status).toBe(401);
        }

        expect((await POST(authRequest('strong-admin-password', '198.51.100.200'))).status).toBe(429);
    });

    it('always marks the auth cookie as secure', async () => {
        process.env.ADMIN_PASSWORD = 'strong-admin-password';

        const response = await POST(authRequest('strong-admin-password'));

        expect(response.headers.get('set-cookie')?.toLowerCase()).toContain('secure');
    });

    it('revokes the session server-side on logout', async () => {
        process.env.ADMIN_PASSWORD = 'strong-admin-password';
        const login = await POST(authRequest('strong-admin-password'));
        const token = /auth_token=([^;]+)/.exec(login.headers.get('set-cookie') ?? '')?.[1];
        expect(token).toBeTruthy();
        await expect(isAuthTokenActive(token)).resolves.toBe(true);

        const logout = await DELETE(new Request('http://localhost/api/auth', {
            method: 'DELETE',
            headers: { cookie: `other=1; auth_token=${token}` },
        }));

        expect(logout.status).toBe(200);
        await expect(isAuthTokenActive(token)).resolves.toBe(false);
    });
});
