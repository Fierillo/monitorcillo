import type { ReactElement } from 'react';

export interface AreaConfig {
    key: string;
    name: string;
    color: string;
    stackId?: string;
    type?: 'monotone' | 'step' | 'line' | 'bar';
    yAxisId?: 'left' | 'right';
    legendKey?: string;
    hideInLegend?: boolean;
}

export interface MethodologyItem {
    title: string;
    description: string;
}

export interface YAxisConfig {
    label?: string;
    color?: string;
    format?: 'billions' | 'index' | 'millions' | 'percent';
    domain?: [number, number] | 'auto';
}

export type ValueFormat = 'billions' | 'index' | 'millions' | 'percent';

export type ChartValue = string | number | null | undefined;

export type ChartDataRow = {
    fecha?: string;
    iso_fecha?: string;
    mes?: string;
    year?: number;
    pctPbi?: number | null;
    [key: string]: ChartValue;
};

export type ChartAxisDomainValue = number | string;

export type ChartAxisDomain = [ChartAxisDomainValue, ChartAxisDomainValue] | 'auto-pad' | 'auto';

export type TooltipPayload = {
    payload?: ChartDataRow;
    value?: ChartValue;
    name?: string;
    dataKey?: string | number;
};

export type TooltipProps = {
    active?: boolean;
    label?: string | number;
    payload?: readonly TooltipPayload[];
};

export type ChartClickState = {
    activePayload?: readonly TooltipPayload[];
    activeTooltipIndex?: number | string | null;
};

export type ChartBarClickEvent = {
    stopPropagation?: () => void;
};

export type ChartBarShapeProps = {
    payload?: ChartDataRow;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    fill?: string;
};

export interface IndicatorCompositeViewProps {
    title: string;
    subtitle?: string;
    chartTitle: string;
    data: ChartDataRow[];
    areas: AreaConfig[];
    methodology: MethodologyItem[];
    valueFormat?: ValueFormat;
    yAxisLabel?: string;
    secondaryYAxis?: YAxisConfig;
    leftYAxisDomain?: ChartAxisDomain;
    indicatorId?: string;
}

export type ChartTooltipProps = {
    chartData: ChartDataRow[];
    areaConfigs: AreaConfig[];
    valueFormat: ValueFormat;
    tooltipProps: TooltipProps;
};

export type ChartBarProps = {
    areaConfig: AreaConfig;
    isDimmed: boolean;
    selectedMonth: string | null;
    onSelectMonth: (month: string | null) => void;
    selectByMonth?: boolean;
};

export type ChartAreaProps = {
    areaConfig: AreaConfig;
    isDimmed: boolean;
};

export type ChartLineProps = {
    areaConfig: AreaConfig;
    isDimmed: boolean;
};

export type CustomLegendProps = {
    areas: AreaConfig[];
    dimmedAreas: Set<string>;
    onToggleDim: (key: string) => void;
};

export type MethodologySectionProps = {
    methodology: MethodologyItem[];
    forceOpen?: boolean;
};

export type ChartAxisDomainParams = {
    chartData: ChartDataRow[];
    areaKeys: string[];
    yAxisId?: 'left' | 'right';
};

export type ChartRenderer = ReactElement | null;
