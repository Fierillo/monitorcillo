import type { AreaConfig, ChartAxisDomainParams, ChartClickState, ChartDataRow, ValueFormat } from '@/types/chart';


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

export function chartMargins({ isMobile, valueFormat, hasSecondaryAxis }: { isMobile: boolean; valueFormat: ValueFormat; hasSecondaryAxis: boolean }): { left: number; right: number; top: number; bottom: number } {
    if (isMobile) return { left: 8, right: 8, top: 5, bottom: 40 };
    const yAxisWidth = valueFormat === 'currency' ? 90 : valueFormat === 'millions' ? 76 : 52;
    return { left: yAxisWidth - 50, right: hasSecondaryAxis ? 15 : 10, top: 5, bottom: 5 };
}

export function axisComponentWidth({ isMobile, valueFormat, hasSecondaryAxis }: { isMobile: boolean; valueFormat: ValueFormat; hasSecondaryAxis: boolean }): { left: number; right: number } {
    if (isMobile) return { left: 0, right: 0 };
    const left = valueFormat === 'currency' ? 90 : valueFormat === 'millions' ? 80 : 60;
    return { left, right: hasSecondaryAxis ? 60 : 0 };
}

export function chartPlotArea(options: { isMobile: boolean; valueFormat: ValueFormat; hasSecondaryAxis: boolean }): { left: number; right: number; top: number; bottom: number } {
    const margins = chartMargins(options);
    const axes = axisComponentWidth(options);
    return {
        left: margins.left + axes.left,
        right: margins.right + axes.right,
        top: margins.top,
        bottom: margins.bottom,
    };
}

type ChartGeometry = {
    count: number;
    left: number;
    right: number;
    width: number;
};

export function chartIndexForX({ x, count, left, right, width }: ChartGeometry & { x: number }): number {
    if (count <= 0 || width <= 0) return 0;

    const plotWidth = Math.max(1, width - left - right);
    const clampedX = Math.min(Math.max(x, left), left + plotWidth);
    return Math.min(count - 1, Math.max(0, Math.round(((clampedX - left) / plotWidth) * (count - 1))));
}

export function chartXForIndex({ index, count, left, right, width }: ChartGeometry & { index: number }): number {
    if (count <= 0) return left;

    const plotWidth = Math.max(1, width - left - right);
    if (count === 1) return left + plotWidth / 2;
    return left + (index / (count - 1)) * plotWidth;
}

export function chartClickStateFromPointer({
    x,
    y,
    width,
    height,
    count,
    left,
    right,
    top,
    bottom,
}: {
    x: number;
    y: number;
    width: number;
    height: number;
    count: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
}): ChartClickState | null {
    if (count <= 0 || width <= 0 || height <= 0) return null;

    const plotBottom = Math.max(top, height - bottom);
    const clampedY = Math.min(Math.max(y, top), plotBottom);
    const geometry = { count, left, right, width };
    const index = chartIndexForX({ ...geometry, x });

    return { activeTooltipIndex: index, activeCoordinate: { x: chartXForIndex({ ...geometry, index }), y: clampedY } };
}

export function parseActiveTooltipIndex(index: ChartClickState['activeTooltipIndex']): number | null {
    if (typeof index === 'number' && Number.isFinite(index)) return index;
    if (typeof index === 'string' && /^\d+$/.test(index)) return Number(index);
    return null;
}

export function resolveChartHoverPoint(
    state: ChartClickState | null,
    visibleData: ChartDataRow[],
): { x: number; y: number; label: string; row: ChartDataRow; activeIndex: number } | null {
    const x = state?.activeCoordinate?.x;
    const y = state?.activeCoordinate?.y;
    if (typeof x !== 'number' || typeof y !== 'number') return null;

    const activeIndex = parseActiveTooltipIndex(state?.activeTooltipIndex);
    if (activeIndex === null) return null;

    const row = visibleData[activeIndex];
    if (!row) return null;

    const labelValue = row.fecha ?? row.iso_fecha;
    if (labelValue == null) return null;

    return { x, y, label: String(labelValue), row, activeIndex };
}

const ISO_MONTH_PATTERN = /^(\d{4})-(\d{2})/;
const MONTH_REPEATING_STEPS = [1, 2, 3, 4, 6, 12, 24, 36, 48, 60, 120];
const WEEK_REPEATING_STEPS = [7, 14, 21, 28, 42, 56, 84];

