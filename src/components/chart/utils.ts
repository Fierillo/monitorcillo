import type { ChartAxisDomainParams, ValueFormat } from '@/types/chart';

export const SPANISH_MONTHS: Record<string, string> = {
    '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR',
    '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AGO',
    '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
};

export function formatValueByType(value: number, format?: ValueFormat, decimals: number = 0): string {
    const options = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
    
    if (format === 'index') return value.toLocaleString('es-AR', options);
    if (format === 'millions') return `$${Math.round(value).toLocaleString('es-AR')}M`;
    if (format === 'billions') {
        const billones = value / 1000000;
        return `$${billones.toLocaleString('es-AR', options)}B`;
    }
    if (format === 'percent') return `${value.toLocaleString('es-AR', options)}%`;
    return value.toLocaleString('es-AR', options);
}

export function calculateYAxisDomain(params: ChartAxisDomainParams): [number, number] {
    const { chartData, areaKeys } = params;
    
    if (areaKeys.length === 0) return [0, 10];

    const values = chartData.flatMap((row) =>
        areaKeys
            .map(key => row[key])
            .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value))
    );

    if (values.length === 0) return [0, 10];

    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const padding = (maxValue - minValue) * 0.05;

    return [
        Math.floor(minValue - padding),
        Math.ceil(maxValue + padding)
    ];
}
