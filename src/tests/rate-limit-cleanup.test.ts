import { afterEach, describe, expect, it, vi } from 'vitest';

const query = vi.hoisted(() => vi.fn(async () => [{ count: 1 }]));
vi.mock('@neondatabase/serverless', () => ({ neon: () => ({ query }) }));

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('rate limit table cleanup', () => {
    it('deletes expired rows from rate_limits so the table does not grow unbounded', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('NEON_URL', 'postgres://example.invalid/db');
        const { checkRateLimit } = await import('../lib/rate-limit');

        await expect(checkRateLimit('ip:POST:api:auth')).resolves.toBe(true);

        const statements = query.mock.calls.map((call) => String((call as unknown[])[0]));
        expect(statements.some((sql) => /DELETE FROM rate_limits WHERE reset_time < NOW\(\)/.test(sql))).toBe(true);
    });
});
