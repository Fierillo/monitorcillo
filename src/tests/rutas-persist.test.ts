import { describe, expect, it } from 'vitest';
import { parseRutasView } from '@/lib/rutas/persist';

describe('parseRutasView', () => {
    it('restores a saved view', () => {
        const saved = { mode: 'pavimento', filterBy: 'ruta', selected: ['9'], pick: { code: '9', company: 'CPC' } };
        expect(parseRutasView(JSON.stringify(saved))).toEqual(saved);
    });

    it('restores the concesionaria filter and reads the old constructora value as it', () => {
        const saved = { mode: 'concesion', filterBy: 'concesionaria', selected: ['CPC'], pick: null };
        expect(parseRutasView(JSON.stringify(saved))).toEqual(saved);
        expect(parseRutasView(JSON.stringify({ ...saved, filterBy: 'constructora' }))).toEqual(saved);
    });

    it('ignores missing, broken or unknown values', () => {
        expect(parseRutasView(null)).toBeNull();
        expect(parseRutasView('{oops')).toBeNull();
        expect(parseRutasView(JSON.stringify({ mode: 'x', filterBy: 'y', selected: [1], pick: 'z' }))).toEqual({ mode: 'concesion', filterBy: 'ninguno', selected: [], pick: null });
    });
});
