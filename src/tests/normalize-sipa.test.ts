import { describe, expect, it } from 'vitest';
import { normalizeSipa } from '../lib/normalize';

describe('normalizeSipa', () => {
    it('keeps modality breakdown in thousands and marks provisional months', () => {
        expect(normalizeSipa([
            {
                fecha: '2026-06-01',
                privado: 6126.4,
                publico: 3380,
                casas_particulares: 444.1,
                autonomos: 388.9,
                monotributo: 2206.8,
                monotributo_social: 227.3,
                total: 12773.4,
                provisional: true,
            },
            {
                fecha: 'invalid',
                total: 1,
                provisional: false,
            },
            {
                fecha: '2012-01-01',
                privado: 6068.2,
                publico: 2549.9,
                casas_particulares: 389.7,
                autonomos: 408.2,
                monotributo: 1314.7,
                monotributo_social: 167.8,
                total: 10898.5,
                provisional: false,
            },
        ])).toEqual([
            {
                fecha: 'ENE 12',
                iso_fecha: '2012-01-01',
                privado: 6068.2,
                publico: 2549.9,
                casas_particulares: 389.7,
                autonomos: 408.2,
                monotributo: 1314.7,
                monotributo_social: 167.8,
                total: 10898.5,
                provisional: false,
            },
            {
                fecha: 'JUN 26',
                iso_fecha: '2026-06-01',
                privado: 6126.4,
                publico: 3380,
                casas_particulares: 444.1,
                autonomos: 388.9,
                monotributo: 2206.8,
                monotributo_social: 227.3,
                total: 12773.4,
                provisional: true,
            },
        ]);
    });
});
