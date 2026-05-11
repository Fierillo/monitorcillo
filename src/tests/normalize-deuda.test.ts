import { describe, expect, it } from 'vitest';
import { normalizeDeuda } from '../lib/normalize';

describe('normalizeDeuda', () => {
    it('converts commitments and paid debt to Jan-2017 real PBI percentages', () => {
        const result = normalizeDeuda([
            { fecha: '2017-01-01', ipc_nucleo: 100, pbi_trimestral: 1000, vencimientos: 0 },
            { fecha: '2024-01-01', ipc_nucleo: 200, pbi_trimestral: 1000, tc: 2, toma_deuda: 200, toma_deuda_usd: 100, vencimientos: 100, pagos: 40 },
        ]);

expect(result.at(-1)).toMatchObject({
            fecha: 'ENE 24',
            iso_fecha: '2024-01-01',
            toma_deuda: 20,
            vencimientos: -10,
            pagos: -4,
            acumulado: 16,
            total: 16,
        });
    });

    it('reduces accumulated debt with scheduled maturities when payments are unavailable', () => {
        const result = normalizeDeuda([
            { fecha: '2017-01-01', ipc_nucleo: 100, pbi_trimestral: 1000, vencimientos: 0 },
            { fecha: '2024-01-01', ipc_nucleo: 100, pbi_trimestral: 1000, vencimientos: 100, tc: 1 },
            { fecha: '2024-02-01', ipc_nucleo: 100, pbi_trimestral: 1000, toma_deuda: 200 },
        ]);

        expect(result[0]).toMatchObject({ vencimientos: -10, total: -10, acumulado: -10 });
        expect(result[1]).toMatchObject({ toma_deuda: 20, total: 20, acumulado: 10 });
    });

    it('calculates observed and projected debt to real PBI ratio', () => {
        const result = normalizeDeuda([
            { fecha: '2017-01-01', ipc_nucleo: 100, pbi_trimestral: 1000, stock_deuda_usd: 500, tc: 2 },
            { fecha: '2017-02-01', ipc_nucleo: 100, pbi_trimestral: 1000, toma_deuda: 100 },
            { fecha: '2017-03-01', ipc_nucleo: 100, pbi_trimestral: 1000, vencimientos_proyectados: 50, tc: 2 },
        ]);

        expect(result[0]).toMatchObject({ deuda_pbi: 100, deuda_proyectada: null });
        expect(result[1]).toMatchObject({ deuda_pbi: null, deuda_proyectada: 110 });
        expect(result[2]).toMatchObject({ deuda_pbi: null, deuda_proyectada: 100 });
    });
});
