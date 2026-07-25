'use client';

type SeriesColorMarkerProps = {
    color: string;
    secondaryColor?: string;
    width?: number;
};

export default function SeriesColorMarker({ color, secondaryColor, width = 20 }: SeriesColorMarkerProps) {
    const background = secondaryColor
        ? `repeating-linear-gradient(90deg, ${secondaryColor} 0 5px, ${color} 5px 20px)`
        : color;

    return <span aria-hidden="true" style={{ display: 'inline-block', flex: '0 0 auto', width, height: 4, borderRadius: 2, background }} />;
}
