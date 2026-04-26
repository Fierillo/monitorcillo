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
            
            // 1. Validate and convert incoming rows to raw format
            const rowsToUpsert = incomingData.map((row: any) => {
                const iso_fecha = row.iso_fecha || (typeof row.fecha === 'string' && row.fecha.includes('-') ? row.fecha : fechaToISO(row.fecha));
                if (!iso_fecha || !/^\d{4}-\d{2}-\d{2}$/.test(iso_fecha)) {
                    throw new Error(`Invalid date format: ${row.fecha}`);
                }

                return {
                    fecha: iso_fecha,
                    compra_dolares: Number(row.CompraDolares ?? 0),
                    tc: Number(row.TC ?? 0),
                    bcra: Number(row.BCRA ?? 0),
                    vencimientos: Number(row.Vencimientos ?? 0),
                    licitado: Number(row.Licitado ?? 0),
                    resultado_fiscal: Number(row['Resultado fiscal'] ?? 0)
                };
            });

            // 2. Perform upsert on emision_raw
            if (rowsToUpsert.length > 0) {
                await db.saveRawData('emision', rowsToUpsert);
            }

            // 3. Re-read the FULL raw table to guarantee perfect accumulation and ordering
            const fullRaw = await db.getRawData('emision');
            const sortedRaw = fullRaw.sort((a, b) => a.fecha.localeCompare(b.fecha));

            // 4. Re-generate and replace emision_normalized
            const normalized = normalizeEmision(sortedRaw);
            await db.replaceNormalizedData('emision', normalized);

            revalidatePath('/');
            revalidatePath('/indicador/emision');
            return NextResponse.json({ success: true });
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
