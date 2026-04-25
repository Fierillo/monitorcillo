import { NextResponse } from 'next/server';
import { getIndicators, saveIndicators } from '@/lib/indicators';
import { isAuthenticated } from '@/lib/auth';
import { getCachedIndicator, saveIndicatorToCache } from '@/lib/storage';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    
    if (type === 'emision') {
        const data = await getCachedIndicator('emision');
        return NextResponse.json({ data: data || [] });
    }
    
    const data = await getIndicators();
    return NextResponse.json(data);
}

export async function POST(req: Request) {
    const auth = await isAuthenticated();
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        
        // Si es un objeto con type='emision', guardar en cache de emisión
        if (body.type === 'emision' && body.data) {
            await saveIndicatorToCache('emision', body.data);
            return NextResponse.json({ success: true });
        }
        
        // Si no, guardar como indicadores regulares
        await saveIndicators(body);
        return NextResponse.json({ success: true });
    } catch {
        return NextResponse.json({ error: 'Failed to save data' }, { status: 500 });
    }
}
