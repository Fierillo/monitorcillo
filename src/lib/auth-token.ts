import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { isNonceRevoked, revokeNonce } from './auth-revocation';

export const AUTH_COOKIE_NAME = 'auth_token';
export const AUTH_MAX_AGE_SECONDS = 60 * 60 * 24;
export const MIN_AUTH_SECRET_LENGTH = 32;
export const MIN_ADMIN_PASSWORD_LENGTH = 16;

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

function signPayload(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('base64url');
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

/** HMAC key for session tokens. Kept apart from ADMIN_PASSWORD; null (fail closed) when missing or too short. */
export function getAuthSecret(): string | null {
    const secret = process.env.AUTH_SECRET;
    return secret && secret.length >= MIN_AUTH_SECRET_LENGTH ? secret : null;
}

export function verifyAdminPassword(candidate: unknown, adminPassword = getAdminPassword()): boolean {
    if (!adminPassword || typeof candidate !== 'string') return false;
    return safeEqual(candidate, adminPassword);
}

export function createAuthToken(secret: string, now = Date.now()): string {
    const payload = Buffer.from(JSON.stringify({
        exp: now + AUTH_MAX_AGE_SECONDS * 1000,
        nonce: randomBytes(16).toString('base64url'),
    })).toString('base64url');

    return `${payload}.${signPayload(payload, secret)}`;
}

function readAuthToken(token: unknown, secret: string | null, now: number): AuthTokenPayload | null {
    if (!secret || typeof token !== 'string') return null;

    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payload, signature] = parts;
    if (!payload || !signature || !safeEqual(signature, signPayload(payload, secret))) return null;

    const parsed = parsePayload(payload);
    return parsed !== null && parsed.exp > now ? parsed : null;
}

export function verifyAuthToken(token: unknown, secret = getAuthSecret(), now = Date.now()): boolean {
    return readAuthToken(token, secret, now) !== null;
}

/** Signature, expiry and server-side revocation (logout). */
export async function isAuthTokenActive(token: unknown, secret = getAuthSecret(), now = Date.now()): Promise<boolean> {
    const parsed = readAuthToken(token, secret, now);
    return parsed !== null && !await isNonceRevoked(parsed.nonce);
}

export async function revokeAuthToken(token: unknown, secret = getAuthSecret(), now = Date.now()): Promise<void> {
    const parsed = readAuthToken(token, secret, now);
    if (parsed) await revokeNonce(parsed.nonce, parsed.exp);
}
