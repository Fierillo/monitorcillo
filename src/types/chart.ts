export interface AreaConfig {
    key: string;
    name: string;
    color: string;
    stackId?: string;
    type?: 'monotone' | 'step' | 'line' | 'bar';
    yAxisId?: 'left' | 'right';
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

export interface IndicatorCompositeViewProps {
    title: string;
    subtitle?: string;
    chartTitle: string;
    data: any[];
    areas: AreaConfig[];
    methodology: MethodologyItem[];
    valueFormat?: ValueFormat;
    yAxisLabel?: string;
    secondaryYAxis?: YAxisConfig;
    leftYAxisDomain?: [any, any] | 'auto-pad' | 'auto';
}
