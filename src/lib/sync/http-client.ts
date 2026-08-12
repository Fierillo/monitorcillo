import https from 'https';

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

export function fetchBufferFromUrl(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: DEFAULT_HEADERS }, (res) => {
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
        https.get(url, { headers: DEFAULT_HEADERS }, (res) => {
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
        https.get(url, { headers: DEFAULT_HEADERS }, (res) => {
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
