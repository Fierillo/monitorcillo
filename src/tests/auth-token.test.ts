import { afterEach, describe, expect, it } from 'vitest';
import { AUTH_MAX_AGE_SECONDS, createAuthToken, getAdminPassword, verifyAdminPassword, verifyAuthToken } from '../lib/auth-token';

const originalAdminPassword = process.env.ADMIN_PASSWORD;

afterEach(() => {
    if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdminPassword;
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
});
