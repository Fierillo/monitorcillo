import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getAdminPassword, verifyAdminPassword } from '@/lib/auth-token';
import { checkRateLimit, checkRequestRateLimit } from '@/lib/rate-limit';

const GLOBAL_AUTH_RATE_LIMIT = { maxAttempts: 20, windowMs: 5 * 60 * 1000 };

export async function POST(req: Request) {
    if (!await checkRequestRateLimit(req, 'api:revalidate:post')) {
        return NextResponse.json({ error: 'Too many requests. Try again in 5 minutes.' }, { status: 429 });
    }
    if (!await checkRateLimit('global:api:auth', GLOBAL_AUTH_RATE_LIMIT)) {
        return NextResponse.json({ error: 'Too many requests. Try again in 5 minutes.' }, { status: 429 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const password = body && typeof body === 'object' && 'password' in body
        ? (body as { password?: unknown }).password
        : undefined;

    const adminPassword = getAdminPassword();
    if (!adminPassword || !verifyAdminPassword(password, adminPassword)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    revalidatePath('/');
    revalidatePath('/indicador', 'layout');
    return NextResponse.json({ success: true });
}
