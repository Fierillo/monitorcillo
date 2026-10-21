import { afterEach, describe, expect, it } from 'vitest';
import { AUTH_MAX_AGE_SECONDS, createAuthToken, getAdminPassword, getAuthSecret, isAuthTokenActive, revokeAuthToken, verifyAdminPassword, verifyAuthToken } from '../lib/auth-token';
import { resetRevokedAuthTokens } from '../lib/auth-revocation';

const SECRET = 'a'.repeat(32);

const originalAdminPassword = process.env.ADMIN_PASSWORD;
const originalAuthSecret = process.env.AUTH_SECRET;

afterEach(() => {
    if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdminPassword;
    if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = originalAuthSecret;
    resetRevokedAuthTokens();
});

describe('auth token', () => {
    it('rejects the legacy fixed cookie value', () => {
        expect(verifyAuthToken('authenticated', 'strong-admin-password')).toBe(false);
    });

    it('accepts signed tokens and rejects tampered or expired tokens', () => {
        const now = new Date('2026-05-01T00:00:00Z').getTime();
        const token = createAuthToken('strong-admin-password', now);

        expect(verifyAuthToken(token, 'strong-admin-password', now)).toBe(true);
        expect(verifyAuthToken(`${token}x`, 'strong-admin-password', now)).toBe(false);
        expect(verifyAuthToken(token, 'wrong-password', now)).toBe(false);
        expect(verifyAuthToken(token, 'strong-admin-password', now + AUTH_MAX_AGE_SECONDS * 1000 + 1)).toBe(false);
    });

    it('does not provide a default admin password', () => {
        delete process.env.ADMIN_PASSWORD;

        expect(getAdminPassword()).toBeNull();
        expect(verifyAdminPassword('monitordefault')).toBe(false);
    });

    it('requires an AUTH_SECRET of at least 32 characters', () => {
        delete process.env.AUTH_SECRET;
        expect(getAuthSecret()).toBeNull();
        process.env.AUTH_SECRET = 'short-secret';
        expect(getAuthSecret()).toBeNull();
        process.env.AUTH_SECRET = SECRET;
        expect(getAuthSecret()).toBe(SECRET);
    });

    it('signs with AUTH_SECRET, not ADMIN_PASSWORD, and rejects tokens when the secret is missing', () => {
        process.env.ADMIN_PASSWORD = 'strong-admin-password';
        process.env.AUTH_SECRET = SECRET;
        const token = createAuthToken(SECRET);

        expect(verifyAuthToken(token)).toBe(true);
        expect(verifyAuthToken(createAuthToken('strong-admin-password'))).toBe(false);
        delete process.env.AUTH_SECRET;
        expect(verifyAuthToken(token)).toBe(false);
    });

    it('treats a revoked token as inactive', async () => {
        process.env.AUTH_SECRET = SECRET;
        const token = createAuthToken(SECRET);

        await expect(isAuthTokenActive(token)).resolves.toBe(true);
        await revokeAuthToken(token);
        await expect(isAuthTokenActive(token)).resolves.toBe(false);
        await expect(isAuthTokenActive(createAuthToken(SECRET))).resolves.toBe(true);
    });
});
