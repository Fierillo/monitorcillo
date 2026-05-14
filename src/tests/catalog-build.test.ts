import { describe, expect, it } from 'vitest';
import { buildIndicatorsCatalog } from '../lib/catalog';
import { baseCatalogRow } from './catalog-test-utils';

const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];

function addMonthsFromDate(date: string, months: number): string {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + months);
    return d.toISOString().split('T')[0];
}

function addDaysFromDate(date: string, days: number): string {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
}

function futureDate(baseDate: string, step: (date: string) => string): string {
    const today = new Date().toISOString().split('T')[0];
    let date = step(baseDate);
    while (date <= today) date = step(date);
    return date;
}

function formatDay(date: string): string {
    const d = new Date(`${date}T12:00:00Z`);
    return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}

describe('buildIndicatorsCatalog', () => {
    it('uses the exact latest raw BMA date and clarifies PBI percentage values', () => {
        const result = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'bma' }], {
            bma: [{ iso_fecha: '2026-04-01', BMAmplia: 6.7 }, { iso_fecha: '2026-05-01', BMAmplia: null }],
        }, {
            bma: [
                { fecha: '2026-04-01', pbi_trimestral: 100, emae_desestacionalizado: 1, ipc_nucleo: 1 },
                { fecha: '2026-04-22', base_monetaria: 10, pases: 2 },
                { fecha: '2026-04-23', depositos_tesoro: 4 },
                { fecha: '2026-04-24', pbi_trimestral: 100, emae_desestacionalizado: 1, ipc_nucleo: 1 },
                { fecha: '2026-05-01', pbi_trimestral: 100, emae_desestacionalizado: 1, ipc_nucleo: 1 },
                { fecha: '2026-05-02', base_monetaria: 12 },
            ],
        });

        expect(result[0].fecha).toBe('2 MAY 26');
        expect(result[0].dato).toBe('6,7% del PBI real');
        expect(result[0].proxima_fecha).toBe(formatDay(futureDate('2026-04-23', date => addDaysFromDate(date, 7))));
    });

    it('shows the latest recaudacion period without an artificial day', () => {
        const result = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'recaudacion', referencia: 'Referencia vieja' }], {
            reca: [{ iso_fecha: '2025-04-01', pctPbi: 3.7 }, { iso_fecha: '2026-03-01', pctPbi: null }, { iso_fecha: '2026-04-01', pctPbi: 4.2 }],
        }, {
            reca: [{ fecha: '2026-04-01', recaudacion_total: 100, pbi_trimestral: 200 }, { fecha: '2026-05-02', recaudacion_total: 120 }],
        });

        expect(result[0]).toMatchObject({
            fecha: 'MAY 26',
            dato: '4,2% del PBI real',
            referencia: '3,7% del PBI real',
            reference_description: 'Mismo mes año anterior',
            trend: 'up',
            proxima_fecha: formatDay(futureDate('2026-05-02', date => addMonthsFromDate(date, 1))),
        });
    });

    it('shows month labels for monthly indicators', () => {
        const emae = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'emae' }], {
            emae: [{ iso_fecha: '2026-05-01', emae_desestacionalizado: 108.2 }],
        }, { emae: [{ fecha: '2026-05-01', emae_desestacionalizado: 108.2 }] });
        const poder = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'poder-adquisitivo' }], {
            poder: [{ iso_fecha: '2026-04-01', blanco: 90.1 }, { iso_fecha: '2026-05-01', blanco: 88.8 }],
        }, { poder: [{ fecha: '2026-05-01', salario_registrado: 100 }] });

        expect(emae[0]).toMatchObject({ fecha: 'MAY 26', dato: '108,2', proxima_fecha: formatDay(futureDate('2026-05-01', date => addMonthsFromDate(date, 1))) });
        expect(poder[0]).toMatchObject({ fecha: 'MAY 26', dato: 'PA blanco: 88,8', referencia: 'PA blanco: 90,1', trend: 'down', proxima_fecha: formatDay(futureDate('2026-05-01', date => addMonthsFromDate(date, 1))) });
    });

    it('keeps day labels for daily emission data', () => {
        const result = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'emision' }], {
            emision: [{ iso_fecha: '2026-05-01', ACUMULADO: 100 }],
        }, { emision: [{ fecha: '2026-05-02', bcra: 12 }] });

        expect(result[0].fecha).toBe('2 MAY 26');
        expect(result[0].dato).toBe('$100M');
        expect(result[0].proxima_fecha).toBeUndefined();
    });

    it('derives debt catalog values from total PBI share', () => {
        const result = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'deuda' }], {
            deuda: [{ iso_fecha: '2023-01-01', total: 2.4 }, { iso_fecha: '2024-01-01', total: 1.9 }],
        }, { deuda: [{ fecha: '2024-01-01', vencimientos: 1 }] });

        expect(result[0]).toMatchObject({ dato: '1,9% del PBI real', referencia: '2,4% del PBI real', reference_description: 'Año anterior', trend: 'up', proxima_fecha: formatDay(futureDate('2024-01-01', date => addMonthsFromDate(date, 1))) });
    });

    it('derives poverty catalog values from the combined principal series', () => {
        const result = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'pobreza' }], {
            pobreza: [{ iso_fecha: '2025-03-01', pobreza_indec: 38.1 }, { iso_fecha: '2026-03-01', pobreza_utdt: 29 }],
        }, { pobreza: [{ fecha: '2026-01-01', pobreza_utdt: 29 }] });

        expect(result[0]).toMatchObject({ dato: '29,0%', referencia: '38,1%', reference_description: 'Mismo semestre año anterior', trend: 'up', proxima_fecha: formatDay(futureDate('2026-01-01', date => addMonthsFromDate(date, 1))) });
    });

    it('uses fallback columns for poverty when principal value is null', () => {
        const result = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'pobreza' }], {
            pobreza: [
                { iso_fecha: '2025-03-01', pobreza_indec: 38.1 },
                { iso_fecha: '2026-03-01', pobreza_indec: 29 },
            ],
        }, { pobreza: [{ fecha: '2026-01-01', pobreza_utdt: 29 }] });

        expect(result[0]).toMatchObject({ fecha: '1 MAR 26', dato: '29,0%', referencia: '38,1%', trend: 'up', proxima_fecha: formatDay(futureDate('2026-01-01', date => addMonthsFromDate(date, 1))) });
    });

    it('uses fallback columns for inflation when principal value is null', () => {
        const result = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'inflacion' }], {
            inflacion: [
                { iso_fecha: '2025-03-01', ipc: 5.2 },
                { iso_fecha: '2026-02-01', ipc: 5.5 },
                { iso_fecha: '2026-03-01', ipc: null, ipc_equilibra: 6.1 },
            ],
        }, { inflacion: [{ fecha: '2026-03-01', ipc_equilibra: 6.1 }] });

        expect(result[0]).toMatchObject({ fecha: '1 MAR 26', dato: '6,1%', referencia: '5,5%', trend: 'down', proxima_fecha: formatDay(futureDate('2026-03-01', date => addMonthsFromDate(date, 1))) });
    });
});
