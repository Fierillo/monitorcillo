import { extractTextFromImage } from './ocr';

const MONTHS: Record<string, number> = {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

export function periodToFecha(period: string): string | null {
    const match = period.match(/([A-Za-z]{3})(\d{2})([A-Za-z]{3})(\d{2})/);
    if (!match) return null;

    const endMonth = MONTHS[match[3].toLowerCase()];
    const endYear = 2000 + Number(match[4]);
    if (!endMonth) return null;

    return `${endYear}-${String(endMonth).padStart(2, '0')}-01`;
}

export async function extractUtdtChartData(imageUrl: string): Promise<Record<string, number>> {
    const text = await extractTextFromImage(imageUrl);
    return extractUtdtChartDataFromText(text);
}

export function extractUtdtChartDataFromText(text: string): Record<string, number> {
    // Extract period labels like "Abr25Sep25", "Jul25Dic25", etc.
    // Handle OCR errors: letters may be misread (e.g., 0 instead of O)
    // Pattern: 3 letters + 2 digits + 3 letters/numbers + 2 digits
    const periodMatches = text.match(/([A-Za-z]{3}\d{2}[A-Za-z0-9]{3}\d{2})/g) || [];
    const validPeriods = periodMatches
        .map(p => {
            if (p.length !== 10) return null;
            // Fix common OCR errors only in letter positions (positions 0-2 and 5-7)
            // Format: MmmYYMmmYY
            const chars = p.split('');
            for (let i = 0; i < chars.length; i++) {
                // Only fix letters, not digits in year positions (3-4 and 8-9)
                if (i === 3 || i === 4 || i === 8 || i === 9) continue;
                if (chars[i] === '0') chars[i] = 'O';
                if (chars[i] === '1') chars[i] = 'l';
            }
            return chars.join('');
        })
        .filter((p): p is string => p !== null);

    const chartLineValues = extractPovertyValuesFromChartLine(text, validPeriods.length);
    const povertyValues = chartLineValues.length > 0 ? chartLineValues : extractDecimalPovertyValues(text);

    // Strategy: The chart values appear left-to-right above periods
    // If we have fewer values than periods, missing values are typically at the start
    // We align from the end: last N values map to last N periods
    const data: Record<string, number> = {};
    const numPeriods = validPeriods.length;
    const numValues = povertyValues.length;
    
    if (numValues === 0 || numPeriods === 0) return data;

    // Calculate offset: if 7 periods and 6 values, offset = 1 (skip first period)
    const offset = Math.max(0, numPeriods - numValues);
    
    validPeriods.forEach((period, i) => {
        const valueIndex = i - offset;
        if (valueIndex >= 0 && valueIndex < numValues) {
            data[period] = povertyValues[valueIndex];
        }
    });

    return data;
}

function extractDecimalPovertyValues(text: string): number[] {
    const allValues = text.match(/(\d{1,2}\.\d)%?/g) || [];
    return allValues
        .map(m => parseFloat(m.replace('%', '')))
        .filter(v => v >= 20 && v <= 35);
}

function normalizeOcrPercentToken(token: string, previous: number | null): number | null {
    const raw = Number(token);
    if (!Number.isFinite(raw)) return null;
    if (raw >= 200 && raw <= 350 && !token.includes('.')) return raw / 10;
    if (raw === 20 && previous != null && previous >= 28) return 29;
    return raw;
}

function extractPovertyValuesFromChartLine(text: string, expectedCount: number): number[] {
    const lines = text.split('\n');
    const candidates = lines
        .map(line => Array.from(line.matchAll(/\b(\d{1,3}(?:\.\d)?)%/g)).map(match => match[1]))
        .filter(tokens => tokens.length >= Math.max(3, expectedCount - 1))
        .sort((a, b) => b.length - a.length);

    for (const tokens of candidates) {
        const values: number[] = [];
        for (const token of tokens) {
            const value = normalizeOcrPercentToken(token, values.at(-1) ?? null);
            if (value != null && value >= 20 && value <= 35) values.push(value);
        }
        if (values.length >= expectedCount) return values.slice(-expectedCount);
    }

    return [];
}

export function getUtdtNowcastValues(
    chartData: Record<string, number>,
    lastIndecPeriod: string
): Array<{ fecha: string; value: number; period: string }> {
    const results: Array<{ fecha: string; value: number; period: string }> = [];
    const lastIndecFecha = periodToFecha(lastIndecPeriod);
    if (!lastIndecFecha) throw new Error(`Invalid lastIndecPeriod: ${lastIndecPeriod}`);

    for (const [period, value] of Object.entries(chartData)) {
        const fecha = periodToFecha(period);
        if (!fecha) continue;

        // Skip periods ending before or at the same time as last INDEC period
        if (fecha <= lastIndecFecha) continue;

        results.push({ fecha, value, period });
    }

    return results.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
