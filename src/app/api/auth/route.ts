import { NextResponse } from 'next/server';
import { checkRequestRateLimit } from '@/lib/rate-limit';
import { AUTH_COOKIE_NAME, AUTH_MAX_AGE_SECONDS, createAuthToken, getAdminPassword, verifyAdminPassword } from '@/lib/auth-token';

export async function POST(req: Request) {
    try {
        if (!checkRequestRateLimit(req, 'api:auth')) {
            return NextResponse.json(
                { error: 'Too many attempts. Try again in 5 minutes.' },
                { status: 429 }
            );
        }

        const { password } = await req.json();
        const adminPassword = getAdminPassword();

        if (!adminPassword) {
            return NextResponse.json({ error: 'Authentication is not configured' }, { status: 503 });
        }

        if (!verifyAdminPassword(password, adminPassword)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const res = NextResponse.json({ success: true });

        res.cookies.set({
            name: AUTH_COOKIE_NAME,
            value: createAuthToken(adminPassword),
            httpOnly: true,
            path: '/',
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: AUTH_MAX_AGE_SECONDS,
        });

        return res;
    } catch {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
}

export async function DELETE() {
    const res = NextResponse.json({ success: true });
    res.cookies.delete(AUTH_COOKIE_NAME);
    return res;
}
