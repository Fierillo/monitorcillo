import { beforeEach, describe, expect, it } from 'vitest';
import { STRICT_RATE_LIMIT, checkRateLimit, decideMemoryRateLimit, getClientIP, resetRateLimits } from './rate-limit';

const WINDOW_MS = 5 * 60 * 1000;

beforeEach(() => {
    resetRateLimits();
});

describe('client address', () => {
    it('uses the first address when the platform header lists several', () => {
        const request = new Request('http://localhost/api/auth', {
            headers: { 'x-vercel-forwarded-for': ' 192.0.2.10 , 10.0.0.1' },
        });

        expect(getClientIP(request)).toBe('192.0.2.10');
    });

    it('falls through a blank platform header to x-real-ip', () => {
        const request = new Request('http://localhost/api/auth', {
            headers: {
                'x-vercel-forwarded-for': '   ',
                'x-real-ip': '198.51.100.8',
            },
        });

        expect(getClientIP(request)).toBe('198.51.100.8');
    });

    it('reports unknown when every address header is empty', () => {
        expect(getClientIP(new Request('http://localhost/api/auth'))).toBe('unknown');
    });
});

describe('memory rate limit window', () => {
    const now = 1_000;

    it('blocks on the exact reset instant and opens a fresh window one millisecond later', () => {
        let decision = decideMemoryRateLimit(undefined, now, STRICT_RATE_LIMIT);
        decision = decideMemoryRateLimit(decision.record, now, STRICT_RATE_LIMIT);
        decision = decideMemoryRateLimit(decision.record, now, STRICT_RATE_LIMIT);

        expect(decision).toEqual({ allowed: true, record: { count: 3, resetTime: now + WINDOW_MS } });
        expect(decideMemoryRateLimit(decision.record, decision.record.resetTime, STRICT_RATE_LIMIT).allowed).toBe(false);
        expect(decideMemoryRateLimit(decision.record, decision.record.resetTime + 1, STRICT_RATE_LIMIT)).toEqual({
            allowed: true,
            record: { count: 1, resetTime: decision.record.resetTime + 1 + WINDOW_MS },
        });
    });

    it('keeps separate keys from sharing a budget', async () => {
        resetRateLimits();

        await checkRateLimit('alpha');
        await checkRateLimit('alpha');
        await checkRateLimit('alpha');

        await expect(checkRateLimit('alpha')).resolves.toBe(false);
        await expect(checkRateLimit('beta')).resolves.toBe(true);
    });
});
