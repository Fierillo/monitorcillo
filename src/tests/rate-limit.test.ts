import { beforeEach, describe, expect, it } from 'vitest';
import { READ_RATE_LIMIT, checkRateLimit, resetRateLimits } from '../lib/rate-limit';

beforeEach(() => {
    resetRateLimits();
});

describe('rate limit profiles', () => {
    it('allows one strict request per window', async () => {
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
