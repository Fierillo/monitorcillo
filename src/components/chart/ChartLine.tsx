'use client';

import { Line } from 'recharts';
import type { ChartDataRow, ChartLineProps } from '@/types/chart';
import { handleSeriesCtrlClick } from './seriesInteraction';
import { formatValueByType } from './utils';

type LineLabelProps = {
    index?: number;
    value?: unknown;
    x?: number | string;
    y?: number | string;
};

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

const LABEL_HALF = 10;
const MIN_GAP = 6;

function computeLabelOffsets(
    seriesKeys: string[],
    data: ChartDataRow,
): { offsets: Map<string, number>; arrowUp: Set<string> } {
    const entries = seriesKeys
        .map(key => ({ key, value: data[key] }))
        .filter((entry): entry is { key: string; value: number } =>
            typeof entry.value === 'number' && Number.isFinite(entry.value),
        )
        .sort((a, b) => b.value - a.value);

    if (entries.length === 0) return { offsets: new Map(), arrowUp: new Set() };

    const values = entries.map(e => e.value);
    const dataCenter = (Math.min(...values) + Math.max(...values)) / 2;

    const count = entries.length;
    const step = LABEL_HALF * 2 + MIN_GAP;
    const totalHeight = count * step - MIN_GAP;
    const firstCenter = dataCenter - totalHeight / 2;

    const offsets = new Map<string, number>();
    const arrowUp = new Set<string>();
    for (let i = 0; i < entries.length; i++) {
        const cy = firstCenter + i * step;
        offsets.set(entries[i].key, cy - dataCenter);
        if (cy < dataCenter) arrowUp.add(entries[i].key);
    }
    return { offsets, arrowUp };
}

export default function ChartLine({ areaConfig, isDimmed, data, chartData, allSeriesKeys, isCapturing = false, onCtrlClick }: ChartLineProps) {
    const color = areaConfig.color;
    const gradientId = `line-reveal-${areaConfig.key}`;
    const stroke = areaConfig.revealStrokeAfterPercent == null ? color : `url(#${gradientId})`;
    const showDots = areaConfig.showDots !== false;
    const showAllDots = Boolean(areaConfig.connectNulls) && showDots;
    const strokeWidth = areaConfig.strokeWidth ?? 3;
    const showValueLabels = areaConfig.showValueLabels && !isDimmed && (data?.length ?? 0) <= 36;

    const dot = isDimmed || !showDots ? false : (dotProps: { index?: number; cx?: number; cy?: number }) => {
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

    const label = !showValueLabels ? undefined : (labelProps: LineLabelProps) => {
        const index = labelProps.index ?? 0;
        if (!hasValue(data, index, areaConfig.key)) return null;
        if (typeof labelProps.x !== 'number' || typeof labelProps.y !== 'number') return null;
        const value = Number(labelProps.value);
        if (!Number.isFinite(value)) return null;

        let offsetY = areaConfig.labelOffsetY ?? -10;
        let pointsUp = false;
        if (chartData && allSeriesKeys && allSeriesKeys.length > 1) {
            const row = chartData[index];
            if (row) {
                const { offsets, arrowUp } = computeLabelOffsets(allSeriesKeys, row);
                offsetY = offsets.get(areaConfig.key) ?? offsetY;
                pointsUp = arrowUp.has(areaConfig.key);
            }
        }

        const labelY = labelProps.y + offsetY;
        const needsLeader = areaConfig.labelLeader;

        return (
            <g>
                {needsLeader ? (
                    <>
                        <line x1={labelProps.x} y1={labelProps.y} x2={labelProps.x} y2={labelY + (pointsUp ? 10 : -10)} stroke={color} strokeWidth={1} />
                        <path d={pointsUp
                            ? `M ${labelProps.x} ${labelY + 4} L ${labelProps.x - 3} ${labelY - 1} L ${labelProps.x + 3} ${labelY - 1} Z`
                            : `M ${labelProps.x} ${labelY - 4} L ${labelProps.x - 3} ${labelY + 1} L ${labelProps.x + 3} ${labelY + 1} Z`
                        } fill={color} stroke="none" />
                    </>
                ) : null}
                <text x={labelProps.x} y={labelY} fill={color} fontSize={11} fontWeight={700} textAnchor="middle" paintOrder="stroke" stroke="#00143F" strokeWidth={3} strokeOpacity={0.85}>
                    {formatValueByType(value, areaConfig.valueFormat, 1)}
                </text>
            </g>
        );
    };

    return <>
        {areaConfig.revealStrokeAfterPercent != null ? (
            <defs>
                <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset={`${areaConfig.revealStrokeAfterPercent}%`} stopColor={color} stopOpacity={0} />
                    <stop offset={`${areaConfig.revealStrokeAfterPercent + 0.1}%`} stopColor={color} stopOpacity={1} />
                    <stop offset="100%" stopColor={color} stopOpacity={1} />
                </linearGradient>
            </defs>
        ) : null}
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
            stroke={stroke}
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
        {areaConfig.secondaryColor ? <Line
            type="monotone"
            dataKey={areaConfig.key}
            stroke={areaConfig.secondaryColor}
            strokeWidth={strokeWidth}
            strokeDasharray="5 15"
            dot={false}
            activeDot={false}
            connectNulls={areaConfig.connectNulls}
            isAnimationActive={!isDimmed && !isCapturing}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
            tooltipType="none"
            style={{ opacity: isDimmed ? 0.2 : 1 }}
        /> : null}
        {!isCapturing ? <Line
            type="monotone"
            dataKey={areaConfig.key}
            stroke="transparent"
            strokeWidth={Math.max(12, strokeWidth)}
            dot={false}
            activeDot={false}
            connectNulls={areaConfig.connectNulls}
            isAnimationActive={false}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
            tooltipType="none"
            pointerEvents="stroke"
            onClick={(_data, event) => handleSeriesCtrlClick(event, onCtrlClick)}
        /> : null}
    </>;
}
