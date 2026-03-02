import fs from 'fs/promises';
import path from 'path';

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

const CATALOG_DIR = path.join(process.cwd(), 'src', 'data', 'catalog');
const CACHE_DIR = path.join(process.cwd(), 'src', 'data', 'cache');

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

function getLastDateFromCache(indicatorId: string): string | null {
    const cacheFile = path.join(CACHE_DIR, `${indicatorId}.json`);
    
    try {
        const content = require('fs').readFileSync(cacheFile, 'utf-8');
        const data = JSON.parse(content);
        
        if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
            const lastRecord = data.data[data.data.length - 1];
            
            if (lastRecord.fecha) {
                return formatDateFromCache(lastRecord.fecha);
            }
        }
    } catch (err) {
    }
    return null;
}

export async function getIndicators(): Promise<Indicator[]> {
    try {
        const files = await fs.readdir(CATALOG_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        const allIndicators = await Promise.all(jsonFiles.map(async file => {
            const content = await fs.readFile(path.join(CATALOG_DIR, file), 'utf-8');
            return JSON.parse(content);
        }));

        const indicators = allIndicators.flat();
        
        return indicators.map(indicator => {
            if (indicator.sourceUrl) {
                return indicator;
            }

            const lastDate = getLastDateFromCache(indicator.id);
            if (lastDate) {
                return { ...indicator, fecha: lastDate };
            }
            return indicator;
        });
    } catch (err) {
        return [];
    }
}

export async function saveIndicators(data: Indicator[]): Promise<void> {
    const target = path.join(CATALOG_DIR, 'monitoreo.json');
    await fs.mkdir(CATALOG_DIR, { recursive: true });
    await fs.writeFile(target, JSON.stringify(data, null, 2));
}
