import type { CatalogIndicatorRow, Indicator } from '@/types';
import { getIndicatorsCatalog, saveIndicatorsCatalog } from './db';

export async function getIndicators(): Promise<Indicator[]> {
    try {
        const rows = await getIndicatorsCatalog();
        
        return rows.map((row) => ({
            id: row.id,
            indicador: row.indicador,
            referencia: row.referencia,
            dato: row.dato,
            fecha: row.fecha,
            fuente: row.fuente,
            trend: row.trend,
            category: row.category,
            hasDetails: row.has_details,
            sourceUrl: row.source_url,
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
        dato: ind.dato,
        fecha: ind.fecha,
        fuente: ind.fuente,
        trend: ind.trend || 'neutral',
        category: ind.category || 'default',
        has_details: ind.hasDetails || false,
        source_url: ind.sourceUrl || null,
    }));
    await saveIndicatorsCatalog(mapped);
}
