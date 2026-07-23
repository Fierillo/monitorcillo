import type { AreaConfig, ChartAxisDomainParams, ChartDataRow, ValueFormat } from '@/types/chart';

export const SPANISH_MONTHS: Record<string, string> = {
    '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR',
    '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AGO',
    '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
};

/** Collect Y values for axis domain/ticks. Stacked series contribute their per-row sum. */
export function collectAxisExtentValues(
    chartData: ChartDataRow[],
    areas: AreaConfig[],
    options: {
        yAxisId?: 'left' | 'right';
        highlightedAreas?: Set<string>;
    } = {},
): number[] {
    const yAxisId = options.yAxisId ?? 'left';
    const highlighted = options.highlightedAreas;
    const visibleAreas = areas.filter(area => {
        if ((area.yAxisId ?? 'left') !== yAxisId) return false;
        if (highlighted && highlighted.size > 0 && !highlighted.has(area.legendKey || area.key)) return false;
        return true;
    });

    const stacked = new Map<string, AreaConfig[]>();
    const unstacked: AreaConfig[] = [];
    for (const area of visibleAreas) {
        if (area.stackId) {
            const group = stacked.get(area.stackId) ?? [];
            group.push(area);
            stacked.set(area.stackId, group);
            continue;
        }
        unstacked.push(area);
    }

    const values: number[] = [];
    for (const row of chartData) {
        for (const area of unstacked) {
            const value = row[area.key];
            if (typeof value === 'number' && Number.isFinite(value)) values.push(value);
        }

        for (const group of stacked.values()) {
            let sum = 0;
            let hasValue = false;
            for (const area of group) {
                const value = row[area.key];
                if (typeof value !== 'number' || !Number.isFinite(value)) continue;
                sum += value;
                hasValue = true;
            }
            if (hasValue) values.push(sum);
        }
    }

    return values;
}

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

export function formatAxisValueByType(value: number, format?: ValueFormat, decimals: number = 0): string {
    if (format !== 'millions') return formatValueByType(value, format, decimals);

    const absValue = Math.abs(value);
    const step = absValue >= 1_000_000 ? 100_000 : absValue >= 100_000 ? 10_000 : 1_000;
    const roundedValue = Math.round(value / step) * step;

    return `$${roundedValue.toLocaleString('es-AR')}M`;
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
