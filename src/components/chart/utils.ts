export const SPANISH_MONTHS: Record<string, string> = {
    '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR',
    '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AGO',
    '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
};

export type ChartValueFormat = 'billions' | 'index' | 'millions' | 'percent';

export function formatValueByType(value: number, format?: ChartValueFormat): string {
    if (format === 'index') return value.toFixed(1);
    if (format === 'millions') return `$${value.toLocaleString('es-AR')}`;
    if (format === 'billions') return `$${value.toLocaleString('es-AR')}`;
    if (format === 'percent') return `${value.toFixed(1)}%`;
    return value.toLocaleString('es-AR');
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
