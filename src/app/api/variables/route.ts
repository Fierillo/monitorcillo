import { NextResponse } from 'next/server';
import { fetchBcraVariable } from '@/lib/bcra';
import { isAuthenticated } from '@/lib/auth';

export async function GET(request: Request) {
    const auth = await isAuthenticated();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id') || '4', 10);
    const from = searchParams.get('from') || '2026-01-01';
    const to = searchParams.get('to') || '2026-12-31';

    const data = await fetchBcraVariable(id, from, to);
    return NextResponse.json(data);
}
