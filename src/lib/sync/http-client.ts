import https from 'https';

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 1_000;
const TRANSIENT_ERROR_CODES = new Set([
    'EAI_AGAIN',
    'ECONNREFUSED',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ETIMEDOUT',
]);

class HttpStatusError extends Error {
    constructor(url: string, readonly statusCode: number | undefined) {
        super(`Failed to download ${url}. Status ${statusCode}`);
    }
}

function download(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const request = https.get(url, { headers: DEFAULT_HEADERS }, (response) => {
            if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
                response.resume();
                reject(new HttpStatusError(url, response.statusCode));
                return;
            }

            const chunks: Buffer[] = [];
            response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        });

        request.setTimeout(REQUEST_TIMEOUT_MS, () => {
            const error = new Error(`Failed to download ${url}. Request timed out after ${REQUEST_TIMEOUT_MS}ms.`) as NodeJS.ErrnoException;
            error.code = 'ETIMEDOUT';
            request.destroy(error);
        });
        request.on('error', reject);
    });
}

function shouldRetry(error: unknown): boolean {
    if (error instanceof HttpStatusError) {
        return error.statusCode === 429 || Boolean(error.statusCode && error.statusCode >= 500);
    }

    return error instanceof Error
        && TRANSIENT_ERROR_CODES.has((error as NodeJS.ErrnoException).code ?? '');
}

async function downloadWithRetry(url: string): Promise<Buffer> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            return await download(url);
        } catch (error) {
            if (!shouldRetry(error) || attempt === MAX_ATTEMPTS) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * 2 ** (attempt - 1)));
        }
    }

    throw new Error(`Failed to download ${url} after ${MAX_ATTEMPTS} attempts.`);
}

export function fetchBufferFromUrl(url: string): Promise<Buffer> {
    return downloadWithRetry(url);
}

export async function fetchTextFromUrl(url: string): Promise<string> {
    return (await downloadWithRetry(url)).toString();
}

export async function fetchCSV(url: string): Promise<string[][]> {
    try {
        const data = await fetchTextFromUrl(url);
        return data.split('\n').map(line => line.trim().split(',')).filter(row => row.length > 1);
    } catch {
        return [];
    }
}
