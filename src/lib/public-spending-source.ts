import type { ChartDataRow } from '@/types';

type SpendingPoint = {
    year: number;
    nation: number;
    provinces: number;
    municipalities: number;
    interest: number;
};

const SPENDING_ANCHORS: SpendingPoint[] = [
    { year: 1981, nation: 17.5, provinces: 8, municipalities: 1.5, interest: 4 },
    { year: 1984, nation: 14.5, provinces: 7, municipalities: 1.5, interest: 3 },
    { year: 1987, nation: 20, provinces: 9, municipalities: 2, interest: 4 },
    { year: 1990, nation: 17.5, provinces: 9, municipalities: 2.5, interest: 1.5 },
    { year: 1995, nation: 15, provinces: 11, municipalities: 2.5, interest: 4 },
    { year: 1998, nation: 13.5, provinces: 11.5, municipalities: 2, interest: 3.5 },
    { year: 2001, nation: 14, provinces: 14, municipalities: 3, interest: 5 },
    { year: 2002, nation: 13, provinces: 11, municipalities: 2, interest: 3 },
    { year: 2004, nation: 12, provinces: 10, municipalities: 3, interest: 2 },
    { year: 2007, nation: 13, provinces: 13, municipalities: 3, interest: 3 },
    { year: 2009, nation: 19, provinces: 16, municipalities: 3, interest: 2 },
    { year: 2010, nation: 20, provinces: 13, municipalities: 3, interest: 2 },
    { year: 2013, nation: 22, provinces: 16, municipalities: 3, interest: 2 },
    { year: 2016, nation: 24, provinces: 16, municipalities: 3, interest: 6 },
    { year: 2018, nation: 21, provinces: 15, municipalities: 3, interest: 5 },
    { year: 2019, nation: 20, provinces: 15, municipalities: 3, interest: 6 },
    { year: 2020, nation: 25, provinces: 16, municipalities: 3, interest: 4 },
    { year: 2021, nation: 22, provinces: 15, municipalities: 3, interest: 3 },
    { year: 2023, nation: 20, provinces: 15, municipalities: 3, interest: 4 },
    { year: 2024, nation: 15, provinces: 15, municipalities: 3, interest: 2 },
    { year: 2025, nation: 15, provinces: 15, municipalities: 3, interest: 1 },
];

function interpolate(start: SpendingPoint, end: SpendingPoint, year: number, key: keyof Omit<SpendingPoint, 'year'>): number {
    const progress = (year - start.year) / (end.year - start.year);
    return Number((start[key] + (end[key] - start[key]) * progress).toFixed(2));
}

function spendingPointForYear(year: number): SpendingPoint {
    const exact = SPENDING_ANCHORS.find(point => point.year === year);
    if (exact) return exact;

    const endIndex = SPENDING_ANCHORS.findIndex(point => point.year > year);
    const start = SPENDING_ANCHORS[endIndex - 1];
    const end = SPENDING_ANCHORS[endIndex];
    return {
        year,
        nation: interpolate(start, end, year, 'nation'),
        provinces: interpolate(start, end, year, 'provinces'),
        municipalities: interpolate(start, end, year, 'municipalities'),
        interest: interpolate(start, end, year, 'interest'),
    };
}

export const PUBLIC_SPENDING_CHART_DATA: ChartDataRow[] = Array.from({ length: 45 }, (_, index) => {
    const point = spendingPointForYear(1981 + index);
    return {
        fecha: String(point.year),
        iso_fecha: `${point.year}-01-01`,
        nation: point.nation,
        provinces: point.provinces,
        municipalities: point.municipalities,
        interest: point.interest,
        total: Number((point.nation + point.provinces + point.municipalities + point.interest).toFixed(2)),
    };
});
