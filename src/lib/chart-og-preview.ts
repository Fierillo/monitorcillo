import type { AreaConfig, ChartAxisDomain, ChartDataRow, ChartViewConfig } from '@/types';

export const OG_CHART_WIDTH = 1100;
export const OG_CHART_HEIGHT = 280;
export const OG_IMAGE_VERSION = '2';

export type OgChartSource = {
    chartTitle: string;
    data: ChartDataRow[];
    areas: AreaConfig[];
    views?: ChartViewConfig[];
    leftYAxisDomain?: ChartAxisDomain;
};

export type OgBar = {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
};

export type OgLine = {
    color: string;
    path: string;
};

export type OgLegendItem = {
    name: string;
    color: string;
};

export type OgPreview = {
    chartTitle: string;
    modeLabel?: string;
    bars: OgBar[];
    lines: OgLine[];
    legend: OgLegendItem[];
    baselineY?: number;
};

type Scale = { min: number; max: number };

export function downsampleRows<T>(rows: T[], maxPoints: number): T[] {
    if (rows.length <= maxPoints) return rows;
    const step = (rows.length - 1) / (maxPoints - 1);
    return Array.from({ length: maxPoints }, (_, index) => rows[Math.round(index * step)]);
}

export function buildOgPreview(source: OgChartSource, selection: { viewId?: string; modeId?: string } = {}): OgPreview {
    const view = source.views?.find(item => item.id === selection.viewId) ?? source.views?.[0];
    const mode = view?.modes?.find(item => item.id === selection.modeId) ?? view?.modes?.[0];
    const areas = (mode?.areas ?? view?.areas ?? source.areas).filter(area => !area.hideInLegend);
    const hasBars = areas.some(area => area.type === 'bar');
    const data = downsampleRows(mode?.data ?? view?.data ?? source.data, hasBars ? 48 : 72);
    const chartTitle = mode?.chartTitle ?? view?.chartTitle ?? source.chartTitle;
    const leftDomain = mode?.leftYAxisDomain ?? view?.leftYAxisDomain ?? source.leftYAxisDomain;
    const leftScale = scaleFor(extentValues(data, areas, 'left'), startsAtZero(leftDomain) || areas.some(area => area.type === 'bar' && (area.yAxisId ?? 'left') === 'left'));
    const rightScale = scaleFor(extentValues(data, areas, 'right'), startsAtZero(view?.secondaryYAxis?.domain) || view?.secondaryYAxis?.includeZero === true);

    return {
        chartTitle,
        modeLabel: mode?.label && !chartTitle.includes(mode.label) ? mode.label : undefined,
        bars: barMarks(data, areas, leftScale, rightScale),
        lines: lineMarks(data, areas, leftScale, rightScale, !hasBars),
        legend: legendItems(areas),
        baselineY: leftScale.min <= 0 && leftScale.max >= 0 ? yAt(0, leftScale) : undefined,
    };
}

