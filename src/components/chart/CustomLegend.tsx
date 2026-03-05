'use client';

import { AreaConfig } from '@/types/chart';

interface CustomLegendProps {
    areas: AreaConfig[];
    dimmedAreas: Set<string>;
    onToggleDim: (key: string) => void;
}

export default function CustomLegend({ areas, dimmedAreas, onToggleDim }: CustomLegendProps) {
    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px 16px', paddingTop: '10px' }}>
            {areas.map(area => {
                const isDimmed = dimmedAreas.has(area.key);
                return (
                    <span
                        key={area.key}
                        onClick={() => onToggleDim(area.key)}
                        style={{
                            color: isDimmed ? '#666' : '#FFD700',
                            opacity: isDimmed ? 0.5 : 1,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 14,
                        }}
                    >
                        <svg width="10" height="10">
                            <circle cx="5" cy="5" r="5" fill={isDimmed ? '#666' : area.color} />
                        </svg>
                        {area.name}
                    </span>
                );
            })}
        </div>
    );
}
