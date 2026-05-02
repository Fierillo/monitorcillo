const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 5 * 60 * 1000;

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

export function checkRateLimit(key: string, options: RateLimitOptions = STRICT_RATE_LIMIT): boolean {
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

export function checkRequestRateLimit(req: Request, scope: string, options: RateLimitOptions = STRICT_RATE_LIMIT): boolean {
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
