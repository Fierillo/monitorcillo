'use client';

import { Line } from 'recharts';
import type { ChartLineProps } from '@/types/chart';

function dotProps(dot: boolean | { r?: number } | undefined) {
    if (!dot) return false;
    if (dot === true) return { r: 3, fill: '#fff', strokeWidth: 2 };
    return { r: dot.r ?? 3, fill: '#fff', strokeWidth: 2 };
}

export default function ChartLine({ areaConfig, isDimmed }: ChartLineProps) {
    return (
        <Line
            type="monotone"
            dataKey={areaConfig.key}
            stroke={areaConfig.color}
            strokeWidth={areaConfig.strokeWidth ?? 3}
            strokeDasharray={areaConfig.dash ? areaConfig.dash.join(' ') : undefined}
            dot={dotProps(areaConfig.dot)}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
            style={{ opacity: isDimmed ? 0.2 : 1 }}
        />
    );
}
