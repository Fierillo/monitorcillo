'use client';

import type { CustomLegendProps } from '@/types/chart';
import SeriesColorMarker from './SeriesColorMarker';

export default function CustomLegend({ areas, highlightedAreas, onToggleHighlight, compact = false }: CustomLegendProps) {
    const legendAreas = areas.filter((area, index) => {
        if (area.hideInLegend) return false;
        const toggleKey = area.legendKey || area.key;
        return areas.findIndex((candidate) => (candidate.legendKey || candidate.key) === toggleKey && !candidate.hideInLegend) === index;
    });
    const preliminaryItems = areas.filter(area => area.preliminaryLabel);
    const hasHighlights = highlightedAreas.size > 0;

    return (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: compact ? '4px 20px' : '8px 24px', paddingTop: compact ? '4px' : '10px', paddingBottom: compact ? '4px' : '10px' }}>
            {legendAreas.map(area => {
                const toggleKey = area.legendKey || area.key;
                const isHighlighted = highlightedAreas.has(toggleKey);
                const isDimmed = hasHighlights && !isHighlighted;
                const markerColor = isDimmed ? '#666' : area.color;
                const secondaryMarkerColor = isDimmed ? '#666' : area.secondaryColor;
                return (
                    <span
                        key={toggleKey}
                        onClick={() => onToggleHighlight(toggleKey)}
                        style={{
                            color: isDimmed ? '#666' : '#FFD700',
                            opacity: isDimmed ? 0.45 : 1,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 12,
                            fontWeight: isHighlighted ? 800 : 600,
                        }}
                        title="Click para destacar u ocultar el destacado"
                    >
                        {secondaryMarkerColor
                            ? <SeriesColorMarker color={markerColor} secondaryColor={secondaryMarkerColor} />
                            : <svg width="10" height="10"><circle cx="5" cy="5" r="5" fill={area.legendFilled === false ? 'transparent' : markerColor} stroke={markerColor} strokeWidth={area.legendFilled === false ? 1.5 : 0} /></svg>}
                        {area.name}
                    </span>
                );
            })}
            {preliminaryItems.map(area => (
                <span
                    key={`${area.key}-preliminary`}
                    style={{
                        color: '#FFD700',
                        opacity: 0.8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12,
                    }}
                >
                    <svg width="14" height="10">
                        {(area.preliminaryFillPattern ?? area.fillPattern) === 'diagonal-stripes' ? (
                            <defs>
                                <pattern id={`legend-pattern-${area.key}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                                    <rect width="4" height="4" fill={area.color} />
                                    <line x1="0" y1="0" x2="0" y2="4" stroke="#00143F" strokeOpacity="0.55" strokeWidth="1.5" />
                                </pattern>
                            </defs>
                        ) : null}
                        <rect x="1" y="1" width="12" height="8" fill={(area.preliminaryFillPattern ?? area.fillPattern) === 'diagonal-stripes' ? `url(#legend-pattern-${area.key})` : area.color} fillOpacity={area.preliminaryFillPattern || area.fillPattern ? 1 : 0.45} stroke={area.preliminaryBorderColor ?? area.borderColor ?? area.color} strokeDasharray={area.preliminaryFillPattern || area.fillPattern ? undefined : '3 2'} />
                    </svg>
                    {area.preliminaryLabel}
                </span>
            ))}
        </div>
    );
}
