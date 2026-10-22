import * as pdfjs from 'pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js';

export type PdfLayout = {
    texts: { str: string; x: number; y: number }[];
    /** Filled rectangles with their fill colour as «r,g,b». */
    rects: { fill: string; x: number; y: number; w: number; h: number }[];
};

pdfjs.PDFJS.disableFontFace = true; // no DOM to load fonts into on the server

/** Text positions and filled rectangles of a PDF's first page, for documents that encode meaning in colour. */
export async function readPdfLayout(buffer: Buffer): Promise<PdfLayout> {
    const page = await (await pdfjs.getDocument({ data: new Uint8Array(buffer) })).getPage(1);
    const [text, operators] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
    const texts = text.items.map(item => ({ str: item.str, x: item.transform[4], y: item.transform[5] }));
    const rects: PdfLayout['rects'] = [];
    let fill = '';
    operators.fnArray.forEach((fn, index) => {
        const args = operators.argsArray[index];
        if (fn === pdfjs.OPS.setFillRGBColor) fill = (args as number[]).join(',');
        if (fn === pdfjs.OPS.constructPath && (args[0] as number[]).includes(pdfjs.OPS.rectangle)) {
            const [x, y, w, h] = args[1] as number[];
            rects.push({ fill, x, y, w, h });
        }
    });
    return { texts, rects };
}
