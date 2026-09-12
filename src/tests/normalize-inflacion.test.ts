import { describe, expect, it } from 'vitest';
import { keepRemAfterLastIndec, normalizeInflacion, toYearOverYearInflacion } from '../lib/normalize/inflacion';

describe('normalizeInflacion', () => {
    it('calculates monthly percentage change from INDEC indices', () => {
        const raw = [
            { fecha: '2026-01-01', ipc_indec_general: 100, ipc_indec_nucleo: 100 },
            { fecha: '2026-02-01', ipc_indec_general: 102, ipc_indec_nucleo: 101 },
            { fecha: '2026-03-01', ipc_indec_general: 104, ipc_indec_nucleo: 103 },
        ];
        const normalized = normalizeInflacion(raw);
        expect(normalized).toHaveLength(3);
        expect(normalized[0].ipc_indec).toBeNull();
        expect(normalized[0].ipc_nucleo_indec).toBeNull();
        expect(normalized[1].ipc_indec).toBeCloseTo(2, 2);
        expect(normalized[1].ipc_nucleo_indec).toBeCloseTo(1, 2);
        expect(normalized[2].ipc_indec).toBeCloseTo(1.96, 2);
        expect(normalized[2].ipc_nucleo_indec).toBeCloseTo(1.98, 2);
    });

    it('passes through equilibra and rem values directly', () => {
        const raw = [
            { fecha: '2026-02-01', ipc_equilibra: 2.5, rem: 2.3 },
        ];
        const normalized = normalizeInflacion(raw);
        expect(normalized).toHaveLength(1);
        expect(normalized[0].ipc_equilibra).toBe(2.5);
        expect(normalized[0].rem).toBe(2.3);
        expect(normalized[0].ipc).toBe(2.5);
    });

    it('uses INDEC general as principal ipc when available', () => {
        const raw = [
            { fecha: '2026-01-01', ipc_indec_general: 100 },
            { fecha: '2026-02-01', ipc_indec_general: 103, ipc_equilibra: 2.5 },
        ];
        const normalized = normalizeInflacion(raw);
        expect(normalized[1].ipc).toBeCloseTo(3, 2);
    });

    it('keeps using existing normalized INDEC columns for completed official indices', () => {
        const raw = [
            { fecha: '2026-03-01', ipc_indec_general: 100, ipc_indec_nucleo: 100 },
            { fecha: '2026-04-01', ipc_indec_general: 102.6, ipc_indec_nucleo: 102.3, ipc_equilibra: 2.4 },
        ];
        const normalized = normalizeInflacion(raw);
        expect(normalized[1].ipc_indec).toBe(2.6);
        expect(normalized[1].ipc_nucleo_indec).toBe(2.3);
        expect(normalized[1].ipc).toBe(2.6);
    });

    it('falls back to equilibra then rem for principal ipc', () => {
        const raw = [
            { fecha: '2026-02-01', rem: 1.8 },
        ];
        const normalized = normalizeInflacion(raw);
        expect(normalized[0].ipc).toBe(1.8);
    });

    it('returns empty array for empty input', () => {
        expect(normalizeInflacion([])).toEqual([]);
    });
});

describe('toYearOverYearInflacion', () => {
    it('compounds twelve consecutive monthly rates', () => {
        const rows = Array.from({ length: 13 }, (_, index) => ({
            iso_fecha: new Date(Date.UTC(2025, index, 1)).toISOString().split('T')[0],
            ipc_indec: 2,
        }));
        const yearOverYear = toYearOverYearInflacion(rows);
        expect(yearOverYear[10].ipc_indec).toBeNull();
        expect(yearOverYear[11].ipc_indec).toBeCloseTo(26.82, 2);
        expect(yearOverYear[12].ipc_indec).toBeCloseTo(26.82, 2);
    });

    it('returns null when a month in the window is missing', () => {
        const rows = Array.from({ length: 13 }, (_, index) => ({
            iso_fecha: new Date(Date.UTC(2025, index, 1)).toISOString().split('T')[0],
            ipc_indec: 2,
        })).filter(row => row.iso_fecha !== '2025-02-01');
        const yearOverYear = toYearOverYearInflacion(rows);
        expect(yearOverYear.at(-1)?.ipc_indec).toBeNull();
    });
});

describe('keepRemAfterLastIndec', () => {
    it('keeps REM from the last INDEC month onward', () => {
        const rows = [
            { iso_fecha: '2026-07-01', ipc_indec: 2.1, rem: 2 },
            { iso_fecha: '2026-08-01', ipc_indec: 1.7, rem: 1.8 },
            { iso_fecha: '2026-09-01', ipc_indec: null, rem: 1.87 },
            { iso_fecha: '2026-10-01', ipc_indec: null, rem: 1.8 },
        ];
        expect(keepRemAfterLastIndec(rows)).toEqual([
            { iso_fecha: '2026-07-01', ipc_indec: 2.1, rem: null },
            { iso_fecha: '2026-08-01', ipc_indec: 1.7, rem: 1.8 },
            { iso_fecha: '2026-09-01', ipc_indec: null, rem: 1.87 },
            { iso_fecha: '2026-10-01', ipc_indec: null, rem: 1.8 },
        ]);
    });
});
