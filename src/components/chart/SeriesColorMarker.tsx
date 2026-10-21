'use client';

import { LEGEND_OUTLINE_COLOR, needsLegendOutline } from '@/lib/color-contrast';

type SeriesColorMarkerProps = {
    color: string;
    secondaryColor?: string;
    dash?: number[];
    strokeWidth?: number;
    width?: number;
};

export default function SeriesColorMarker({ color, secondaryColor, dash, strokeWidth = 3, width = 24 }: SeriesColorMarkerProps) {
    return (
        <svg aria-hidden="true" width={width} height="10" viewBox={`0 0 ${width} 10`} style={{ display: 'block', flex: '0 0 auto' }}>
            {needsLegendOutline(color) ? <line data-legend-outline="true" x1="1" x2={width - 1} y1="5" y2="5" stroke={LEGEND_OUTLINE_COLOR} strokeWidth={strokeWidth + 2} strokeLinecap="round" /> : null}
            <line x1="1" x2={width - 1} y1="5" y2="5" stroke={color} strokeWidth={strokeWidth} strokeDasharray={dash?.join(' ')} strokeLinecap="round" />
            {secondaryColor ? <line x1="1" x2={width - 1} y1="5" y2="5" stroke={secondaryColor} strokeWidth={strokeWidth} strokeDasharray="5 15" strokeLinecap="round" /> : null}
        </svg>
    );
}
