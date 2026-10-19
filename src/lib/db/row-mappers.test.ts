import { describe, expect, it } from 'vitest';
import type { DbRow, IndicatorType } from '@/types';
import { BALANZA_SERIES_KEYS } from '../balanza/schema';
import { NORMALIZED_COLUMNS, toCatalogTrend, toNormalizedRow, valuesForNormalizedRow } from './row-mappers';

const TYPES = Object.keys(NORMALIZED_COLUMNS) as IndicatorType[];

function roundTrip(type: IndicatorType, dbRow: DbRow) {
    const normalized = toNormalizedRow(type, dbRow);
    const values = valuesForNormalizedRow(type, normalized);

    expect(values, type).not.toBeNull();
    expect(values, type).toHaveLength(NORMALIZED_COLUMNS[type].length);

    const stored = Object.fromEntries(NORMALIZED_COLUMNS[type].map((column, index) => [column, values![index]]));
    expect(toNormalizedRow(type, stored)).toEqual(normalized);
}

describe('normalized row mapping', () => {
    it('splits emission into the signed series the chart draws', () => {
        expect(toNormalizedRow('emision', {
            fecha: '2026-03-02',
            bcra: -10,
            tc: '1000',
            compra_dolares: 2,
            vencimientos: 3,
            licitado: 8,
            licitaciones: 5,
            resultado_fiscal: -4,
            total: -9,
            acumulado: 20,
        })).toMatchObject({
            fecha: '2 MAR 26',
            iso_fecha: '2026-03-02',
            BCRA: -10,
            BCRA_POS: null,
            BCRA_NEG: -10,
            TC: 1000,
            Licitaciones: 5,
            Licitaciones_POS: 5,
            Licitaciones_NEG: null,
            'Resultado fiscal': -4,
            ResultadoFiscal_POS: null,
            ResultadoFiscal_NEG: -4,
        });
    });

    it('draws imports below zero once, even when the database already stored them negative', () => {
        expect(toNormalizedRow('balanza', {
            fecha: '2026-01-01',
            exportaciones: 100,
            importaciones: 40,
            saldo: 60,
            impo_vehiculos: -7,
        })).toMatchObject({
            fecha: 'ENE 26',
            exportaciones: 100,
            importaciones: -40,
            saldo: 60,
            impo_vehiculos: -7,
        });
    });

    it('keeps a zero SIPA headcount and a provisional flag', () => {
        expect(toNormalizedRow('sipa', {
            fecha: '2026-04-01',
            total: 0,
            privado: 10,
            provisional: 1,
        })).toMatchObject({
            iso_fecha: '2026-04-01',
            total: 0,
            privado: 10,
            provisional: true,
        });
    });

    it('labels a UTC database date without moving it to the previous month', () => {
        expect(toNormalizedRow('pobreza', {
            fecha: new Date('2026-06-15T00:00:00Z'),
            pobreza_indec: 30.2,
        })).toMatchObject({ fecha: 'JUN 26', iso_fecha: '2026-06-15', pobreza_indec: 30.2 });
    });

    it('refuses to persist a row whose date is not a day', () => {
        expect(valuesForNormalizedRow('inflacion', { fecha: 'MAR 26', iso_fecha: 'MAR 26', ipc: 2 })).toBeNull();
    });

    it('round-trips every indicator without dropping or duplicating columns', () => {
        roundTrip('emision', {
            fecha: '2026-03-02', bcra: 10, tc: 1000, compra_dolares: 2, vencimientos: 3, licitado: 8, licitaciones: -5, resultado_fiscal: -4, total: 1, acumulado: 20,
        });
        roundTrip('emae', { fecha: '2026-03-01', emae: 101, emae_desestacionalizado: 99.5, emae_tendencia: 100, emae_per_capita: 1.2, agro_mm12: -3 });
        roundTrip('bma', { fecha: '2026-03-01', base_monetaria: 1, pasivos_remunerados: 2, depositos_tesoro: 3, bma_amplia: 6, base_monetaria_millones: 10 });
        roundTrip('depositos-prestamos', { fecha: '2026-03-01', prestamos_total_pbi: 8.5, mora_pnfc_fintech_pct: 12 });
        roundTrip('reca', { fecha: '2026-03-01', mes: 'MAR', year: 2026, pct_pbi: 4.2, pct_pbi_mm12: 4, iva_pct_pbi: 1.1 });
        roundTrip('poder', { fecha: '2026-03-01', blanco: 88.8, negro: 70, privado: 90, publico: 80, ripte: 95, jubilacion: 60 });
        roundTrip('deuda', { fecha: '2026-03-01', total: 70, vencimientos: 2, vencimientos_proyectados: 3, pagos: 1, deuda_pbi: 50, acumulado: 4 });
        roundTrip('pobreza', { fecha: '2026-03-01', pobreza_indec: 28, pobreza_utdt: 31.5, pobreza_uca: 40 });
        roundTrip('inflacion', { fecha: '2026-03-01', ipc_indec: 2.1, ipc_nucleo_indec: 1.8, ipc_equilibra: null, ipc_online: 2.4, rem: 2, ipim: 1.2, ipc: 2.1 });
        roundTrip('icg', { fecha: '2026-03-01', icg: 2.45 });
        roundTrip('balanza', { fecha: '2026-03-01', ...Object.fromEntries(BALANZA_SERIES_KEYS.map(key => [key, key.startsWith('impo') || key === 'importaciones' ? 5 : 8])), pbi: 1, tc: 1000, ipc_nucleo: 2, pbi_usd: 500 });
        roundTrip('sipa', { fecha: '2026-03-01', total: 12000, privado: 6000, provisional: false });

        expect(TYPES).toHaveLength(12);
    });

    it('falls back to a neutral trend for an unknown catalog value', () => {
        expect(toCatalogTrend('up')).toBe('up');
        expect(toCatalogTrend('sideways')).toBe('neutral');
        expect(toCatalogTrend(null)).toBe('neutral');
    });
});
