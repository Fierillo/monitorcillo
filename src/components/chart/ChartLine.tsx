'use client';

import { Line } from 'recharts';
import type { ChartDataRow, ChartLineProps } from '@/types/chart';

function isIsolatedPoint(data: ChartDataRow[] | undefined, index: number, key: string): boolean {
    if (!data || index < 0 || index >= data.length) return false;
    const current = data[index][key];
    if (current == null || (typeof current === 'number' && !Number.isFinite(current))) return false;
    const prev = data[index - 1]?.[key];
    const next = data[index + 1]?.[key];
    const hasPrev = prev != null && (typeof prev !== 'number' || Number.isFinite(prev));
    const hasNext = next != null && (typeof next !== 'number' || Number.isFinite(next));
    return !hasPrev || !hasNext;
}

export default function ChartLine({ areaConfig, isDimmed, data }: ChartLineProps) {
    const color = areaConfig.color;
    const dot = isDimmed ? false : (dotProps: { index?: number; cx?: number; cy?: number }) => {
        const index = dotProps.index ?? 0;
        if (!isIsolatedPoint(data, index, areaConfig.key)) return null;
        return (
            <circle
                cx={dotProps.cx}
                cy={dotProps.cy}
                r={4}
                fill="#fff"
                stroke={color}
                strokeWidth={2}
            />
        );
    };

    return (
        <Line
            type="monotone"
            dataKey={areaConfig.key}
            stroke={areaConfig.color}
            strokeWidth={areaConfig.strokeWidth ?? 3}
            strokeDasharray={areaConfig.dash ? areaConfig.dash.join(' ') : undefined}
            dot={dot}
            isAnimationActive={!isDimmed}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
            style={{ opacity: isDimmed ? 0.2 : 1 }}
        />
    );
}