function finiteValue(row: ChartDataRow, key: string): number | null {
    const value = row[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function startsAtZero(domain: ChartAxisDomain | [number, number] | 'auto' | undefined): boolean {
    return Array.isArray(domain) && domain[0] === 0;
}

function scaleFor(values: number[], includeZero: boolean): Scale {
    if (values.length === 0) return { min: 0, max: 1 };
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (includeZero) {
        min = Math.min(min, 0);
        max = Math.max(max, 0);
    }
    if (min === max) {
        const pad = Math.abs(min) || 1;
        return { min: min - pad, max: max + pad };
    }
    const pad = (max - min) * 0.08;
    return { min: includeZero && min === 0 ? 0 : min - pad, max: max + pad };
}

function yAt(value: number, scale: Scale): number {
    return (1 - (value - scale.min) / (scale.max - scale.min || 1)) * OG_CHART_HEIGHT;
}

function extentValues(data: ChartDataRow[], areas: AreaConfig[], axis: 'left' | 'right'): number[] {
    const visible = areas.filter(area => (area.yAxisId ?? 'left') === axis);
    const stacks = new Map<string, AreaConfig[]>();
    const loose: AreaConfig[] = [];
    for (const area of visible) {
        if (!area.stackId) {
            loose.push(area);
            continue;
        }
        stacks.set(area.stackId, [...(stacks.get(area.stackId) ?? []), area]);
    }

    const values: number[] = [];
    for (const row of data) {
        for (const area of loose) {
            const value = finiteValue(row, area.key);
            if (value != null) values.push(value);
        }
        for (const group of stacks.values()) {
            let positive = 0;
            let negative = 0;
            let hasValue = false;
            for (const area of group) {
                const value = finiteValue(row, area.key);
                if (value == null) continue;
                if (value >= 0) positive += value;
                else negative += value;
                hasValue = true;
            }
            if (hasValue) values.push(positive, negative);
        }
    }
    return values;
}

function barMarks(data: ChartDataRow[], areas: AreaConfig[], leftScale: Scale, rightScale: Scale): OgBar[] {
    const stacks = new Map<string, AreaConfig[]>();
    for (const area of areas) {
        if (area.type !== 'bar') continue;
        const id = area.stackId ?? area.key;
        stacks.set(id, [...(stacks.get(id) ?? []), area]);
    }
    const groups = [...stacks.values()];
    if (groups.length === 0 || data.length === 0) return [];

    const slot = OG_CHART_WIDTH / data.length;
    const groupWidth = slot * 0.72;
    const barWidth = Math.max(groupWidth / groups.length - 1, 1);
    const marks: OgBar[] = [];

    groups.forEach((group, stackIndex) => {
        data.forEach((row, index) => {
            let positive = 0;
            let negative = 0;
            const x = index * slot + (slot - groupWidth) / 2 + stackIndex * (barWidth + 1);
            for (const area of group) {
                const value = finiteValue(row, area.key);
                if (value == null || value === 0) continue;
                const scale = area.yAxisId === 'right' ? rightScale : leftScale;
                const baseline = value > 0 ? positive : negative;
                const next = baseline + value;
                if (value > 0) positive = next;
                else negative = next;
                const top = yAt(Math.max(baseline, next), scale);
                const bottom = yAt(Math.min(baseline, next), scale);
                marks.push({ x, y: top, width: barWidth, height: Math.max(bottom - top, 1), color: area.color });
            }
        });
    });

    return marks;
}

function lineMarks(data: ChartDataRow[], areas: AreaConfig[], leftScale: Scale, rightScale: Scale, edgeAligned: boolean): OgLine[] {
    return areas.flatMap(area => {
        if (area.type === 'bar') return [];
        const scale = area.yAxisId === 'right' ? rightScale : leftScale;
        const path = linePath(data, area, scale, edgeAligned);
        return path ? [{ color: area.color, path }] : [];
    });
}

function linePath(data: ChartDataRow[], area: AreaConfig, scale: Scale, edgeAligned: boolean): string | null {
    const commands: string[] = [];
    let open = false;
    data.forEach((row, index) => {
        const value = finiteValue(row, area.key);
        if (value == null) {
            if (!area.connectNulls) open = false;
            return;
        }
        const x = edgeAligned
            ? (index / Math.max(data.length - 1, 1)) * OG_CHART_WIDTH
            : ((index + 0.5) / data.length) * OG_CHART_WIDTH;
        commands.push(`${open ? 'L' : 'M'}${x.toFixed(1)} ${yAt(value, scale).toFixed(1)}`);
        open = true;
    });
    return commands.some(command => command.startsWith('L')) ? commands.join(' ') : null;
}

function legendItems(areas: AreaConfig[]): OgLegendItem[] {
    const seen = new Set<string>();
    return areas.flatMap(area => {
        if (seen.has(area.name)) return [];
        seen.add(area.name);
        return [{ name: area.name, color: area.color }];
    }).slice(0, 8);
}
