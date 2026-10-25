import { describe, expect, it } from 'vitest';
import { normalizeGasto, partialCuts, publicSpendingChartRows, quarterEndIso, toGastoRawRows } from '../lib/normalize';
import { mergeRawSeries } from '../lib/sync/merge-raw';
import type { GastoRawRow } from '@/types';

const official = { fecha: '2024', iso_fecha: '2024-01-01', nation: 16, provinces: 14, municipalities: 3, interest: 2.6, total: 35.6, preliminary: true };
const estimate = { fecha: '2025', iso_fecha: '2025-01-01', nationEstimate: 15, provincesEstimate: 15, municipalitiesEstimate: 3, interestEstimate: 1, totalEstimate: 34, estimate: true };
const partial = { fecha: '2026', iso_fecha: '2026-01-01', nationPartial: 15.22, provincesPartial: 14.9, municipalitiesPartial: 2.975, interestPartial: 1.85, totalPartial: 34.945, partial: true, partialAsOf: '2026-10-21', partialQuarters: 2, partialBridgeYear: 2024, partialInterestSubnational: 0.15 };

const raw: GastoRawRow[] = [
    { fecha: '2024-01-01', nation: 16, provinces: 14, municipalities: 3, interest: 2.6, total: 35.6, kind: 'preliminary', as_of: null, partial_quarters: null, bridge_year: null, interest_subnational: null },
    { fecha: '2025-01-01', nation: 15, provinces: 15, municipalities: 3, interest: 1, total: 34, kind: 'estimate', as_of: null, partial_quarters: null, bridge_year: null, interest_subnational: null },
    { fecha: '2026-01-01', nation: 15.22, provinces: 14.9, municipalities: 2.975, interest: 1.85, total: 34.945, kind: 'partial', as_of: '2026-10-21', partial_quarters: 2, bridge_year: 2024, interest_subnational: 0.15 },
];

describe('partial-year cuts', () => {
    it('derives the provincial cut from the quarters reported', () => {
        expect([1, 2, 3, 4].map(quarter => quarterEndIso(2026, quarter))).toEqual(['2026-03-31', '2026-06-30', '2026-09-30', '2026-12-31']);
    });

    it('labels Nación by as_of and provinces by quarter end', () => {
        expect(partialCuts('2026-10-21', 2)).toEqual({ nation: '21/10/2026', provinces: '30/06/2026' });
    });
});

describe('gasto público persistence', () => {
    it('turns the fetched chart rows into one raw row per year with its kind', () => {
        expect(toGastoRawRows([{ ...official, totalEstimate: 35.6 }, { ...estimate, totalPartial: 34 }, partial])).toEqual(raw);
    });

    it('rebuilds the chart rows (estimate and partial connectors) from stored rows', () => {
        expect(publicSpendingChartRows(normalizeGasto(raw))).toMatchObject([
            { ...official, totalEstimate: 35.6 },
            { ...estimate, totalPartial: 34, totalAnnualized: 34 },
            partial,
        ]);
    });

    it('projects the partial year linearly: Nación by days to the cut, provinces and municipios by quarters, interest by its parts', () => {
        const row = publicSpendingChartRows(normalizeGasto(raw)).at(-1)!;
        const days = 365 / 294; // 21/10/2026 is day 294
        expect(row.nationAnnualized).toBeCloseTo(15.22 * days, 6);
        expect(row.provincesAnnualized).toBeCloseTo(29.8, 6);
        expect(row.municipalitiesAnnualized).toBeCloseTo(5.95, 6);
        expect(row.interestAnnualized).toBeCloseTo((1.85 - 0.15) * days + 0.3, 6);
        expect(row.totalAnnualized).toBeCloseTo(15.22 * days + 29.8 + 5.95 + (1.85 - 0.15) * days + 0.3, 6);
        expect(row.annualizedGap).toBeCloseTo(Number(row.totalAnnualized) - 34.945, 6);
    });

    it('does not project a stored partial row without its subnational interest', () => {
        const row = publicSpendingChartRows(normalizeGasto([{ ...raw[2], interest_subnational: null }])).at(-1)!;
        expect(row.totalAnnualized).toBeUndefined();
    });

    it('upserts the partial year in place and finalizes it when official data arrives', () => {
        const updated = { ...raw[2], nation: 15.4, total: 35.1, as_of: '2026-12-15', partial_quarters: 3 };
        const first = mergeRawSeries(raw, [updated]);
        expect(first.upserts).toEqual([{ fecha: '2026-01-01', nation: 15.4, total: 35.1, as_of: '2026-12-15', partial_quarters: 3 }]);
        expect(first.merged.filter(row => row.fecha === '2026-01-01')).toHaveLength(1);

        const final = mergeRawSeries(first.merged, [{ ...updated, kind: 'official', as_of: null, partial_quarters: null, bridge_year: null }]);
        expect(final.upserts).toEqual([{ fecha: '2026-01-01', kind: 'official' }]);
        expect(publicSpendingChartRows(normalizeGasto(final.merged)).at(-1)).toMatchObject({ fecha: '2026', nation: 15.4, total: 35.1, preliminary: false });
    });
});
