'use client';

import { Area } from 'recharts';
import { AreaConfig } from '@/types/chart';

interface ChartAreaProps {
    areaConfig: AreaConfig;
    isDimmed: boolean;
}

export default function ChartArea({ areaConfig, isDimmed }: ChartAreaProps) {
    const areaType = areaConfig.type === 'step' ? 'step' : areaConfig.type === 'monotone' ? 'monotone' : undefined;
    
    return (
        <Area
            type={areaType}
            dataKey={areaConfig.key}
            stackId={areaConfig.stackId || '1'}
            stroke={areaConfig.color}
            fill={areaConfig.color}
            fillOpacity={areaConfig.stackId === '2' ? 0 : 0.7}
            strokeWidth={areaConfig.stackId === '2' ? 2 : 1}
            name={areaConfig.name}
            yAxisId={areaConfig.yAxisId || 'left'}
            style={{ opacity: isDimmed ? 0.2 : 1 }}
        />
    );
}
