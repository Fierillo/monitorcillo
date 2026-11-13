import https from 'https';
import type { IncomingMessage } from 'http';
import { lookup as dnsLookup, type LookupAddress, type LookupOptions } from 'dns';
import { BlockList, isIP } from 'net';

const DEFAULT_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
};

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 1_000;
const MAX_REDIRECTS = 5;
const MAX_BODY_BYTES = 64 * 1024 * 1024;
const TRANSIENT_ERROR_CODES = new Set([
    'EAI_AGAIN',
    'ECONNREFUSED',
    'ECONNRESET',
    'EHOSTUNREACH',
    'ENETUNREACH',
    'ETIMEDOUT',
]);

/** Loopback, private and link-local ranges: a source URL or redirect must never reach them. */
const NON_PUBLIC_ADDRESSES = new BlockList();
for (const [address, prefix] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16]] as const) NON_PUBLIC_ADDRESSES.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [['::', 127], ['fc00::', 7], ['fe80::', 10]] as const) NON_PUBLIC_ADDRESSES.addSubnet(address, prefix, 'ipv6');

function isNonPublicAddress(address: string, family: number): boolean {
    return NON_PUBLIC_ADDRESSES.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

function isPublicHttpsUrl(url: URL): boolean {
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const family = isIP(host);
    if (url.protocol !== 'https:' || host === 'localhost' || host.endsWith('.localhost')) return false;
    return family === 0 || !isNonPublicAddress(host, family);
}

type LookupCallback = (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/** DNS lookup for https.request that refuses hostnames resolving to non-public addresses (DNS rebinding). */
function publicOnlyLookup(hostname: string, options: LookupOptions, callback: LookupCallback): void {
    dnsLookup(hostname, options, (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => {
        const addresses = typeof address === 'string' ? [{ address, family: family ?? 0 }] : address ?? [];
        const blocked = addresses.find((entry) => isNonPublicAddress(entry.address, entry.family));
        if (!error && blocked) callback(new Error(`Refusing to connect to ${hostname}: it resolves to non-public address ${blocked.address}.`), address, family);
        else callback(error, address, family);
    });
}

/** The URL as it may appear in errors and logs: without user:password. */
function withoutCredentials(url: URL): string {
    const shown = new URL(url);
    shown.username = '';
    shown.password = '';
    return shown.toString();
}

type HttpRequestOptions = {
    timeoutMs?: number;
    /** Rejects (without retry) a 2xx response whose Content-Type does not match, e.g. an HTML error page served instead of a file. */
    expectedContentType?: RegExp;
};

class HttpStatusError extends Error {
    constructor(url: string, readonly statusCode: number | undefined) {
        super(`Failed to download ${url}. Status ${statusCode}`);
    }
}

/** One request under the shared policy (public https hosts only, redirects followed, non-2xx rejected); `read` consumes the final response. */
function send<T>(url: string, method: 'GET' | 'HEAD', timeoutMs: number, read: (response: IncomingMessage, shownUrl: string) => Promise<T>, redirects = 0): Promise<T> {
    return new Promise((resolve, reject) => {
        const target = new URL(url);
        const shownUrl = withoutCredentials(target);
        if (!isPublicHttpsUrl(target)) {
            reject(new Error(`Refusing to download ${shownUrl}. Only public https hosts are allowed.`));
            return;
        }

        const request = https.request(url, { method, headers: DEFAULT_HEADERS, lookup: publicOnlyLookup }, (response) => {
            const location = response.headers?.location;
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && location) {
                response.resume();
                if (redirects >= MAX_REDIRECTS) reject(new Error(`Failed to download ${shownUrl}. Too many redirects.`));
                else if (!URL.canParse(location, url)) reject(new Error(`Failed to download ${shownUrl}. Invalid redirect location.`));
                else resolve(send(new URL(location, url).toString(), method, timeoutMs, read, redirects + 1));
                return;
            }

            if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
                response.resume();
                reject(new HttpStatusError(shownUrl, response.statusCode));
                return;
            }

            read(response, shownUrl).then(resolve, reject);
        });

        request.setTimeout(timeoutMs, () => {
            const error = new Error(`Failed to download ${shownUrl}. Request timed out after ${timeoutMs}ms.`) as NodeJS.ErrnoException;
            error.code = 'ETIMEDOUT';
            request.destroy(error);
        });
        request.on('error', reject);
        request.end();
    });
}

function readBody(expectedContentType?: RegExp) {
    return (response: IncomingMessage, shownUrl: string) => new Promise<Buffer>((resolve, reject) => {
        const contentType = String(response.headers?.['content-type'] ?? '');
        if (expectedContentType && !expectedContentType.test(contentType)) {
            response.resume();
            reject(new Error(`Unexpected content type ${contentType || '(none)'} for ${shownUrl}`));
            return;
        }

        const chunks: Buffer[] = [];
        let size = 0;
        response.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            size += chunk.length;
            if (size <= MAX_BODY_BYTES) return;
            response.destroy();
            reject(new Error(`Failed to download ${shownUrl}. Body exceeds ${MAX_BODY_BYTES / 1024 / 1024} MB.`));
        });
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
    });
}

function shouldRetry(error: unknown): boolean {
    if (error instanceof HttpStatusError) {
        return error.statusCode === 429 || Boolean(error.statusCode && error.statusCode >= 500);
    }

    return error instanceof Error
        && TRANSIENT_ERROR_CODES.has((error as NodeJS.ErrnoException).code ?? '');
}

async function downloadWithRetry(url: string, { timeoutMs = REQUEST_TIMEOUT_MS, expectedContentType }: HttpRequestOptions = {}): Promise<Buffer> {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            return await send(url, 'GET', timeoutMs, readBody(expectedContentType));
        } catch (error) {
            if (!shouldRetry(error) || attempt === MAX_ATTEMPTS) throw error;
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * 2 ** (attempt - 1)));
        }
    }

    throw new Error(`Failed to download ${withoutCredentials(new URL(url))} after ${MAX_ATTEMPTS} attempts.`);
}

export function fetchBufferFromUrl(url: string, options?: HttpRequestOptions): Promise<Buffer> {
    return downloadWithRetry(url, options);
}

export async function fetchTextFromUrl(url: string, options?: HttpRequestOptions): Promise<string> {
    return (await downloadWithRetry(url, options)).toString();
}

export function isoDateFromHttpDate(value?: string | null): string | null {
    const date = new Date(value ?? '');
    return Number.isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
}

export function fetchLastModifiedDate(url: string): Promise<string | null> {
    return send(url, 'HEAD', REQUEST_TIMEOUT_MS, async (response) => {
        response.resume();
        return isoDateFromHttpDate(response.headers['last-modified']);
    }).catch(() => null);
}
