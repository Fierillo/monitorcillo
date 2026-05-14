import { describe, expect, it } from 'vitest';
import { normalizeInflacion } from '../lib/normalize/inflacion';

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

    it('passes through equilibra and online values directly', () => {
        const raw = [
            { fecha: '2026-02-01', ipc_equilibra: 2.5, ipc_online: 2.3 },
        ];
        const normalized = normalizeInflacion(raw);
        expect(normalized).toHaveLength(1);
        expect(normalized[0].ipc_equilibra).toBe(2.5);
        expect(normalized[0].ipc_online).toBe(2.3);
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

    it('falls back to equilibra then online for principal ipc', () => {
        const raw = [
            { fecha: '2026-02-01', ipc_online: 1.8 },
        ];
        const normalized = normalizeInflacion(raw);
        expect(normalized[0].ipc).toBe(1.8);
    });

    it('returns empty array for empty input', () => {
        expect(normalizeInflacion([])).toEqual([]);
    });
});