function monthIndexFromIso(value: string): number | null {
    const match = value.match(ISO_MONTH_PATTERN);
    if (!match) return null;
    return Number(match[1]) * 12 + Number(match[2]) - 1;
}

export function selectMonthAlignedXTicks(values: string[], targetCount = 8, minimumIndexGap = (values.length - 1) / Math.max(1, targetCount - 1), minimumEdgeIndexGap = minimumIndexGap): string[] {
    const dated = values
        .map(value => {
            const monthIndex = monthIndexFromIso(value);
            return monthIndex == null ? null : { value, monthIndex, dayIndex: Date.parse(value) / 86_400_000 };
        })
        .filter((entry): entry is { value: string; monthIndex: number; dayIndex: number } => entry != null);

    if (dated.length === 0) {
        const step = Math.max(1, Math.ceil(minimumIndexGap), Math.ceil((values.length - 1) / (Math.max(2, targetCount) - 1)));
        return values.filter((_, index) => index === 0 || index === values.length - 1 || (index % step === 0 && index >= minimumEdgeIndexGap && index <= values.length - 1 - minimumEdgeIndexGap));
    }
    if (dated.length <= 2) return dated.map(entry => entry.value);

    const maxTicks = Math.max(2, targetCount);
    const daySpan = dated.at(-1)!.dayIndex - dated[0].dayIndex;
    const useWeeks = daySpan / (maxTicks - 1) < 28 && dated.length > new Set(dated.map(entry => entry.monthIndex)).size;
    const periodIndex = (entry: typeof dated[number]) => useWeeks ? entry.dayIndex : entry.monthIndex;
    const first = periodIndex(dated[0]);
    const last = periodIndex(dated.at(-1)!);
    const span = last - first;
    if (span <= 0) return [dated[0].value, dated.at(-1)!.value];

    const byPeriod = new Map(dated.map(entry => [periodIndex(entry), entry.value]));
    const indexByValue = new Map(values.map((value, index) => [value, index]));
    let best: string[] = [];

    for (const step of useWeeks ? WEEK_REPEATING_STEPS : MONTH_REPEATING_STEPS) {
        if (step > span) continue;
        for (let offset = 0; offset < step; offset++) {
            const candidate: string[] = [];
            for (let cursor = last - offset; cursor >= first; cursor -= step) {
                const value = byPeriod.get(cursor);
                if (value) candidate.unshift(value);
            }
            const interior = candidate.filter(value => indexByValue.get(value)! >= minimumEdgeIndexGap && indexByValue.get(value)! <= values.length - 1 - minimumEdgeIndexGap);
            const ticks = [values[0], ...interior, values.at(-1)!];
            if (ticks.length > maxTicks) continue;
            if (ticks.some((value, index) => index > 0 && indexByValue.get(value)! - indexByValue.get(ticks[index - 1])! < minimumIndexGap)) continue;
            if (ticks.length > best.length) best = ticks;
        }
    }

    return best.length > 0 ? best : [values[0], values.at(-1)!];
}

export const MIN_X_TICK_SPACING_PX = 44;
export const MIN_X_TICK_GAP_PX = 8;

const X_TICK_LABEL_GLYPH_RATIO = 0.75;

export function xTickLabelWidthPx(fontSize: number, labels: string[]): number {
    const context = typeof document !== 'undefined' && document.fonts ? document.createElement('canvas').getContext('2d') : null;
    if (context) {
        context.font = `${fontSize}px ${getComputedStyle(document.body).fontFamily}`;
        return Math.ceil(labels.reduce((widest, label) => Math.max(widest, context.measureText(label).width), 0));
    }
    const widestLabel = labels.reduce((widest, label) => Math.max(widest, label.length), 0);
    return Math.ceil(widestLabel * fontSize * X_TICK_LABEL_GLYPH_RATIO);
}

export function xTickEdgeSpacingPx(fontSize: number, labels: string[]): number {
    return xTickSpacingPx(fontSize, labels) + Math.ceil(xTickLabelWidthPx(fontSize, labels) / 2);
}

export function xTickSpacingPx(fontSize: number, labels: string[]): number {
    return Math.max(MIN_X_TICK_SPACING_PX, xTickLabelWidthPx(fontSize, labels) + MIN_X_TICK_GAP_PX);
}

export function targetXTickCount(chartWidth: number, axisMargins = 0, spacing = MIN_X_TICK_SPACING_PX): number {
    const availableWidth = Math.max(0, chartWidth - axisMargins);
    return Math.max(2, Math.floor(availableWidth / Math.max(1, spacing)) + 1);
}
