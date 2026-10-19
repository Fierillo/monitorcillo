import { describe, expect, it } from 'vitest';
import type { DataRow, IndicatorType } from '@/types';
import { buildIndicatorsCatalog } from './builder';
import { DEFAULT_CATALOG } from './defaults';
import { CATALOG_INDICATOR_SPECS } from './specs';

const STATIC_CATALOG_IDS = ['inversiones', 'gasto-publico', 'presupuesto-nacional'] as const;
const INDICATOR_TYPES = new Set<IndicatorType>([
    'emision', 'emae', 'bma', 'depositos-prestamos', 'reca', 'poder', 'deuda', 'pobreza', 'inflacion', 'icg', 'balanza', 'sipa',
]);

const UNIT_BY_ID: Record<string, RegExp> = {
    bma: /% del PBI real$/,
    'depositos-prestamos': /^Préstamos: .+% del PBI real$/,
    emision: /^\$[\d.]+M$/,
    recaudacion: /% del PBI real$/,
    'poder-adquisitivo': /^PA blanco: /,
    emae: /^[\d.]+,[\d]+$/,
    deuda: /% del PBI real$/,
    pobreza: /%$/,
    inflacion: /%$/,
    icg: / puntos$/,
    sipa: / millones$/,
    'balanza-comercial': /^USD [\d.]+ M$/,
};

function observation(date: string, value: number): DataRow {
    return {
        iso_fecha: date,
        fecha: date,
        BMAmplia: value,
        prestamosTotalPbi: value,
        ACUMULADO: value,
        pctPbi: value,
        blanco: value,
        emae_desestacionalizado: value,
        total: value,
        pobreza_utdt: value,
        pobreza_indec: value,
        ipc: value,
        icg: value,
        saldo: value,
    };
}

describe('indicator catalog invariants', () => {
    it('gives every synced indicator a spec, a Spanish label, a unit and a source', () => {
        const ids = DEFAULT_CATALOG.map(row => row.id);

        expect(new Set(ids).size).toBe(ids.length);
        expect(Object.keys(CATALOG_INDICATOR_SPECS).sort()).toEqual(
            ids.filter(id => !STATIC_CATALOG_IDS.includes(id as typeof STATIC_CATALOG_IDS[number])).sort(),
        );

        for (const row of DEFAULT_CATALOG) {
            expect(row.indicador.trim(), row.id).not.toBe('');
            expect(row.fuente.trim(), row.id).not.toBe('');
            expect(row.referencia.trim(), row.id).not.toBe('');

            const spec = CATALOG_INDICATOR_SPECS[row.id];
            if (STATIC_CATALOG_IDS.includes(row.id as typeof STATIC_CATALOG_IDS[number])) {
                expect(spec, row.id).toBeUndefined();
                continue;
            }

            expect(INDICATOR_TYPES.has(spec.type), row.id).toBe(true);
            expect(spec.referenceLabel, row.id).toBe(row.referencia);
            expect(['higher', 'lower']).toContain(spec.betterWhen);
            expect(spec.formatValue(1234.5), row.id).toMatch(UNIT_BY_ID[row.id]);
            expect(spec.formatValue(1234.5), row.id).not.toMatch(/NaN|undefined/);

            const valueDate = '2026-03-02';
            const referenceDate = spec.getReferenceDate(valueDate);
            expect(referenceDate < valueDate, `${row.id} reference ${referenceDate}`).toBe(true);
            expect(spec.getNextExpectedDate(valueDate) > valueDate, row.id).toBe(true);

            const rawFields = Object.fromEntries(spec.rawDateFields.map(field => [field, 1]));
            const events = spec.getNextExpectedEvents?.({
                valueRow: observation(valueDate, 12.5),
                referenceDate,
                rawDate: valueDate,
                publicationDate: null,
                sourcePublicationDates: { 'icg-next': '2026-04-02' },
                normalizedRows: [],
                rawRows: [{ fecha: valueDate, ...rawFields }],
                today: '2026-03-02',
            }) ?? [];
            expect(events.every(event => /^\d{4}-\d{2}-\d{2}$/.test(event.date)), row.id).toBe(true);
        }
    });

    it('points the trend the way each indicator says is better', () => {
        for (const row of DEFAULT_CATALOG) {
            const spec = CATALOG_INDICATOR_SPECS[row.id];
            if (!spec) continue;

            const valueDate = '2026-03-02';
            const referenceDate = spec.getReferenceDate(valueDate);
            const catalog = buildIndicatorsCatalog([row], {
                [spec.type]: [observation(referenceDate, 10), observation(valueDate, 12.5)],
            }, {
                [spec.type]: [{ fecha: valueDate, ...Object.fromEntries(spec.rawDateFields.map(field => [field, 1])) }],
            });

            expect(catalog[0].dato, row.id).not.toBe('-');
            expect(catalog[0].dato, row.id).not.toMatch(/NaN|undefined/);
            expect(catalog[0].trend, row.id).toBe(spec.betterWhen === 'higher' ? 'up' : 'down');
            expect(catalog).toHaveLength(1);
        }
    });
});
