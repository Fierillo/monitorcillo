declare module 'pdf-parse/lib/pdf-parse.js' {
    import type { Buffer } from 'node:buffer';

    type PdfParseResult = {
        numpages: number;
        numrender: number;
        info: Record<string, unknown>;
        metadata: unknown;
        version: string;
        text: string;
    };

    type PdfParseOptions = {
        pagerender?: (pageData: unknown) => string | Promise<string>;
        max?: number;
        version?: string;
    };

    export default function pdf(dataBuffer: Buffer, options?: PdfParseOptions): Promise<PdfParseResult>;
}
