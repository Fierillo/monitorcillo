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

const DB_PATH = path.join(process.cwd(), 'src', 'data', 'db.json');

export async function getIndicators(): Promise<Indicator[]> {
    try {
        const data = await fs.readFile(DB_PATH, 'utf-8');
        return JSON.parse(data);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
        throw new Error('Error reading database');
    }
}

export async function saveIndicators(data: Indicator[]): Promise<void> {
    try {
        const dir = path.dirname(DB_PATH);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
    } catch {
        throw new Error('Error saving database');
    }
}
