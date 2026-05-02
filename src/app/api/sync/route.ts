import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { runSync } from '@/lib/sync';
import { getAdminPassword, verifyAdminPassword } from '@/lib/auth-token';
import { checkRequestRateLimit } from '@/lib/rate-limit';

export async function POST(req: Request) {
    const adminPassword = getAdminPassword();
    if (!adminPassword) {
        return NextResponse.json({ error: 'Sync is not configured' }, { status: 503 });
    }

    if (!verifyAdminPassword(req.headers.get('x-api-key'), adminPassword)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!checkRequestRateLimit(req, 'api:sync')) {
        return NextResponse.json({ error: 'Too many requests. Try again in 5 minutes.' }, { status: 429 });
    }

    try {
        const results = await runSync();
        revalidatePath('/');
        revalidatePath('/admin');
        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error('Sync error:', error);
        const details = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Sync failed', details }, { status: 500 });
    }
}
