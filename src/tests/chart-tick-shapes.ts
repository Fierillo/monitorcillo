export type ChartTickShape = {
    name: string;
    plotWidth: number;
    fontSize: number;
    labels: string[];
    months: number;
};

function monthlyLabels(prefix: string, count: number): string[] {
    return Array.from({ length: count }, (_, index) => `${prefix} ${String((index % 12) + 1).padStart(2, '0')}`);
}

export function chartTickShapes(): ChartTickShape[] {
    return [
        { name: 'desktop wide range', plotWidth: 1163, fontSize: 10, labels: monthlyLabels('JUL', 121), months: 121 },
        { name: 'desktop long labels', plotWidth: 1062, fontSize: 10, labels: monthlyLabels('AGOSTO', 409), months: 409 },
        { name: 'desktop short range', plotWidth: 1163, fontSize: 10, labels: monthlyLabels('ENE', 13), months: 13 },
        { name: 'mobile narrow', plotWidth: 338, fontSize: 9, labels: monthlyLabels('AGO', 121), months: 121 },
        { name: 'very narrow', plotWidth: 180, fontSize: 9, labels: monthlyLabels('JUL', 121), months: 121 },
        { name: 'few bars', plotWidth: 1163, fontSize: 10, labels: monthlyLabels('AGO', 6), months: 6 },
    ];
}
