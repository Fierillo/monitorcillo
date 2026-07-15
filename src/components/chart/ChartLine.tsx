'use client';

import { Line } from 'recharts';
import type { ChartDataRow, ChartLineProps } from '@/types/chart';
import { formatValueByType } from './utils';

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

export default function ChartLine({ areaConfig, isDimmed, data, isCapturing = false }: ChartLineProps) {
    const color = areaConfig.color;
    const showAllDots = areaConfig.connectNulls;
    const strokeWidth = areaConfig.strokeWidth ?? 3;
    const showValueLabels = areaConfig.showValueLabels && !isDimmed && (data?.length ?? 0) <= 36;

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

    const label = !showValueLabels ? undefined : (labelProps: any) => {
        const index = labelProps.index ?? 0;
        if (!hasValue(data, index, areaConfig.key)) return null;
        if (typeof labelProps.x !== 'number' || typeof labelProps.y !== 'number') return null;
        const value = Number(labelProps.value);
        if (!Number.isFinite(value)) return null;
        const labelY = labelProps.y + (areaConfig.labelOffsetY ?? -10);
        const needsLeader = areaConfig.labelLeader && Math.abs(labelY - labelProps.y) > 12;

        return (
            <g>
                {needsLeader ? (
                    <>
                        <line x1={labelProps.x} y1={labelProps.y} x2={labelProps.x} y2={labelY + (labelY < labelProps.y ? 4 : -4)} stroke={color} strokeWidth={1} />
                        <path d={labelY < labelProps.y ? `M ${labelProps.x - 3} ${labelProps.y - 5} L ${labelProps.x} ${labelProps.y} L ${labelProps.x + 3} ${labelProps.y - 5}` : `M ${labelProps.x - 3} ${labelProps.y + 5} L ${labelProps.x} ${labelProps.y} L ${labelProps.x + 3} ${labelProps.y + 5}`} fill="none" stroke={color} strokeWidth={1} />
                    </>
                ) : null}
                <text x={labelProps.x} y={labelY} fill={color} fontSize={11} fontWeight={700} textAnchor="middle" paintOrder="stroke" stroke="#00143F" strokeWidth={3} strokeOpacity={0.85}>
                    {formatValueByType(value, areaConfig.valueFormat, 1)}
                </text>
            </g>
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
            label={label}
            connectNulls={areaConfig.connectNulls}
            isAnimationActive={!isDimmed && !isCapturing}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
            style={{ opacity: isDimmed ? 0.2 : 1 }}
        />
    </>;
}
