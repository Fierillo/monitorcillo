import type { CatalogIndicatorRow, Indicator } from '@/types';
import { saveIndicatorsCatalog } from './db';
import { buildCurrentIndicatorsCatalog } from './catalog-service';

export async function getIndicators(): Promise<Indicator[]> {
    try {
        const rows = await buildCurrentIndicatorsCatalog();
        
        return rows.map((row) => ({
            id: row.id,
            indicador: row.indicador,
            referencia: row.referencia,
            referenceDescription: row.reference_description,
            dato: row.dato,
            fecha: row.fecha,
            fuente: row.fuente,
            trend: row.trend,
            category: row.category,
            hasDetails: row.has_details,
            sourceUrl: row.source_url,
            proximaFecha: row.proxima_fecha,
            proximaFechaDescription: row.proxima_fecha_description,
        }));
    } catch {
        return [];
    }
}

export async function saveIndicators(data: Indicator[]): Promise<void> {
    const mapped: CatalogIndicatorRow[] = data.map(ind => ({
        id: ind.id,
        indicador: ind.indicador,
        referencia: ind.referencia,
        reference_description: ind.referenceDescription,
        dato: ind.dato,
        fecha: ind.fecha,
        fuente: ind.fuente,
        trend: ind.trend || 'neutral',
        category: ind.category || 'default',
        has_details: ind.hasDetails || false,
        source_url: ind.sourceUrl || null,
        proxima_fecha: ind.proximaFecha,
    }));
    await saveIndicatorsCatalog(mapped);
}
