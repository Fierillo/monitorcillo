import { PNG } from 'pngjs';

export const UTDT_ICG_CALENDAR_URL = 'https://www.utdt.edu/ver_contenido.php?id_contenido=25418&id_item_menu=41666';

const MONTHS: Record<string, number> = {
    enero: 1,
    febrero: 2,
    marzo: 3,
    abril: 4,
    mayo: 5,
    junio: 6,
    julio: 7,
    agosto: 8,
    septiembre: 9,
    octubre: 10,
    noviembre: 11,
    diciembre: 12,
};

export type IcgDiffusionEntry = {
    period: string;
    publishedOn: string;
};

function pad(value: number): string {
    return String(value).padStart(2, '0');
}

function toIso(year: number, month: number, day: number): string {
    return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseIcgDiffusionSchedule(text: string): IcgDiffusionEntry[] {
    const yearMatch = text.match(/Cronograma de difusi[oó]n(?:\s+ICG)?\s+(\d{4})/i);
    if (!yearMatch) return [];
    const year = Number(yearMatch[1]);
    const entries: IcgDiffusionEntry[] = [];

    for (const match of text.matchAll(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b[^\n\d]*(\d{1,2})\b/gi)) {
        const month = MONTHS[match[1].toLowerCase()];
        const day = Number(match[2]);
        if (!month || day < 1 || day > 31) continue;
        entries.push({
            period: `${year}-${pad(month)}-01`,
            publishedOn: toIso(year, month, day),
        });
    }

    if (entries.length === 12) return entries;

    const weekdayDays = [...text.matchAll(/\b(?:lunes|martes|mi[eé]rcoles|jueves|viernes)\s+(\d{1,2})\b/gi)]
        .map(match => Number(match[1]))
        .filter(day => day >= 1 && day <= 31);
    if (weekdayDays.length >= 12) {
        return weekdayDays.slice(-12).map((day, index) => ({
            period: `${year}-${pad(index + 1)}-01`,
            publishedOn: toIso(year, index + 1, day),
        }));
    }

    return entries;
}

function upscaleGrayscalePng(buffer: Buffer, scale: number): Buffer {
    const source = PNG.sync.read(buffer);
    const width = source.width * scale;
    const height = source.height * scale;
    const destination = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
        const sourceY = Math.floor(y / scale);
        for (let x = 0; x < width; x++) {
            const sourceX = Math.floor(x / scale);
            const sourceIndex = (source.width * sourceY + sourceX) << 2;
            const gray = Math.round(source.data[sourceIndex] * 0.299 + source.data[sourceIndex + 1] * 0.587 + source.data[sourceIndex + 2] * 0.114);
            const index = (width * y + x) << 2;
            destination.data[index] = gray;
            destination.data[index + 1] = gray;
            destination.data[index + 2] = gray;
            destination.data[index + 3] = 255;
        }
    }
    return PNG.sync.write(destination);
}

function cropRightHalfPng(buffer: Buffer): Buffer {
    const source = PNG.sync.read(buffer);
    const width = Math.floor(source.width / 2);
    const destination = new PNG({ width, height: source.height });
    for (let y = 0; y < source.height; y++) {
        for (let x = 0; x < width; x++) {
            const sourceIndex = (source.width * y + x + source.width - width) << 2;
            const index = (width * y + x) << 2;
            destination.data[index] = source.data[sourceIndex];
            destination.data[index + 1] = source.data[sourceIndex + 1];
            destination.data[index + 2] = source.data[sourceIndex + 2];
            destination.data[index + 3] = 255;
        }
    }
    return PNG.sync.write(destination);
}

export async function readIcgCalendarImageText(buffer: Buffer): Promise<string> {
    const { createWorker, PSM } = await import('tesseract.js');
    const prepared = upscaleGrayscalePng(buffer, 3);
    const worker = await createWorker('spa');
    try {
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
        const full = await worker.recognize(prepared);
        const column = await worker.recognize(cropRightHalfPng(prepared));
        return `${full.data.text ?? ''}\n${column.data.text ?? ''}`;
    } finally {
        await worker.terminate();
    }
}

export async function fetchIcgCalendarSchedule(options: {
    fetchPage: () => Promise<string>;
    fetchImage: (url: string) => Promise<Buffer>;
    readImageText: (buffer: Buffer) => Promise<string>;
}): Promise<IcgDiffusionEntry[]> {
    const html = await options.fetchPage();
    const imageUrl = parseIcgCalendarImageUrl(html);
    if (!imageUrl) {
        throw new Error(`Failed to find the ICG cronograma image at ${UTDT_ICG_CALENDAR_URL}. Verify the calendar page.`);
    }
    const image = await options.fetchImage(imageUrl);
    const heading = html.match(/Cronograma de difusi[oó]n(?:\s+ICG)?\s+\d{4}/i)?.[0] ?? '';
    const schedule = parseIcgDiffusionSchedule(`${heading}\n${await options.readImageText(image)}`);
    if (schedule.length === 0) {
        throw new Error(`Failed to parse ICG publication dates from ${imageUrl}. Verify the cronograma image.`);
    }
    return schedule;
}

export function decodeUtdtPageHtml(buffer: Buffer): string {
    return buffer.toString('latin1');
}

export function parseIcgCalendarImageUrl(html: string): string | null {
    const section = html.match(/Cronograma de difusi[oó]n[\s\S]{0,2000}?<img[^>]+src=["']([^"']+)["']/i);
    const src = section?.[1];
    if (!src) return null;
    if (src.startsWith('http://') || src.startsWith('https://')) return src;
    return `https://www.utdt.edu${src.startsWith('/') ? '' : '/'}${src}`;
}

export function icgPublicationDateFromSchedule(schedule: IcgDiffusionEntry[], periodIso: string): string | null {
    const period = periodIso.slice(0, 10);
    return schedule.find(entry => entry.period === period)?.publishedOn ?? null;
}

export function icgNextPublicationFromSchedule(schedule: IcgDiffusionEntry[], today: string): string | null {
    return schedule
        .map(entry => entry.publishedOn)
        .filter(date => date > today)
        .sort()[0] ?? null;
}
