'use client';

import { Line } from 'recharts';
import type { ChartDataRow, ChartLineProps } from '@/types/chart';

function hasValue(data: ChartDataRow[] | undefined, index: number, key: string): boolean {
    if (!data || index < 0 || index >= data.length) return false;
    const current = data[index][key];
    return current != null && (typeof current !== 'number' || Number.isFinite(current));
}

function isIsolatedPoint(data: ChartDataRow[] | undefined, index: number, key: string): boolean {
    if (!hasValue(data, index, key)) return false;
    const prev = data![index - 1]?.[key];
    const next = data![index + 1]?.[key];
    const hasPrev = prev != null && (typeof prev !== 'number' || Number.isFinite(prev));
    const hasNext = next != null && (typeof next !== 'number' || Number.isFinite(next));
    return !hasPrev || !hasNext;
}

function isValueChange(data: ChartDataRow[] | undefined, index: number, key: string): boolean {
    if (!hasValue(data, index, key)) return false;
    if (!data) return true;
    const current = data[index][key];
    const next = data[index + 1]?.[key];
    const hasNext = next != null && (typeof next !== 'number' || Number.isFinite(next));
    return !hasNext || current !== next;
}

export default function ChartLine({ areaConfig, isDimmed, data }: ChartLineProps) {
    const color = areaConfig.color;
    const showAllDots = areaConfig.connectNulls;
    const strokeWidth = areaConfig.strokeWidth ?? 3;

    const dot = isDimmed ? false : (dotProps: { index?: number; cx?: number; cy?: number }) => {
        const index = dotProps.index ?? 0;
        const isDataPoint = hasValue(data, index, areaConfig.key);
        if (!isDataPoint) return null;
        const isIsolated = isIsolatedPoint(data, index, areaConfig.key);
        const isChange = isValueChange(data, index, areaConfig.key);
        const isHighlighted = showAllDots ? isChange : isIsolated;
        if (!isHighlighted) return null;

        return (
            <circle
                cx={dotProps.cx}
                cy={dotProps.cy}
                r={showAllDots ? 5 : 4}
                fill={showAllDots ? color : '#fff'}
                stroke={color}
                strokeWidth={2}
            />
        );
    };

    return <>
        {areaConfig.borderColor ? <Line
            type="monotone"
            dataKey={areaConfig.key}
            stroke={areaConfig.borderColor}
            strokeWidth={areaConfig.borderWidth ?? strokeWidth + 2}
            strokeDasharray={areaConfig.dash ? areaConfig.dash.join(' ') : undefined}
            dot={false}
            activeDot={false}
            connectNulls={areaConfig.connectNulls}
            isAnimationActive={false}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
            tooltipType="none"
            style={{ opacity: isDimmed ? 0.2 : 1 }}
        /> : null}
        <Line
            type="monotone"
            dataKey={areaConfig.key}
            stroke={areaConfig.color}
            strokeWidth={strokeWidth}
            strokeDasharray={areaConfig.dash ? areaConfig.dash.join(' ') : undefined}
            dot={dot}
            connectNulls={areaConfig.connectNulls}
            isAnimationActive={!isDimmed}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
            style={{ opacity: isDimmed ? 0.2 : 1 }}
        />
    </>;
}
