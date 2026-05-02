import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 5 * 60 * 1000;
let sql: NeonQueryFunction<false, false> | null = null;
let tableReady = false;

type RateLimitOptions = {
    maxAttempts: number;
    windowMs?: number;
};

export const STRICT_RATE_LIMIT: RateLimitOptions = { maxAttempts: 1, windowMs: WINDOW_MS };
export const READ_RATE_LIMIT: RateLimitOptions = { maxAttempts: 30, windowMs: WINDOW_MS };

export function getClientIP(req: Request): string {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.headers.get('x-real-ip') || 'unknown';
}

function getSql(): NeonQueryFunction<false, false> | null {
    if (process.env.NODE_ENV === 'test' || !process.env.NEON_URL) return null;
    sql ??= neon(process.env.NEON_URL);
    return sql;
}

async function ensureRateLimitTable(database: NeonQueryFunction<false, false>): Promise<void> {
    if (tableReady) return;

    await database.query(`
        CREATE TABLE IF NOT EXISTS rate_limits (
            key TEXT PRIMARY KEY,
            count INTEGER NOT NULL,
            reset_time TIMESTAMPTZ NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    `, []);
    await database.query('CREATE INDEX IF NOT EXISTS idx_rate_limits_reset_time ON rate_limits(reset_time)', []);
    tableReady = true;
}

function checkMemoryRateLimit(key: string, options: RateLimitOptions): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(key);
    const windowMs = options.windowMs ?? WINDOW_MS;

    if (!record || now > record.resetTime) {
        rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
        return true;
    }

    if (record.count >= options.maxAttempts) {
        return false;
    }

    record.count++;
    return true;
}

export async function checkRateLimit(key: string, options: RateLimitOptions = STRICT_RATE_LIMIT): Promise<boolean> {
    const database = getSql();
    if (!database) return checkMemoryRateLimit(key, options);

    await ensureRateLimitTable(database);

    const rows = await database.query(`
        INSERT INTO rate_limits (key, count, reset_time, updated_at)
        VALUES ($1, 1, NOW() + ($2::integer * INTERVAL '1 millisecond'), NOW())
        ON CONFLICT (key) DO UPDATE SET
            count = CASE
                WHEN rate_limits.reset_time <= NOW() THEN 1
                ELSE rate_limits.count + 1
            END,
            reset_time = CASE
                WHEN rate_limits.reset_time <= NOW() THEN EXCLUDED.reset_time
                ELSE rate_limits.reset_time
            END,
            updated_at = NOW()
        RETURNING count
    `, [key, options.windowMs ?? WINDOW_MS]) as Array<{ count: number | string }>;

    return Number(rows[0]?.count ?? 0) <= options.maxAttempts;
}

export async function checkRequestRateLimit(req: Request, scope: string, options: RateLimitOptions = STRICT_RATE_LIMIT): Promise<boolean> {
    return checkRateLimit(`${getClientIP(req)}:${req.method}:${scope}`, options);
}

export function getRateLimitRemaining(key: string, options: RateLimitOptions = STRICT_RATE_LIMIT): number {
    const record = rateLimitMap.get(key);
    if (!record || Date.now() > record.resetTime) {
        return options.maxAttempts;
    }
    return Math.max(0, options.maxAttempts - record.count);
}

export function resetRateLimits(): void {
    rateLimitMap.clear();
}
