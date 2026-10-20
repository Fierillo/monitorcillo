import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG } from '@/lib/catalog/defaults';

describe('rutas nacionales catalog', () => {
    it('publishes the indicator with a detail page and no invented figure', () => {
        expect(DEFAULT_CATALOG.find(row => row.id === 'rutas-nacionales')).toMatchObject({
            indicador: 'Rutas nacionales',
            dato: 'Sin tramos cargados',
            fuente: 'DNV',
            has_details: true,
            source_url: 'https://datos.transporte.gob.ar/dataset/rutas-nacionales',
        });
    });
});
