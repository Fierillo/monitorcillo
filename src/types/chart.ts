import type { ReactElement } from 'react';

export interface AreaConfig {
    key: string;
    name: string;
    color: string;
    secondaryColor?: string;
    valueFormat?: ValueFormat;
    valueDecimals?: number;
    showValueLabels?: boolean;
    labelOffsetY?: number;
    labelLeader?: boolean;
    stackId?: string;
    maxBarSize?: number;
    type?: 'monotone' | 'step' | 'line' | 'bar';
    yAxisId?: 'left' | 'right';
    legendKey?: string;
    hideInLegend?: boolean;
    preliminaryKey?: string;
    preliminaryLabel?: string;
    preliminaryColor?: string;
    preliminaryBorderColor?: string;
    dash?: number[];
    borderColor?: string;
    borderWidth?: number;
    fill?: boolean;
    fillPattern?: 'diagonal-stripes';
    strokeWidth?: number;
    legendFilled?: boolean;
    connectNulls?: boolean;
    /** When false, the series renders as a pure line without vertex markers. Default: true. */
    showDots?: boolean;
    comparisonMode?: 'mandate-month';
    transparentTooltip?: boolean;
    hideInTooltip?: boolean;
    tooltipFallbackKey?: string;
    tooltipBackgroundColor?: string;
    revealStrokeAfterPercent?: number;
}

export interface MethodologyItem {
    title: string;
    description: string;
}

export interface YAxisConfig {
    label?: string;
    color?: string;
    format?: 'billions' | 'currency' | 'index' | 'millions' | 'percent';
    domain?: [number, number] | 'auto';
    includeZero?: boolean;
}

export type ValueFormat = 'billions' | 'currency' | 'index' | 'millions' | 'percent';

export type ChartValue = string | number | boolean | null | undefined;

export type ChartDataRow = {
    fecha?: string;
    iso_fecha?: string;
    mes?: string;
    year?: number;
    pctPbi?: number | null;
    pctPbiMm12?: number | null;
    preliminary?: boolean;
    [key: string]: ChartValue;
};

export type ChartAxisDomainValue = number | string;

export type ChartAxisDomain = [ChartAxisDomainValue, ChartAxisDomainValue] | 'auto-pad' | 'auto';

export type ChartReferenceLine = {
    value: number;
    label?: string;
    color?: string;
    dash?: number[];
};

export type ChartModeConfig = {
    id: string;
    label: string;
    chartTitle: string;
    data: ChartDataRow[];
    yAxisLabel: string;
    valueFormat?: ValueFormat;
    yAxisDecimals?: number;
    leftYAxisDomain?: ChartAxisDomain;
    areas?: AreaConfig[];
    showTooltipTotal?: boolean;
};

export type ChartViewConfig = {
    id: string;
    label: string;
    chartTitle: string;
    /** When omitted, the parent chart data is reused. */
    data?: ChartDataRow[];
    areas: AreaConfig[];
    methodology: MethodologyItem[];
    valueFormat?: ValueFormat;
    yAxisDecimals?: number;
    yAxisLabel?: string;
    secondaryYAxis?: YAxisConfig;
    leftYAxisDomain?: ChartAxisDomain;
    showTooltipTotal?: boolean;
    referenceLines?: ChartReferenceLine[];
    modes?: ChartModeConfig[];
    rebaseable?: boolean;
    defaultBaseDate?: string;
};

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
    activeCoordinate?: { x?: number; y?: number };
};

export type ChartCrosshairState = {
    x: number;
    y: number;
    locked: boolean;
    activePayload?: readonly TooltipPayload[];
    label?: string;
    tooltipPosition?: { x: number; y: number };
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
    yAxisDecimals?: number;
    yAxisLabel?: string;
    secondaryYAxis?: YAxisConfig;
    leftYAxisDomain?: ChartAxisDomain;
    showTooltipTotal?: boolean;
    indicatorId?: string;
    views?: ChartViewConfig[];
}

export type ChartTooltipProps = {
    chartData: ChartDataRow[];
    areaConfigs: AreaConfig[];
    valueFormat: ValueFormat;
    tooltipProps: TooltipProps;
    compact?: boolean;
    showTotal?: boolean;
    isCapturing?: boolean;
};

export type ChartBarProps = {
    areaConfig: AreaConfig;
    isDimmed: boolean;
    selectedMonth: string | null;
    onSelectMonth: (month: string | null) => void;
    selectByMonth?: boolean;
    isCapturing?: boolean;
};

export type ChartAreaProps = {
    areaConfig: AreaConfig;
    isDimmed: boolean;
};

export type ChartLineProps = {
    areaConfig: AreaConfig;
    isDimmed: boolean;
    data?: ChartDataRow[];
    isCapturing?: boolean;
};

export type CustomLegendProps = {
    areas: AreaConfig[];
    highlightedAreas: Set<string>;
    onToggleHighlight: (key: string) => void;
    compact?: boolean;
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
