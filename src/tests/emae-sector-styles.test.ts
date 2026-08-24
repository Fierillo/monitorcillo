import { describe, expect, it } from 'vitest';
import { EMAE_SECTORS } from '../lib/emae/schema';

const sector = (key: string) => EMAE_SECTORS.find(item => item.key === key);

describe('EMAE sector styles', () => {
    it('uses solid green, cyan and yellow lines for primary activities', () => {
        expect(sector('agro')).toMatchObject({ color: '#22C55E' });
        expect(sector('pesca')).toMatchObject({ color: '#38BDF8' });
        expect(sector('mineria')).toMatchObject({ color: '#FACC15' });
        expect('dash' in sector('agro')!).toBe(false);
        expect('dash' in sector('pesca')!).toBe(false);
        expect('dash' in sector('mineria')!).toBe(false);
    });

    it('distinguishes secondary and tertiary activities by dash density', () => {
        for (const key of ['industria', 'energia', 'construccion']) expect(sector(key)).toMatchObject({ dash: [8, 5] });
        for (const key of ['comercio', 'hoteles', 'transporte', 'finanzas', 'inmobiliarias', 'administracion_publica', 'ensenanza', 'salud', 'otros_servicios']) {
            expect(sector(key)).toMatchObject({ dash: [2, 5] });
        }
    });

    it('uses a black and red treatment for taxes', () => {
        expect(sector('impuestos')).toMatchObject({ color: '#000000', secondaryColor: '#EF4444' });
    });

    it('uses custom colors for selected activities', () => {
        expect(sector('administracion_publica')).toMatchObject({ color: '#00BFFF' });
        expect(sector('salud')).toMatchObject({ color: '#F97316' });
        expect(sector('hoteles')).toMatchObject({ color: '#A855F7' });
        expect(sector('construccion')).toMatchObject({ color: '#9CA3AF' });
        expect(sector('finanzas')).toMatchObject({ color: '#2563EB' });
        expect(sector('transporte')).toMatchObject({ color: '#FACC15' });
        expect(sector('inmobiliarias')).toMatchObject({ color: '#9CA3AF' });
        expect(sector('comercio')).toMatchObject({ color: '#EF4444' });
    });
});
