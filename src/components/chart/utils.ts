import type { AreaConfig, ChartAxisDomainParams, ChartDataRow, ValueFormat } from '@/types/chart';

export const SPANISH_MONTHS: Record<string, string> = {
    '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR',
    '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AGO',
    '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
};

export function createRoundTicks(minimum: number, maximum: number, divisions: number): number[] {
    if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || divisions < 1) return [0, 1];
    let min = Math.min(minimum, maximum);
    let max = Math.max(minimum, maximum);
    if (min === max) {
        min -= 1;
        max += 1;
    }

    let step = roundStep((max - min) / divisions);
    let start = Math.floor(min / step) * step;
    while (start + step * divisions < max) {
        step = roundStep(step * 1.01);
        start = Math.floor(min / step) * step;
    }

    return Array.from({ length: divisions + 1 }, (_, index) => Number((start + step * index).toPrecision(12)));
}

export function selectRoundTickDivisions(ranges: Array<[number, number]>, preferredDivisions: number): number {
    let bestDivisions = Math.min(4, preferredDivisions);
    let bestScore = Number.POSITIVE_INFINITY;

    for (let divisions = bestDivisions; divisions <= preferredDivisions; divisions += 1) {
        const waste = ranges.reduce((total, [minimum, maximum]) => {
            const ticks = createRoundTicks(minimum, maximum, divisions);
            const dataRange = Math.max(Math.abs(maximum - minimum), Number.EPSILON);
            return total + ((ticks.at(-1) ?? maximum) - ticks[0] - dataRange) / dataRange;
        }, 0);
        const score = waste + (preferredDivisions - divisions) * 0.02;
        if (score < bestScore) {
            bestScore = score;
            bestDivisions = divisions;
        }
    }

    return bestDivisions;
}

function roundStep(rawStep: number): number {
    if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const residual = rawStep / magnitude;
    if (residual <= 1) return magnitude;
    if (residual <= 2) return 2 * magnitude;
    if (residual <= 2.5) return 2.5 * magnitude;
    if (residual <= 5) return 5 * magnitude;
    return 10 * magnitude;
}

export function calculateTooltipVerticalPosition(
    normalizedValues: number[],
    crosshairY: number,
    chartHeight: number,
    tooltipHeight: number,
): number | undefined {
    const values = normalizedValues.filter(value => Number.isFinite(value) && value >= 0 && value <= 1);
    if (values.length === 0) return undefined;
    const dataYPositions = values.map(value => (1 - value) * chartHeight);
    if (values.every(value => value >= 0.65)) {
        const belowCrosshair = crosshairY + 10;
        const belowEverySeries = Math.max(...dataYPositions) + 10;
        return Math.min(Math.max(belowCrosshair, belowEverySeries), Math.max(12, chartHeight - tooltipHeight - 12));
    }
    if (values.every(value => value <= 0.35)) {
        const aboveCrosshair = crosshairY - tooltipHeight - 10;
        const aboveEverySeries = Math.min(...dataYPositions) - tooltipHeight - 10;
        return Math.max(12, Math.min(aboveCrosshair, aboveEverySeries));
    }
    return undefined;
}

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
    const highlightedAreas = options.highlightedAreas;
    const visibleAreas = areas.filter(area => {
        if ((area.yAxisId ?? 'left') !== yAxisId) return false;
        return !highlightedAreas?.size || highlightedAreas.has(area.legendKey || area.key);
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
            let positive = 0;
            let negative = 0;
            let hasValue = false;
            for (const area of group) {
                const value = row[area.key];
                if (typeof value !== 'number' || !Number.isFinite(value)) continue;
                if (value >= 0) positive += value;
                else negative += value;
                hasValue = true;
            }
            if (hasValue) values.push(positive, negative);
        }
    }

    return values;
}

export function formatValueByType(value: number, format?: ValueFormat, decimals: number = 0): string {
    const options = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
    
    if (format === 'index') return value.toLocaleString('es-AR', options);
    if (format === 'currency') return `$${Math.round(value).toLocaleString('es-AR')}`;
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
