import { describe, expect, it } from 'vitest';
import { parseWorldBankGdpUsdMillions } from '../lib/pbi-usd-source';

describe('parseWorldBankGdpUsdMillions', () => {
    it('keeps annual GDP from 1992 in millions of USD', () => {
        const values = parseWorldBankGdpUsdMillions([
            { page: 1 },
            [
                { date: '1991', value: 189_719_984_268 },
                { date: '1992', value: 228_778_917_308.17 },
                { date: '2004', value: 164_657_930_452.787 },
                { date: '2025', value: null },
            ],
        ]);

        expect([...values.entries()]).toEqual([
            ['1992-01-01', 228778.91730817],
            ['2004-01-01', 164657.930452787],
        ]);
    });
});
