import { describe, expect, it } from 'vitest';
import { fechaToISO, fechaToTimestamp } from './dates';

describe('Spanish date parsing', () => {
    it('turns a chart label back into the same UTC day', () => {
        expect(fechaToISO('1 ENE 26')).toBe('2026-01-01');
        expect(fechaToISO('25 FEB 2026')).toBe('2026-02-25');
        expect(fechaToTimestamp('1 ENE 26')).toBe(Date.UTC(2026, 0, 1));
    });

    it('accepts both SEP and SEPT for September', () => {
        expect(fechaToISO('1 SEP 26')).toBe('2026-09-01');
        expect(fechaToISO('1 SEPT 26')).toBe('2026-09-01');
        expect(fechaToTimestamp('SEP 26')).toBe(fechaToTimestamp('SEPT 26'));
    });

    it('reads a month label and a year label as the first day of that period', () => {
        expect(fechaToTimestamp('ENE 26')).toBe(Date.UTC(2026, 0, 1));
        expect(fechaToTimestamp('ENE-26')).toBe(Date.UTC(2026, 0, 1));
        expect(fechaToTimestamp('2024')).toBe(Date.UTC(2024, 0, 1));
    });

    it('returns an empty date instead of a shifted one when the label is incomplete', () => {
        expect(fechaToISO('ENE 26')).toBe('');
        expect(fechaToISO('26')).toBe('');
        expect(fechaToTimestamp('no es una fecha')).toBe(0);
    });
});
