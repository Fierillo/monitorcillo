import { NextResponse } from 'next/server';
import { getIndicators, saveIndicators } from '@/lib/db';
import { isAuthenticated } from '@/lib/auth';

export async function GET() {
    const data = await getIndicators();
    return NextResponse.json(data);
}

export async function POST(req: Request) {
    const auth = await isAuthenticated();
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const newData = await req.json();
        await saveIndicators(newData);
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}
