import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getIndicators, saveIndicators } from '@/lib/indicators';
import { isAuthenticated } from '@/lib/auth';
import db from '@/lib/db';
import { applyManualEmisionRows } from '@/lib/emision-manual-entry';
import { parseRutasPayload } from '@/lib/rutas/status';
import { checkRequestRateLimit, READ_RATE_LIMIT } from '@/lib/rate-limit';
import type { EmisionPostBody, IndicatorsPostBody, RutasPostBody } from '@/types';

function isTypedPostBody(body: unknown, type: 'emision' | 'rutas'): boolean {
    if (!body || typeof body !== 'object') return false;
    const candidate = body as { type?: unknown; data?: unknown };
    return candidate.type === type && Array.isArray(candidate.data);
}

function isEmisionPostBody(body: unknown): body is EmisionPostBody {
    return isTypedPostBody(body, 'emision');
}

function isRutasPostBody(body: unknown): body is RutasPostBody {
    return isTypedPostBody(body, 'rutas');
}

// Real payloads today: catalog ~16 rows (<10 KB), rutas 16 tramos (~15 KB), emision a few hundred daily rows.
const MAX_POST_BODY_BYTES = 1024 * 1024;
const MAX_CATALOG_ROWS = 200;
const MAX_EMISION_ROWS = 5000;
const MAX_RUTAS_ROWS = 500;
const TOO_LARGE = Symbol('too-large');

async function readJsonBody(request: Request): Promise<unknown> {
    if (Number(request.headers.get('content-length') ?? 0) > MAX_POST_BODY_BYTES) return TOO_LARGE;
    try {
        const text = await request.text();
        if (Buffer.byteLength(text, 'utf8') > MAX_POST_BODY_BYTES) return TOO_LARGE;
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function payloadTooLarge(): NextResponse {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 });
}

function databaseUnavailable(error: unknown): NextResponse {
    console.error('[api/data] write failed:', error);
    return NextResponse.json({ error: 'Could not save the data. The database did not respond. Retry in a moment.' }, { status: 503 });
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const scope = type === 'emision' || type === 'rutas' ? type : 'catalog';

    if (!await checkRequestRateLimit(request, `api:data:get:${scope}`, READ_RATE_LIMIT)) {
        return NextResponse.json({ error: 'Too many requests. Try again in 5 minutes.' }, { status: 429 });
    }

    try {
        if (type === 'emision') {
            const data = await db.getNormalizedData('emision');
            return NextResponse.json({ data: data || [] });
        }

        if (type === 'rutas') {
            return NextResponse.json({ data: await db.getRutasTramos() });
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

async function saveRutas(body: RutasPostBody): Promise<NextResponse> {
    let tramos;
    try {
        tramos = parseRutasPayload(body.data);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Los tramos no se pudieron leer. Revisá nombre, rutas y etapa.';
        return NextResponse.json({ error: message }, { status: 400 });
    }

    try {
        await db.replaceRutasTramos(tramos);
        revalidatePath('/');
        revalidatePath('/indicador/rutas-nacionales');
        return NextResponse.json({ success: true, saved: tramos.length });
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
    if (body === TOO_LARGE) return payloadTooLarge();
    if (isEmisionPostBody(body)) return body.data.length > MAX_EMISION_ROWS ? payloadTooLarge() : saveEmision(body);
    if (isRutasPostBody(body)) return body.data.length > MAX_RUTAS_ROWS ? payloadTooLarge() : saveRutas(body);
    if (Array.isArray(body)) return body.length > MAX_CATALOG_ROWS ? payloadTooLarge() : saveCatalog(body as IndicatorsPostBody);

    return NextResponse.json({ error: 'Invalid payload. Send an array of indicators, or { "type": "emision" | "rutas", "data": [...] }.' }, { status: 400 });
}
