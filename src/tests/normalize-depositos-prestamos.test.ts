import { describe, expect, it } from 'vitest';
import { normalizeDepositosPrestamos } from '../lib/normalize';

describe('normalizeDepositosPrestamos', () => {
    it('converts USD stocks and expresses both currencies in constant pesos and PBI shares', () => {
        const result = normalizeDepositosPrestamos([
            {
                fecha: '2017-01-01',
                ipc_nucleo: 100,
            },
            {
                fecha: '2026-01-01',
                depositos_pesos: 100,
                depositos_usd: 10,
                prestamos_pesos: 80,
                prestamos_usd: 5,
                depositos_publicos_pesos: 40,
                depositos_publicos_usd: 2,
                prestamos_publicos_pesos: 20,
                prestamos_publicos_usd: 1,
                tc: 10,
                ipc_nucleo: 100,
                pbi_trimestral: 1000,
            },
            {
                fecha: '2026-02-01',
                depositos_pesos: 400,
                depositos_usd: 20,
                prestamos_pesos: 300,
                prestamos_usd: 10,
                depositos_publicos_pesos: 100,
                depositos_publicos_usd: 4,
                prestamos_publicos_pesos: 60,
                prestamos_publicos_usd: 2,
                tc: 20,
                ipc_nucleo: 200,
                pbi_trimestral: 2000,
            },
        ]);

        expect(result[2]).toMatchObject({
            depositosPesosConstantes: 200,
            depositosUsdConstantes: 200,
            prestamosPesosConstantes: 150,
            prestamosUsdConstantes: 100,
            depositosPesosPbi: 10,
            depositosUsdPbi: 10,
            depositosTotalPbi: 20,
            prestamosPesosPbi: 7.5,
            prestamosUsdPbi: 5,
            prestamosTotalPbi: 12.5,
            depositosPublicosPesosConstantes: 50,
            depositosPublicosUsdConstantes: 40,
            prestamosPublicosPesosConstantes: 30,
            prestamosPublicosUsdConstantes: 20,
            depositosPublicosPesosPbi: 2.5,
            depositosPublicosUsdPbi: 2,
            prestamosPublicosPesosPbi: 1.5,
            prestamosPublicosUsdPbi: 1,
        });
    });

    it('does not invent totals when a currency or macro input is missing', () => {
        const result = normalizeDepositosPrestamos([
            { fecha: '2026-01-01', depositos_pesos: 100, ipc_nucleo: 100, pbi_trimestral: 1000 },
        ]);

        expect(result[0]).toMatchObject({
            depositosPesosConstantes: 100,
            depositosUsdConstantes: null,
            depositosTotalPbi: null,
            prestamosTotalPbi: null,
        });
    });

    it('preserves historical, current and PNFC irregularity ratios', () => {
        const result = normalizeDepositosPrestamos([
            {
                fecha: '2020-09-01',
                mora_irregular_pct: 8,
                mora_incobrable_pct: 2,
            },
            {
                fecha: '2020-10-01',
                mora_irregular_total_pct: 5,
                mora_familias_pct: 8,
                mora_empresas_pct: 2,
                mora_pnfc_hasta_29_pct: 38.4,
            },
        ]);

        expect(result[0]).toMatchObject({
            moraIrregularPct: 8,
            moraIncobrablePct: 2,
            moraTotalIrregularPct: null,
        });
        expect(result[1]).toMatchObject({
            moraTotalIrregularPct: 5,
            moraFamiliasPct: 8,
            moraEmpresasPct: 2,
            moraPnfcHasta29Pct: 38.4,
        });
    });
});
