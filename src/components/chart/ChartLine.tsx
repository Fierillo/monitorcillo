'use client';

import { Line } from 'recharts';
import type { ChartLineProps } from '@/types/chart';

export default function ChartLine({ areaConfig, isDimmed }: ChartLineProps) {
    return (
        <Line
            type="monotone"
            dataKey={areaConfig.key}
            stroke={areaConfig.color}
            strokeWidth={areaConfig.strokeWidth ?? 3}
            strokeDasharray={areaConfig.dash ? areaConfig.dash.join(' ') : undefined}
            dot={false}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
            style={{ opacity: isDimmed ? 0.2 : 1 }}
        />
    );
}
