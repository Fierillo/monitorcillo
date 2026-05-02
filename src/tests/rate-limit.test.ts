import { beforeEach, describe, expect, it } from 'vitest';
import { READ_RATE_LIMIT, checkRateLimit, resetRateLimits } from '../lib/rate-limit';

beforeEach(() => {
    resetRateLimits();
});

describe('rate limit profiles', () => {
    it('allows one strict request per window', () => {
        expect(checkRateLimit('ip:POST:/api/auth')).toBe(true);
        expect(checkRateLimit('ip:POST:/api/auth')).toBe(false);
    });

    it('allows thirty read requests per window', () => {
        for (let i = 0; i < 30; i += 1) {
            expect(checkRateLimit('ip:GET:/api/data', READ_RATE_LIMIT)).toBe(true);
        }

        expect(checkRateLimit('ip:GET:/api/data', READ_RATE_LIMIT)).toBe(false);
    });
});
