import type { ChartAxisDomain, ChartDataRow, ChartViewConfig } from '@/types/chart';

export type PersistedChartConfig = {
    selectedViewId?: string;
    highlightedAreasByView?: Record<string, string[]>;
    rangeByView?: Record<string, [number, number]>;
    baseDateByView?: Record<string, string>;
};

type ChartViewMemory = ChartViewConfig;

export function parsePersistedChartConfig(raw: string | null): PersistedChartConfig | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as unknown;
        return parsed && typeof parsed === 'object' ? parsed as PersistedChartConfig : null;
    } catch {
        return null;
    }
}

export function pickViewId(
    views: readonly ChartViewMemory[] | undefined,
    initialViewId: string | undefined,
    persistedViewId: string | undefined,
): string {
    if (views?.some(view => view.id === initialViewId)) return initialViewId!;
    if (persistedViewId && (views?.some(view => view.id === persistedViewId) || (!views?.length && persistedViewId === 'default'))) return persistedViewId;
    return views?.[0]?.id ?? 'default';
}

export function restoreBaseDateByView(
    config: Record<string, string> | undefined,
    views: readonly ChartViewMemory[] | undefined,
): Record<string, string> {
    if (!config) return {};
    return Object.fromEntries((views?.length ? views : [{ id: 'default', modes: [] }]).flatMap(view => {
        const defaultModeId = view.modes?.[0]?.id ?? 'default';
        const date = config[view.id] ?? config[`${view.id}:${defaultModeId}`];
        return date ? [[view.id, date]] : [];
    }));
}

export function clampChartRange(range: [number, number] | undefined, maxIndex: number): [number, number] {
    if (!range) return [0, maxIndex];
    const start = Math.min(Math.max(0, range[0]), maxIndex);
    const end = Math.min(Math.max(range[1], start), maxIndex);
    return [start, end];
}

export function restoreHighlightedAreasByView(
    config: Record<string, string[]>,
    views: readonly ChartViewMemory[] | undefined,
): Record<string, Set<string>> {
    if (!views?.length) {
        const keys = config.default ?? config['default:default'];
        return keys ? { default: new Set(keys) } : {};
    }
    return Object.fromEntries(views.flatMap(view => {
        const defaultModeId = view.modes?.[0]?.id ?? 'default';
        const keys = config[view.id] ?? config[`${view.id}:${defaultModeId}`];
        return keys ? [[view.id, new Set(keys)] as const] : [];
    }));
}

const BASE_DATE_LABELS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export function formatBaseDate(date: string): string {
    const [year, month] = date.split('-');
    return `${BASE_DATE_LABELS[Number(month) - 1]}-${year.slice(-2)}`;
}

export function paddedAxisDomain(mode: 'auto' | 'auto-pad' | undefined, values: number[]): ChartAxisDomain {
    if (values.length === 0) return [0, 10];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (mode === 'auto-pad') {
        const pad = range === 0 ? Math.max(Math.abs(min) * 0.1, 1) : range * 0.1;
        return [min - pad, max + pad];
    }

    if (!mode || mode === 'auto') {
        const pad = range === 0 ? 1 : range * 0.05;
        return [min < 0 ? min - pad : 0, max + pad];
    }

    return [min, max];
}

export function chartRowSortKey(row: ChartDataRow): string {
    if (typeof row?.iso_fecha === 'string' && row.iso_fecha) return row.iso_fecha;
    if (typeof row?.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.fecha)) return row.fecha;
    return '';
}

export function sortChartRows<T extends ChartDataRow>(rows: readonly T[]): T[] {
    return [...rows].sort((a, b) => chartRowSortKey(a).localeCompare(chartRowSortKey(b)));
}

export function rowsEligibleForBase(rows: readonly ChartDataRow[], areaKeys: readonly string[]): ChartDataRow[] {
    return rows.filter(row => typeof row.iso_fecha === 'string' && areaKeys.every(key => {
        const value = row[key];
        return typeof value === 'number' && Number.isFinite(value) && value !== 0;
    }));
}

export function pickBaseRow(
    validRows: readonly ChartDataRow[],
    preferredDate: string | undefined,
    defaultDate: string | undefined,
): ChartDataRow | undefined {
    return validRows.find(row => row.iso_fecha === preferredDate)
        ?? validRows.find(row => row.iso_fecha === defaultDate)
        ?? validRows[0];
}

export function selectBaseRow(
    rows: readonly ChartDataRow[],
    areaKeys: readonly string[],
    preferredDate: string | undefined,
    defaultDate: string | undefined,
): ChartDataRow | undefined {
    return pickBaseRow(rowsEligibleForBase(rows, areaKeys), preferredDate, defaultDate);
}

export function rebaseChartRows<T extends ChartDataRow>(
    rows: readonly T[],
    baseRow: ChartDataRow,
    areaKeys: readonly string[],
): T[] {
    return rows.map(row => ({
        ...row,
        ...Object.fromEntries(areaKeys.map(key => {
            const value = row[key];
            const baseValue = baseRow[key];
            return [key, typeof value === 'number' && typeof baseValue === 'number' && baseValue !== 0 ? value / baseValue * 100 : null];
        })),
    }));
}
