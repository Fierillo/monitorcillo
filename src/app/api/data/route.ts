import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getIndicators, saveIndicators } from '@/lib/indicators';
import { isAuthenticated } from '@/lib/auth';
import db from '@/lib/db';
import { normalizeEmision, fechaToISO, isoToFecha } from '@/lib/normalize';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    
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

    try {
        const body = await req.json();
        
        if (body.type === 'emision' && body.data) {
            const incomingData = Array.isArray(body.data) ? body.data : [];
            const existingRaw = await db.getRawData('emision');
            const existingMap = new Map(existingRaw.map(r => [r.fecha, r]));

            const rowsToUpsert: any[] = [];

            for (const row of incomingData) {
                const iso_fecha = row.iso_fecha || (typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(row.fecha));
                if (!iso_fecha || !/^\d{4}-\d{2}-\d{2}$/.test(iso_fecha)) {
                    continue; // Skip invalid dates
                }

                const existing = existingMap.get(iso_fecha);
                
                // Fields provided by the admin panel (mapped to DB columns)
                const incomingValues: any = {
                    fecha: iso_fecha,
                    compra_dolares: row.CompraDolares !== undefined ? Number(row.CompraDolares) : undefined,
                    tc: row.TC !== undefined ? Number(row.TC) : undefined,
                    bcra: row.BCRA !== undefined ? Number(row.BCRA) : undefined,
                    vencimientos: row.Vencimientos !== undefined ? Number(row.Vencimientos) : undefined,
                    licitado: row.Licitado !== undefined ? Number(row.Licitado) : undefined,
                    resultado_fiscal: row['Resultado fiscal'] !== undefined ? Number(row['Resultado fiscal']) : undefined,
                };

                if (!existing) {
                    // New row: include all provided values
                    const newRow: any = { fecha: iso_fecha };
                    Object.keys(incomingValues).forEach(k => {
                        if (incomingValues[k] !== undefined) newRow[k] = incomingValues[k];
                    });
                    rowsToUpsert.push(newRow);
                } else {
                    // Existing row: only include columns that are DIFFERENT or manually editable
                    const diffRow: any = { fecha: iso_fecha };
                    let hasChanges = false;

                    // Manual columns (Always check these)
                    const manualKeys = ['vencimientos', 'licitado', 'resultado_fiscal'];
                    for (const k of manualKeys) {
                        const val = incomingValues[k];
                        if (val !== undefined && Number(val) !== Number(existing[k] ?? 0)) {
                            diffRow[k] = val;
                            hasChanges = true;
                        }
                    }

                    // API columns (only update if explicitly provided and different)
                    const apiKeys = ['compra_dolares', 'tc', 'bcra'];
                    for (const k of apiKeys) {
                        const val = incomingValues[k];
                        if (val !== undefined && Number(val) !== Number(existing[k] ?? 0)) {
                            diffRow[k] = val;
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
        
        // Save regular indicators
        await saveIndicators(body);
        revalidatePath('/');
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('[api/data] error:', error);
        return NextResponse.json({ error: error.message || 'Failed to save data' }, { status: 400 });
    }
}
