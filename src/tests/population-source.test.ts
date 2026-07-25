import { describe, expect, it } from 'vitest';
import { buildMonthlyPopulationSeries, parseWorldBankPopulation } from '../lib/population-source';

describe('buildMonthlyPopulationSeries', () => {
    it('interpolates quarterly population and extrapolates the latest trend', () => {
        const population = buildMonthlyPopulationSeries([
            ['2025-01-01', 40_000_000],
            ['2025-04-01', 40_300_000],
        ], ['2025-02-01', '2025-04-01', '2025-05-01']);

        expect(population.get('2025-02-01')).toBe(40_100_000);
        expect(population.get('2025-04-01')).toBe(40_300_000);
        expect(population.get('2025-05-01')).toBe(40_400_000);
    });

    it('parses World Bank annual population at midyear', () => {
        expect(parseWorldBankPopulation([{}, [
            { date: '2004', value: 38_815_916 },
            { date: '2003', value: 38_424_282 },
        ]])).toEqual([
            ['2003-07-01', 38_424_282],
            ['2004-07-01', 38_815_916],
        ]);
    });
});
