import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getIndicators, saveIndicators } from '@/lib/indicators';
import { isAuthenticated } from '@/lib/auth';
import db from '@/lib/db';
import { applyManualEmisionRows } from '@/lib/emision-manual-entry';
import { checkRequestRateLimit, READ_RATE_LIMIT } from '@/lib/rate-limit';
import type { EmisionPostBody, IndicatorsPostBody } from '@/types';

function isEmisionPostBody(body: unknown): body is EmisionPostBody {
    if (!body || typeof body !== 'object') return false;
    const candidate = body as { type?: unknown; data?: unknown };
    return candidate.type === 'emision' && Array.isArray(candidate.data);
}

async function readJsonBody(request: Request): Promise<unknown> {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

function databaseUnavailable(error: unknown): NextResponse {
    console.error('[api/data] write failed:', error);
    return NextResponse.json({ error: 'Could not save the data. The database did not respond. Retry in a moment.' }, { status: 503 });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!await checkRequestRateLimit(request, `api:data:get:${type ?? 'catalog'}`, READ_RATE_LIMIT)) {
        return NextResponse.json({ error: 'Too many requests. Try again in 5 minutes.' }, { status: 429 });
    }

    try {
        if (type === 'emision') {
            const data = await db.getNormalizedData('emision');
            return NextResponse.json({ data: data || [] });
        }

        return NextResponse.json(await getIndicators());
    } catch (error) {
        console.error('[api/data] read failed:', error);
        return NextResponse.json({ error: 'Indicator data is temporarily unavailable. The database could not be reached.' }, { status: 503 });
    }
}

async function saveEmision(body: EmisionPostBody): Promise<NextResponse> {
    try {
        const result = await applyManualEmisionRows(body.data);
        revalidatePath('/');
        revalidatePath('/indicador/emision');
        return NextResponse.json({ success: true, ...result });
    } catch (error) {
        return databaseUnavailable(error);
    }
}

async function saveCatalog(body: IndicatorsPostBody): Promise<NextResponse> {
    try {
        await saveIndicators(body);
        revalidatePath('/');
        return NextResponse.json({ success: true });
    } catch (error) {
        return databaseUnavailable(error);
    }
}

export async function POST(req: Request) {
    if (!await isAuthenticated()) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!await checkRequestRateLimit(req, 'api:data:post')) {
        return NextResponse.json({ error: 'Too many requests. Try again in 5 minutes.' }, { status: 429 });
    }

    const body = await readJsonBody(req);
    if (isEmisionPostBody(body)) return saveEmision(body);
    if (Array.isArray(body)) return saveCatalog(body as IndicatorsPostBody);

    return NextResponse.json({ error: 'Invalid payload. Send an array of indicators, or { "type": "emision", "data": [...] }.' }, { status: 400 });
}
