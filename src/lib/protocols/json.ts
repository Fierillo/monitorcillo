import { fetchTextFromUrl } from '../sync/http-client';
import type { ProtocolDocument } from './document';

type FetchJsonOptions = {
    timeoutMs?: number;
};

export function parseJson(text: string): unknown {
    try {
        return JSON.parse(text);
    } catch {
        throw new Error('Failed to parse JSON. The payload is not valid JSON.');
    }
}

export async function fetchJson(url: string, options?: FetchJsonOptions): Promise<ProtocolDocument<unknown>> {
    const text = await fetchTextFromUrl(url, options);
    try {
        return { url, content: parseJson(text) };
    } catch {
        throw new Error(`Failed to parse JSON from ${url}. The response is not valid JSON.`);
    }
}
