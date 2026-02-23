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
}

const CATALOG_DIR = path.join(process.cwd(), 'src', 'data', 'catalog');

export async function getIndicators(): Promise<Indicator[]> {
    try {
        const files = await fs.readdir(CATALOG_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));

        const allIndicators = await Promise.all(jsonFiles.map(async file => {
            const content = await fs.readFile(path.join(CATALOG_DIR, file), 'utf-8');
            return JSON.parse(content);
        }));

        return allIndicators.flat();
    } catch (err) {
        return [];
    }
}

export async function saveIndicators(data: Indicator[]): Promise<void> {
    // Para simplificar, si se intenta guardar globalmente, lo ponemos en un archivo 'monitoreo.json'
    // aunque lo ideal seria que cada script escriba su propio archivo de categoria
    const target = path.join(CATALOG_DIR, 'monitoreo.json');
    await fs.mkdir(CATALOG_DIR, { recursive: true });
    await fs.writeFile(target, JSON.stringify(data, null, 2));
}
