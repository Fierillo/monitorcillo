import { getIndicatorsCatalog, saveIndicatorsCatalog, getNormalizedData } from './db';

const MAPPING: Record<string, 'emision' | 'emae' | 'bma' | 'reca' | 'poder'> = {
    emision: 'emision',
    emae: 'emae',
    bma: 'bma',
    reca: 'reca',
    'poder-adquisitivo': 'poder',
};

export interface Indicator {
    id: string;
    fecha: string;
    fuente: string;
    indicador: string;
    referencia: string;
    dato: string;
    trend?: 'up' | 'down' | 'neutral';
    hasDetails?: boolean;
    sourceUrl?: string;
}

function formatDateFromCache(fechaStr: string): string {
    const months: Record<string, string> = {
        'ene': 'ENE', 'feb': 'FEB', 'mar': 'MAR', 'abr': 'ABR', 'may': 'MAY', 'jun': 'JUN',
        'jul': 'JUL', 'ago': 'AGO', 'sept': 'SEPT', 'sep': 'SEPT', 'oct': 'OCT', 'nov': 'NOV', 'dic': 'DIC',
        '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR', '05': 'MAY', '06': 'JUN',
        '07': 'JUL', '08': 'AGO', '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
    };
    
    const parts = fechaStr.toLowerCase().split('-');
    
    if (parts.length === 2 && parts[0].length === 4) {
        const month = months[parts[1]] || 'ENE';
        const year = parts[0].slice(-2);
        return `${month} ${year}`;
    }
    
    if (parts.length === 2 && parts[1].length === 2) {
        const month = months[parts[0]] || 'ENE';
        const year = parts[1].padStart(2, '0');
        return `${month} ${year}`;
    }
    
    if (parts.length >= 3) {
        const day = parseInt(parts[0]);
        const month = months[parts[1]] || 'FEB';
        const year = parts[2].padStart(2, '0');
        return `${day} ${month} ${year}`;
    }
    
    if (parts.length === 2 && parts[1].length === 3) {
        const day = parseInt(parts[0]);
        const month = months[parts[1]] || 'FEB';
        const year = new Date().getFullYear().toString().slice(-2);
        return `${day} ${month} ${year}`;
    }
    
    return fechaStr;
}

async function getLastDateFromIndicator(indicatorId: string): Promise<string | null> {
    const type = MAPPING[indicatorId];
    if (!type) return null;

    const data = await getNormalizedData(type);
    if (!data || data.length === 0) return null;

    const lastRecord = data[data.length - 1];
    if (lastRecord.fecha) {
        return formatDateFromCache(lastRecord.fecha);
    }
    return null;
}

export async function getIndicators(): Promise<Indicator[]> {
    try {
        const rows = await getIndicatorsCatalog();
        
        return rows.map((row: any) => ({
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
    } catch (err) {
        return [];
    }
}

export async function saveIndicators(data: Indicator[]): Promise<void> {
    const mapped = data.map(ind => ({
        id: ind.id,
        indicador: ind.indicador,
        referencia: ind.referencia,
        dato: ind.dato,
        fecha: ind.fecha,
        fuente: ind.fuente,
        trend: ind.trend || 'neutral',
        category: 'default',
        has_details: ind.hasDetails || false,
        source_url: ind.sourceUrl || null,
    }));
    await saveIndicatorsCatalog(mapped);
}