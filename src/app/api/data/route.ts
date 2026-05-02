import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getIndicators, saveIndicators } from '@/lib/indicators';
import { isAuthenticated } from '@/lib/auth';
import db from '@/lib/db';
import { normalizeEmision, fechaToISO } from '@/lib/normalize';
import { checkRequestRateLimit, READ_RATE_LIMIT } from '@/lib/rate-limit';
import type { EmisionPostBody, EmisionRawEditableField, EmisionRawRow, IndicatorsPostBody, NumericValue } from '@/types';

function isEmisionPostBody(body: unknown): body is EmisionPostBody {
    if (!body || typeof body !== 'object') return false;
    const candidate = body as { type?: unknown; data?: unknown };
    return candidate.type === 'emision' && Array.isArray(candidate.data);
}

function setEmisionRawValue(row: Partial<EmisionRawRow>, key: EmisionRawEditableField, value: NumericValue): void {
    (row as Record<string, NumericValue>)[key] = value;
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (!await checkRequestRateLimit(request, `api:data:get:${type ?? 'catalog'}`, READ_RATE_LIMIT)) {
        return NextResponse.json({ error: 'Too many requests. Try again in 5 minutes.' }, { status: 429 });
    }
    
    if (type === 'emision') {
        const data = await db.getNormalizedData('emision');
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

    if (!await checkRequestRateLimit(req, 'api:data:post')) {
        return NextResponse.json({ error: 'Too many requests. Try again in 5 minutes.' }, { status: 429 });
    }

    try {
        const body = await req.json() as unknown;
        
        if (isEmisionPostBody(body)) {
            const incomingData = body.data;
            const existingRaw = await db.getRawData('emision');
            const existingMap = new Map(existingRaw.map(r => [r.fecha, r]));

            const rowsToUpsert: Array<Partial<EmisionRawRow>> = [];

            for (const row of incomingData) {
                const iso_fecha = row.iso_fecha || (typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(row.fecha));
                if (!iso_fecha || !/^\d{4}-\d{2}-\d{2}$/.test(iso_fecha)) {
                    continue;
                }

                const existing = existingMap.get(iso_fecha);
                
                const incomingValues: Partial<EmisionRawRow> & { fecha: string } = {
                    fecha: iso_fecha,
                    compra_dolares: row.CompraDolares !== undefined ? Number(row.CompraDolares) : undefined,
                    tc: row.TC !== undefined ? Number(row.TC) : undefined,
                    bcra: row.BCRA !== undefined ? Number(row.BCRA) : undefined,
                    vencimientos: row.Vencimientos !== undefined ? Number(row.Vencimientos) : undefined,
                    licitado: row.Licitado !== undefined ? Number(row.Licitado) : undefined,
                    resultado_fiscal: row['Resultado fiscal'] !== undefined ? Number(row['Resultado fiscal']) : undefined,
                };

                if (!existing) {
                    const newRow: Partial<EmisionRawRow> = { fecha: iso_fecha };
                    const keys: EmisionRawEditableField[] = ['compra_dolares', 'tc', 'bcra', 'vencimientos', 'licitado', 'resultado_fiscal'];
                    for (const key of keys) {
                        if (incomingValues[key] !== undefined) setEmisionRawValue(newRow, key, incomingValues[key]);
                    }
                    rowsToUpsert.push(newRow);
                } else {
                    const diffRow: Partial<EmisionRawRow> = { fecha: iso_fecha };
                    let hasChanges = false;

                    const manualKeys: EmisionRawEditableField[] = ['vencimientos', 'licitado', 'resultado_fiscal'];
                    for (const k of manualKeys) {
                        const val = incomingValues[k];
                        if (val !== undefined && Number(val) !== Number(existing[k] ?? 0)) {
                            setEmisionRawValue(diffRow, k, val);
                            hasChanges = true;
                        }
                    }

                    const apiKeys: EmisionRawEditableField[] = ['compra_dolares', 'tc', 'bcra'];
                    for (const k of apiKeys) {
                        const val = incomingValues[k];
                        if (val !== undefined && Number(val) !== Number(existing[k] ?? 0)) {
                            setEmisionRawValue(diffRow, k, val);
                            hasChanges = true;
                        }
                    }

                    if (hasChanges) {
                        rowsToUpsert.push(diffRow);
                    }
                }
            }

            // 2. Perform upsert on emision_raw for ONLY changed/new columns
            if (rowsToUpsert.length > 0) {
                await db.saveRawData('emision', rowsToUpsert);
            }

            // 3. Re-read the FULL raw table to guarantee perfect accumulation and ordering
            const fullRaw = await db.getRawData('emision');
            const sortedRaw = fullRaw.sort((a, b) => a.fecha.localeCompare(b.fecha));

            // 4. Re-generate and replace emision_normalized cache
            const normalized = normalizeEmision(sortedRaw);
            await db.replaceNormalizedData('emision', normalized);

            revalidatePath('/');
            revalidatePath('/indicador/emision');
            return NextResponse.json({ success: true, updated: rowsToUpsert.length });
        }
        
        if (!Array.isArray(body)) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        await saveIndicators(body as IndicatorsPostBody);
        revalidatePath('/');
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[api/data] error:', error);
        const message = error instanceof Error ? error.message : 'Failed to save data';
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
