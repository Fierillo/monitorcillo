import { NextResponse } from 'next/server';
import { checkRateLimit, checkRequestRateLimit } from '@/lib/rate-limit';
import {
    AUTH_COOKIE_NAME,
    AUTH_MAX_AGE_SECONDS,
    MIN_ADMIN_PASSWORD_LENGTH,
    createAuthToken,
    getAdminPassword,
    getAuthSecret,
    revokeAuthToken,
    verifyAdminPassword,
} from '@/lib/auth-token';

const GLOBAL_AUTH_RATE_LIMIT = { maxAttempts: 20, windowMs: 5 * 60 * 1000 };

function tooManyAttempts(): NextResponse {
    return NextResponse.json({ error: 'Too many attempts. Try again in 5 minutes.' }, { status: 429 });
}

function notConfigured(reason: string): NextResponse {
    console.error(`[api/auth] login disabled: ${reason}`);
    return NextResponse.json({ error: 'Authentication is not configured' }, { status: 503 });
}

function readCookie(req: Request, name: string): string | undefined {
    for (const part of (req.headers.get('cookie') ?? '').split(';')) {
        const [key, ...value] = part.trim().split('=');
        if (key === name) return value.join('=');
    }
    return undefined;
}

export async function POST(req: Request) {
    try {
        if (!await checkRequestRateLimit(req, 'api:auth')) return tooManyAttempts();
        if (!await checkRateLimit('global:api:auth', GLOBAL_AUTH_RATE_LIMIT)) return tooManyAttempts();

        const { password } = await req.json();
        const adminPassword = getAdminPassword();
        const authSecret = getAuthSecret();

        if (!adminPassword) return notConfigured('ADMIN_PASSWORD is not set');
        if (adminPassword.length < MIN_ADMIN_PASSWORD_LENGTH) {
            return notConfigured(`ADMIN_PASSWORD must be at least ${MIN_ADMIN_PASSWORD_LENGTH} characters`);
        }
        if (!authSecret) return notConfigured('AUTH_SECRET is missing or shorter than 32 characters');

        if (!verifyAdminPassword(password, adminPassword)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const res = NextResponse.json({ success: true });

        // Browsers accept Secure cookies on http://localhost, so dev login keeps working.
        res.cookies.set({
            name: AUTH_COOKIE_NAME,
            value: createAuthToken(authSecret),
            httpOnly: true,
            path: '/',
            secure: true,
            sameSite: 'strict',
            maxAge: AUTH_MAX_AGE_SECONDS,
        });

        return res;
    } catch {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
}

export async function DELETE(req: Request) {
    try {
        await revokeAuthToken(readCookie(req, AUTH_COOKIE_NAME));
    } catch (error) {
        console.error('[api/auth] could not revoke session:', error);
        return NextResponse.json({ error: 'Could not log out. Retry in a moment.' }, { status: 503 });
    }
    const res = NextResponse.json({ success: true });
    res.cookies.delete(AUTH_COOKIE_NAME);
    return res;
}
