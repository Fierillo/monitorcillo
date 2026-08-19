import { describe, expect, it } from 'vitest';
import { PUBLIC_SPENDING_CHART_DATA } from '../lib/public-spending-source';

describe('public spending estimated series', () => {
    it('covers every year from 1981 through 2025', () => {
        expect(PUBLIC_SPENDING_CHART_DATA).toHaveLength(45);
        expect(PUBLIC_SPENDING_CHART_DATA[0]).toMatchObject({ fecha: '1981', iso_fecha: '1981-01-01' });
        expect(PUBLIC_SPENDING_CHART_DATA.at(-1)).toMatchObject({ fecha: '2025', iso_fecha: '2025-01-01' });
    });

    it('preserves the highlighted 2016 and 2025 values', () => {
        expect(PUBLIC_SPENDING_CHART_DATA.find(row => row.fecha === '2016')).toMatchObject({ nation: 24, provinces: 16, municipalities: 3, interest: 6, total: 49 });
        expect(PUBLIC_SPENDING_CHART_DATA.find(row => row.fecha === '2025')).toMatchObject({ nation: 15, provinces: 15, municipalities: 3, interest: 1, total: 34 });
    });

    it('keeps the total equal to the stacked components', () => {
        for (const row of PUBLIC_SPENDING_CHART_DATA) {
            const componentTotal = Number(row.nation) + Number(row.provinces) + Number(row.municipalities) + Number(row.interest);
            expect(row.total).toBeCloseTo(componentTotal, 8);
        }
    });
});
