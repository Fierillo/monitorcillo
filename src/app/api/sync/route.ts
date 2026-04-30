import { NextResponse } from 'next/server';
import { runSync } from '@/lib/sync';
import { isAuthenticated } from '@/lib/auth';

export async function POST(req: Request) {
    const auth = await isAuthenticated();
    if (!auth) {
        const apiKey = req.headers.get('x-api-key');
        const validKey = process.env.SYNC_API_KEY;
        
        if (!validKey || apiKey !== validKey) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
    }

    try {
        const results = await runSync();
        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error('Sync error:', error);
        const details = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: 'Sync failed', details }, { status: 500 });
    }
}
