import { describe, expect, it } from 'vitest';
import { buildIndicatorCatalogItem, buildIndicatorsCatalog, CATALOG_INDICATOR_SPECS } from '../lib/catalog';
import { argentinaToday } from '../lib/normalize/dates';
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
    const today = argentinaToday();
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
        expect(emae[0].daily).toBe(false);
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

    it('derives debt catalog values from the latest observed gross debt stock, not from projections', () => {
        const result = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'deuda' }], {
            deuda: [{ iso_fecha: '2025-09-01', stock_usd: 454037 }, { iso_fecha: '2026-09-01', stock_usd: 486627.5 }, { iso_fecha: '2035-12-01', total: -0.2 }],
        }, { deuda: [{ fecha: '2026-09-01', stock_deuda_usd: 486627.5 }, { fecha: '2035-12-01', vencimientos: 1, vencimientos_proyectados: 1 }] });

        expect(result[0]).toMatchObject({ fecha: 'SEPT 26', dato: 'USD 486.628 M', referencia: 'USD 454.037 M', reference_description: 'Mismo mes año anterior', trend: 'down' });
    });

    it('dates an indicator by its non-daily series when it mixes them with daily ones', () => {
        const [item] = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'bma' }], { bma: [{ iso_fecha: '2026-10-01', BMAmplia: 4.8 }] }, {
            bma: [
                { fecha: '2026-10-08', depositos_tesoro: 3 },
                { fecha: '2026-10-15', depositos_tesoro: 4 },
                { fecha: '2026-10-16', base_monetaria: 10 },
                { fecha: '2026-10-17', base_monetaria: 11 },
                { fecha: '2026-10-19', base_monetaria: 12 },
            ],
        });
        expect(item.fecha).toBe('15 OCT 26');
        expect(item.daily, 'its daily series make it a daily indicator').toBe(true);
    });

    it('names the data type behind Fecha and Próxima, joining series that share the latest date', () => {
        const spec = CATALOG_INDICATOR_SPECS['poder-adquisitivo'];
        const valueRow = { iso_fecha: '2026-08-01', blanco: 73 };
        const ripteOnly = buildIndicatorCatalogItem({ ...baseCatalogRow, id: 'poder-adquisitivo' }, spec, valueRow, '2026-09-01', null, null, [], [
            { fecha: '2026-08-01', salario_registrado: 100, ripte: 90 },
            { fecha: '2026-09-01', ripte: 95 },
        ]);
        expect(ripteOnly.fecha_description).toBe('RIPTE');
        const shared = buildIndicatorCatalogItem({ ...baseCatalogRow, id: 'poder-adquisitivo' }, spec, valueRow, '2026-09-01', null, null, [], [
            { fecha: '2026-09-01', salario_registrado: 100, salario_privado: 101, ripte: 95 },
        ]);
        expect(shared.fecha_description).toBe('Índice de salarios y RIPTE');
        expect(['Índice de salarios', 'RIPTE', 'Jubilación mínima']).toContain(shared.proxima_fecha_description);
    });

    it('labels Fecha and Próxima with the same data type when every series shares the date', () => {
        const [item] = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'depositos-prestamos' }], {
            'depositos-prestamos': [{ iso_fecha: '2026-10-01', prestamosTotalPbi: 12 }],
        }, { 'depositos-prestamos': [{ fecha: '2026-10-01', depositos_pesos: 1, prestamos_pesos: 2 }] });
        expect(item.fecha_description).toBe(item.proxima_fecha_description);
    });

    it('keeps the publication day', () => {
        const spec = CATALOG_INDICATOR_SPECS.emae;
        const published = buildIndicatorCatalogItem({ ...baseCatalogRow, id: 'emae', fuente: 'INDEC' }, spec, { iso_fecha: '2026-08-01', emae_desestacionalizado: 102 }, '2026-08-01', '2026-10-21');
        expect(published).toMatchObject({ fecha: '21 OCT 26', published_at: '2026-10-21' });
        const unpublished = buildIndicatorCatalogItem({ ...baseCatalogRow, id: 'emae', fuente: 'INDEC' }, spec, { iso_fecha: '2026-08-01', emae_desestacionalizado: 102 }, '2026-08-01');
        expect(unpublished.published_at).toBeUndefined();
    });

    it('estimates the next debt bulletin one month after the last published one', () => {
        const [item] = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'deuda' }], { deuda: [{ iso_fecha: '2026-09-01', stock_usd: 1 }] }, { deuda: [{ fecha: '2026-09-01', stock_deuda_usd: 1 }] });
        expect(item.proxima_fecha).toBeUndefined();
        const next = buildIndicatorCatalogItem({ ...baseCatalogRow, id: 'deuda' }, CATALOG_INDICATOR_SPECS.deuda, { iso_fecha: '2026-09-01', stock_usd: 1 }, '2026-09-01', null, null, [], [], { 'deuda-boletin': '2026-10-15' });
        expect(next.proxima_fecha).toBe(formatDay(futureDate('2026-10-15', date => addMonthsFromDate(date, 1))));
        expect(next.proxima_fecha_description).toMatch(/estimad/i);
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

    it('shows the latest trade balance in millions of USD', () => {
        const result = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'balanza-comercial' }], {
            balanza: [{ iso_fecha: '2026-05-01', saldo: 412 }, { iso_fecha: '2026-06-01', saldo: 680.4 }],
        }, {
            balanza: [{ fecha: '2026-05-01', exportaciones: 6500, importaciones: 6088, saldo: 412 }, { fecha: '2026-06-01', exportaciones: 7100, importaciones: 6420, saldo: 680.4 }],
        });

        expect(result[0]).toMatchObject({
            fecha: 'JUN 26',
            dato: 'USD 680 M',
            referencia: 'USD 412 M',
            reference_description: 'Mes anterior',
            trend: 'up',
            proxima_fecha: formatDay(futureDate('2026-06-01', date => addMonthsFromDate(date, 1))),
        });
    });

    it('shows the latest SIPA total registered employment in millions of workers', () => {
        const result = buildIndicatorsCatalog([{ ...baseCatalogRow, id: 'sipa' }], {
            sipa: [
                { iso_fecha: '2026-05-01', total: 12800 },
                { iso_fecha: '2026-06-01', total: 12773.4 },
            ],
        }, {
            sipa: [{ fecha: '2026-06-01', total: 12773.4, privado: 6126.4 }],
        });

        expect(result[0]).toMatchObject({
            fecha: 'JUN 26',
            dato: '12,8 millones',
            referencia: '12,8 millones',
            reference_description: 'Mes anterior desest.',
            trend: 'down',
            proxima_fecha: formatDay(futureDate('2026-06-01', date => addMonthsFromDate(date, 1))),
        });
    });
});
