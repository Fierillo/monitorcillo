import { describe, expect, it } from 'vitest';
import { buildMorosidadRawRows } from '../lib/sync/morosidad';

describe('buildMorosidadRawRows', () => {
    it('groups historical BCRA situations as shares of total financing', () => {
        const rows = buildMorosidadRawRows([
            ['2020-09-01', 2, 1, 1, 1, 1, 3, 1],
        ], []);

        expect(rows[0]).toMatchObject({
            fecha: '2020-09-01',
            mora_irregular_pct: 6,
            mora_incobrable_pct: 4,
        });
    });

    it('updates the current ratio with bank reports without extending it before October 2020', () => {
        const rows = buildMorosidadRawRows([], [
            ['2020-09-01', 4],
            ['2020-10-01', 5],
        ], [
            { fecha: '2020-09-01', mora_irregular_total_pct: 4.5 },
            { fecha: '2010-01-01', mora_irregular_total_pct: 3.5, mora_familias_pct: 4.7, mora_empresas_pct: 2.5 },
            { fecha: '2020-10-01', mora_irregular_total_pct: 5.1 },
            { fecha: '2026-06-01', mora_irregular_total_pct: 7.6306476839 },
        ]);

        expect(rows).toEqual([
            { fecha: '2010-01-01', mora_familias_pct: 4.7, mora_empresas_pct: 2.5 },
            { fecha: '2020-10-01', mora_irregular_total_pct: 5.1 },
            { fecha: '2026-06-01', mora_irregular_total_pct: 7.6306476839 },
        ]);
    });
});
