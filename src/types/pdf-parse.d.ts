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

declare module 'pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js' {
    type TextItem = { str: string; transform: number[] };
    type PdfPage = {
        getTextContent(): Promise<{ items: TextItem[] }>;
        getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
    };
    export const PDFJS: { disableFontFace: boolean };
    export const OPS: Record<string, number>;
    export function getDocument(source: { data: Uint8Array }): Promise<{ numPages: number; getPage(page: number): Promise<PdfPage> }>;
}
