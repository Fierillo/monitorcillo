const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 3;

export function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now > record.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + WINDOW_MS });
        return true;
    }

    if (record.count >= MAX_ATTEMPTS) {
        return false;
    }

    record.count++;
    return true;
}

export function getRateLimitRemaining(ip: string): number {
    const record = rateLimitMap.get(ip);
    if (!record || Date.now() > record.resetTime) {
        return MAX_ATTEMPTS;
    }
    return Math.max(0, MAX_ATTEMPTS - record.count);
}