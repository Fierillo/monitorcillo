import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export const AUTH_COOKIE_NAME = 'auth_token';
export const AUTH_MAX_AGE_SECONDS = 60 * 60 * 24;

type AuthTokenPayload = {
    exp: number;
    nonce: string;
};

function safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) return false;
    return timingSafeEqual(leftBuffer, rightBuffer);
}

function signPayload(payload: string, adminPassword: string): string {
    return createHmac('sha256', adminPassword).update(payload).digest('base64url');
}

function parsePayload(payload: string): AuthTokenPayload | null {
    try {
        const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<AuthTokenPayload>;
        if (typeof parsed.exp !== 'number' || !Number.isFinite(parsed.exp) || typeof parsed.nonce !== 'string') return null;
        return { exp: parsed.exp, nonce: parsed.nonce };
    } catch {
        return null;
    }
}

export function getAdminPassword(): string | null {
    const password = process.env.ADMIN_PASSWORD;
    return password && password.length > 0 ? password : null;
}

export function verifyAdminPassword(candidate: unknown, adminPassword = getAdminPassword()): boolean {
    if (!adminPassword || typeof candidate !== 'string') return false;
    return safeEqual(candidate, adminPassword);
}

export function createAuthToken(adminPassword: string, now = Date.now()): string {
    const payload = Buffer.from(JSON.stringify({
        exp: now + AUTH_MAX_AGE_SECONDS * 1000,
        nonce: randomBytes(16).toString('base64url'),
    })).toString('base64url');

    return `${payload}.${signPayload(payload, adminPassword)}`;
}

export function verifyAuthToken(token: unknown, adminPassword = getAdminPassword(), now = Date.now()): boolean {
    if (!adminPassword || typeof token !== 'string') return false;

    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [payload, signature] = parts;
    if (!payload || !signature || !safeEqual(signature, signPayload(payload, adminPassword))) return false;

    const parsed = parsePayload(payload);
    return parsed !== null && parsed.exp > now;
}
