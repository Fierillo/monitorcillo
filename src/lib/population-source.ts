import type { DatosGobSeriesRow } from '@/types';

type PopulationAnchor = {
    date: string;
    month: number;
    value: number;
};

export function parseWorldBankPopulation(response: unknown): DatosGobSeriesRow[] {
    if (!Array.isArray(response) || !Array.isArray(response[1])) return [];

    return response[1]
        .map((item: unknown): DatosGobSeriesRow | null => {
            if (!item || typeof item !== 'object') return null;
            const { date, value } = item as { date?: unknown; value?: unknown };
            const year = String(date ?? '');
            const population = Number(value);
            return /^\d{4}$/.test(year) && Number.isFinite(population) ? [`${year}-07-01`, population] : null;
        })
        .filter((row: DatosGobSeriesRow | null): row is DatosGobSeriesRow => row !== null)
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
}

function monthNumber(date: string): number {
    return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
}

export function buildMonthlyPopulationSeries(rows: DatosGobSeriesRow[], targetDates: string[]): Map<string, number> {
    const anchors: PopulationAnchor[] = rows
        .map(row => ({ date: String(row[0]), month: monthNumber(String(row[0])), value: Number(row[1]) }))
        .filter(anchor => /^\d{4}-\d{2}-\d{2}$/.test(anchor.date) && Number.isFinite(anchor.value))
        .sort((a, b) => a.month - b.month);
    const population = new Map<string, number>();
    if (anchors.length < 2) return population;

    for (const date of targetDates) {
        const targetMonth = monthNumber(date);
        const previousIndex = anchors.findLastIndex(anchor => anchor.month <= targetMonth);
        if (previousIndex < 0) continue;

        const previous = anchors[previousIndex];
        const next = anchors[previousIndex + 1];
        const comparison = next ?? anchors[previousIndex - 1];
        if (!comparison) continue;

        const monthSpan = next ? next.month - previous.month : previous.month - comparison.month;
        if (monthSpan <= 0) continue;
        const monthlyChange = next
            ? (next.value - previous.value) / monthSpan
            : (previous.value - comparison.value) / monthSpan;
        population.set(date, previous.value + monthlyChange * (targetMonth - previous.month));
    }

    return population;
}
