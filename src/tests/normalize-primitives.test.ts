import { describe, expect, it } from 'vitest';
import { addMonths, monthNumber, parsePeriod } from '@/lib/normalize/dates';
import { parseNumber } from '@/lib/normalize/numbers';

describe('parseNumber es-AR', () => {
    it('reads decimal commas and thousands dots, and returns null for blanks and non-numbers', () => {
        expect(parseNumber('16580,3281440822', 'es-AR')).toBe(16580.3281440822);
        expect(parseNumber('1.234.567,5', 'es-AR')).toBe(1234567.5);
        expect(parseNumber(' 100 ', 'es-AR')).toBe(100);
        for (const blank of [null, undefined, '', ' ', 'NA', '-']) expect(parseNumber(blank, 'es-AR')).toBeNull();
    });
});

describe('parseNumber en', () => {
    it('reads decimal points and thousands commas, and returns null for blanks and non-numbers', () => {
        expect(parseNumber('97.88152715279357', 'en')).toBe(97.88152715279357);
        expect(parseNumber('1,234,567.5', 'en')).toBe(1234567.5);
        expect(parseNumber('(1,284)', 'en')).toBe(-1284);
        expect(parseNumber(' (27.5) ', 'en')).toBe(-27.5);
        for (const blank of [null, '', 'NA', 'invalid']) expect(parseNumber(blank, 'en')).toBeNull();
    });
});

describe('parsePeriod', () => {
    it('reads ISO dates as the first day of their month and rejects anything else', () => {
        expect(parsePeriod('2026-09-01', 'iso')).toBe('2026-09-01');
        expect(parsePeriod(' 2026-09-15 ', 'iso')).toBe('2026-09-01');
        for (const invalid of [null, '', '202609', '2026-13-01', '01/09/2026', 'periodo']) expect(parsePeriod(invalid, 'iso')).toBeNull();
    });

    it('reads INDEC yyyymm periods', () => {
        expect(parsePeriod('202609', 'yyyymm')).toBe('2026-09-01');
        for (const invalid of ['202613', '2026-09-01', '20269']) expect(parsePeriod(invalid, 'yyyymm')).toBeNull();
    });

    it('reads day/month/year periods as their month', () => {
        expect(parsePeriod('1/10/2015', 'd/m/yyyy')).toBe('2015-10-01');
        expect(parsePeriod('01/03/2026', 'd/m/yyyy')).toBe('2026-03-01');
        for (const invalid of ['1/13/2026', '2026-03-01', '1/3/26']) expect(parsePeriod(invalid, 'd/m/yyyy')).toBeNull();
    });

    it('reads SheetJS month/day/year dates as their month', () => {
        expect(parsePeriod('3/31/22', 'm/d/yy')).toBe('2022-03-01');
        expect(parsePeriod('12/1/2019', 'm/d/yy')).toBe('2019-12-01');
        for (const invalid of ['31/03/2022', '2022-03-31']) expect(parsePeriod(invalid, 'm/d/yy')).toBeNull();
    });

    it('reads month-name periods with two-digit years pivoting at 80, or four-digit years', () => {
        expect(parsePeriod('Jan-24', 'mmm-yy')).toBe('2024-01-01');
        expect(parsePeriod('ene-95', 'mmm-yy')).toBe('1995-01-01');
        expect(parsePeriod('Dec-2025', 'mmm-yy')).toBe('2025-12-01');
        expect(parsePeriod('Jan-24*', 'mmm-yy')).toBe('2024-01-01');
        expect(parsePeriod('jul-25 (*)', 'mmm-yy')).toBe('2025-07-01');
        for (const invalid of ['Foo-24', 'Dec. 12/2020', '2024-01', 'Jan 24']) expect(parsePeriod(invalid, 'mmm-yy')).toBeNull();
    });
});

describe('monthNumber', () => {
    it('reads Spanish and English month names and abbreviations, ignoring case, accents and marks', () => {
        expect(monthNumber('Enero')).toBe(1);
        expect(monthNumber('setiembre')).toBe(9);
        expect(monthNumber('Septiembre*')).toBe(9);
        expect(monthNumber('ago')).toBe(8);
        expect(monthNumber('Aug')).toBe(8);
        expect(monthNumber('DIC')).toBe(12);
        expect(monthNumber('Septiembree')).toBe(9);
        expect(monthNumber('Marzo(1)')).toBe(3);
        for (const invalid of [null, '', 'mayorista', 'total', '2026']) expect(monthNumber(invalid)).toBeNull();
    });
});

describe('addMonths', () => {
    it('moves a month start across years in both directions', () => {
        expect(addMonths('2026-11-01', 2)).toBe('2027-01-01');
        expect(addMonths('2026-03-01', -5)).toBe('2025-10-01');
    });
});
