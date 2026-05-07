import https from 'https';
import type { DatosGobApiResponse } from '@/types';

export function fetchFromUrl(url: string): Promise<DatosGobApiResponse> {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                    resolve({ data: [] });
                    return;
                }

                try {
                    resolve(JSON.parse(data) as DatosGobApiResponse);
                } catch {
                    resolve({ data: [] });
                }
            });
        }).on('error', () => resolve({ data: [] }));
    });
}

export function fetchBufferFromUrl(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                reject(new Error(`Failed to download ${url}. Status ${res.statusCode}`));
                return;
            }

            const chunks: Buffer[] = [];
            res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

export function fetchTextFromUrl(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                reject(new Error(`Failed to download ${url}. Status ${res.statusCode}`));
                return;
            }

            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

export function fetchCSV(url: string): Promise<string[][]> {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                    resolve([]);
                    return;
                }

                resolve(data.split('\n').map(line => line.trim().split(',')).filter(row => row.length > 1));
            });
        }).on('error', () => resolve([]));
    });
}
