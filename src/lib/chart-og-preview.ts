import type { AreaConfig, ChartDataRow, ChartViewConfig } from '@/types';

export const OG_CHART_WIDTH = 1100;
export const OG_CHART_HEIGHT = 360;

export type OgChartSource = {
    chartTitle: string;
    data: ChartDataRow[];
    areas: AreaConfig[];
    views?: ChartViewConfig[];
};

export type OgPreviewSeries = {
    color: string;
    path: string;
};

export type OgPreview = {
    chartTitle: string;
    series: OgPreviewSeries[];
};

export function downsampleRows<T>(rows: T[], maxPoints: number): T[] {
    if (rows.length <= maxPoints) return rows;
    const step = (rows.length - 1) / (maxPoints - 1);
    return Array.from({ length: maxPoints }, (_, index) => rows[Math.round(index * step)]);
}

export function buildOgPreview(source: OgChartSource, selection: { viewId?: string; modeId?: string } = {}): OgPreview {
    const view = source.views?.find(item => item.id === selection.viewId) ?? source.views?.[0];
    const mode = view?.modes?.find(item => item.id === selection.modeId) ?? view?.modes?.[0];
    const data = downsampleRows(mode?.data ?? view?.data ?? source.data, 72);
    const areas = (mode?.areas ?? view?.areas ?? source.areas)
        .filter(area => !area.hideInLegend && !area.hideInTooltip)
        .slice(0, 3);

    return {
        chartTitle: mode?.chartTitle ?? view?.chartTitle ?? source.chartTitle,
        series: areas.flatMap(area => {
            const path = seriesPath(data, area.key);
            return path ? [{ color: area.color, path }] : [];
        }),
    };
}

function seriesPath(data: ChartDataRow[], key: string): string | null {
    const values = data.map(row => {
        const value = Number(row[key]);
        return Number.isFinite(value) ? value : null;
    });
    const finite = values.filter((value): value is number => value != null);
    if (finite.length < 2) return null;

    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const range = max - min || 1;
    const lastIndex = Math.max(data.length - 1, 1);

    return values.flatMap((value, index) => {
        if (value == null) return [];
        const x = (index / lastIndex) * OG_CHART_WIDTH;
        const y = (1 - (value - min) / range) * OG_CHART_HEIGHT;
        return [`${x.toFixed(1)} ${y.toFixed(1)}`];
    }).map((point, index) => `${index === 0 ? 'M' : 'L'}${point}`).join(' ');
}
