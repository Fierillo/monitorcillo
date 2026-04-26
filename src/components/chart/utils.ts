export const SPANISH_MONTHS: Record<string, string> = {
    '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR',
    '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AGO',
    '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
};

export type ChartValueFormat = 'billions' | 'index' | 'millions' | 'percent';

export function formatValueByType(value: number, format?: ChartValueFormat): string {
    if (format === 'index') return Math.round(value).toString();
    if (format === 'millions') return `$${Math.round(value).toLocaleString('es-AR')}M`;
    if (format === 'billions') {
        const billones = value / 1000000;
        return `$${Math.round(billones).toLocaleString('es-AR')}B`;
    }
    if (format === 'percent') return `${Math.round(value)}%`;
    return Math.round(value).toLocaleString('es-AR');
}

export interface ChartAxisDomainParams {
    chartData: any[];
    areaKeys: string[];
    yAxisId?: 'left' | 'right';
}

export function calculateYAxisDomain(params: ChartAxisDomainParams): [number, number] {
    const { chartData, areaKeys } = params;
    
    if (areaKeys.length === 0) return [0, 10];

    const values = chartData.flatMap((row: any) =>
        areaKeys
            .map(key => row[key])
            .filter((v: any) => v !== null && v !== undefined && !isNaN(v))
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
