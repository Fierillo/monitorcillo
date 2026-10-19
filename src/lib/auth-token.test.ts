import { describe, expect, it } from 'vitest';
import { AUTH_MAX_AGE_SECONDS, createAuthToken, verifyAdminPassword, verifyAuthToken } from './auth-token';

describe('auth token boundaries', () => {
    it('accepts a token until the exact expiry instant', () => {
        const now = Date.parse('2026-05-01T00:00:00Z');
        const token = createAuthToken('strong-admin-password', now);
        const expiresAt = now + AUTH_MAX_AGE_SECONDS * 1000;

        expect(verifyAuthToken(token, 'strong-admin-password', expiresAt - 1)).toBe(true);
        expect(verifyAuthToken(token, 'strong-admin-password', expiresAt)).toBe(false);
    });

    it('rejects malformed tokens without throwing', () => {
        expect(verifyAuthToken('only-one-part', 'strong-admin-password')).toBe(false);
        expect(verifyAuthToken('a.b.c', 'strong-admin-password')).toBe(false);
        expect(verifyAuthToken('', 'strong-admin-password')).toBe(false);
        expect(verifyAuthToken(null, 'strong-admin-password')).toBe(false);
        expect(verifyAuthToken(1, 'strong-admin-password')).toBe(false);
    });

    it('rejects a password whose length does not match', () => {
        expect(verifyAdminPassword('short', 'much-longer-password')).toBe(false);
        expect(verifyAdminPassword('same-length', 'same-length')).toBe(true);
        expect(verifyAdminPassword(undefined, 'same-length')).toBe(false);
    });
});
