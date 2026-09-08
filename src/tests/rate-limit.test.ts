import { beforeEach, describe, expect, it } from 'vitest';
import { READ_RATE_LIMIT, checkRateLimit, getClientIP, resetRateLimits } from '../lib/rate-limit';

beforeEach(() => {
    resetRateLimits();
});

describe('rate limit profiles', () => {
    it('allows three strict requests per window', async () => {
        await expect(checkRateLimit('ip:POST:/api/auth')).resolves.toBe(true);
        await expect(checkRateLimit('ip:POST:/api/auth')).resolves.toBe(true);
        await expect(checkRateLimit('ip:POST:/api/auth')).resolves.toBe(true);
        await expect(checkRateLimit('ip:POST:/api/auth')).resolves.toBe(false);
    });

    it('allows thirty read requests per window', async () => {
        for (let i = 0; i < 30; i += 1) {
            await expect(checkRateLimit('ip:GET:/api/data', READ_RATE_LIMIT)).resolves.toBe(true);
        }

        await expect(checkRateLimit('ip:GET:/api/data', READ_RATE_LIMIT)).resolves.toBe(false);
    });
});

describe('getClientIP', () => {
    it('prefers Vercel headers over client-supplied x-forwarded-for', () => {
        const request = new Request('http://localhost/api/auth', {
            headers: {
                'x-forwarded-for': '203.0.113.1, 10.0.0.1',
                'x-real-ip': '198.51.100.8',
                'x-vercel-forwarded-for': '192.0.2.44',
            },
        });

        expect(getClientIP(request)).toBe('192.0.2.44');
    });

    it('ignores x-forwarded-for when platform headers are missing', () => {
        const request = new Request('http://localhost/api/auth', {
            headers: { 'x-forwarded-for': '203.0.113.1' },
        });

        expect(getClientIP(request)).toBe('unknown');
    });
});
