import pdf from 'pdf-parse/lib/pdf-parse.js';
import { fetchBufferFromUrl } from '../sync/http-client';
import type { ProtocolDocument } from './document';

export type PdfContent = {
    text: string;
    pages: number;
};

type FetchPdfOptions = {
    timeoutMs?: number;
};

export async function parsePdf(buffer: Buffer): Promise<PdfContent> {
    try {
        const parsed = await pdf(buffer);
        return { text: parsed.text ?? '', pages: parsed.numpages ?? 0 };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse PDF. ${message}`);
    }
}

export async function fetchPdf(url: string, options?: FetchPdfOptions): Promise<ProtocolDocument<PdfContent>> {
    const buffer = await fetchBufferFromUrl(url, options);
    return { url, content: await parsePdf(buffer) };
}
