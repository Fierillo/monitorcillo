'use client';

import { AreaConfig } from '@/types/chart';

interface CustomLegendProps {
    areas: AreaConfig[];
    dimmedAreas: Set<string>;
    onToggleDim: (key: string) => void;
}

export default function CustomLegend({ areas, dimmedAreas, onToggleDim }: CustomLegendProps) {
    const legendAreas = areas.filter((area, index) => {
        if (area.hideInLegend) return false;
        const toggleKey = area.legendKey || area.key;
        return areas.findIndex((candidate) => (candidate.legendKey || candidate.key) === toggleKey && !candidate.hideInLegend) === index;
    });

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 24px', paddingTop: '10px', paddingBottom: '10px' }}>
            {legendAreas.map(area => {
                const toggleKey = area.legendKey || area.key;
                const isDimmed = dimmedAreas.has(toggleKey);
                return (
                    <span
                        key={toggleKey}
                        onClick={() => onToggleDim(toggleKey)}
                        style={{
                            color: isDimmed ? '#666' : '#FFD700',
                            opacity: isDimmed ? 0.5 : 1,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12,
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
