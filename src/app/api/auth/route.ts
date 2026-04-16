import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

const AUTH_TOKEN = 'authenticated';

function getClientIP(req: Request): string {
    const forwarded = req.headers.get('x-forwarded-for');
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.headers.get('x-real-ip') || 'unknown';
}

export async function POST(req: Request) {
    try {
        const ip = getClientIP(req);
        
        if (!checkRateLimit(ip)) {
            return NextResponse.json(
                { error: 'Too many attempts. Try again in 5 minutes.' },
                { status: 429 }
            );
        }

        const { password } = await req.json();
        const adminPass = process.env.ADMIN_PASSWORD || 'monitordefault';

        if (password !== adminPass) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const res = NextResponse.json({ success: true });

        res.cookies.set({
            name: 'auth_token',
            value: AUTH_TOKEN,
            httpOnly: true,
            path: '/',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 60 * 24
        });

        return res;
    } catch {
        return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
}

export async function DELETE() {
    const res = NextResponse.json({ success: true });
    res.cookies.delete('auth_token');
    return res;
}
