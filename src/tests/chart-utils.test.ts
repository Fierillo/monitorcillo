import { describe, expect, it } from 'vitest';
import { collectAxisExtentValues } from '../components/chart/utils';

describe('collectAxisExtentValues', () => {
    it('uses positive and negative stack totals for mixed-sign columns', () => {
        expect(collectAxisExtentValues(
            [{ fecha: 'ENE 26', exportaciones: 6500, importaciones: -5800 }],
            [
                { key: 'exportaciones', name: 'Exportaciones', color: '#22C55E', type: 'bar', stackId: 'balanza' },
                { key: 'importaciones', name: 'Importaciones', color: '#EF4444', type: 'bar', stackId: 'balanza' },
            ],
        )).toEqual([6500, -5800]);
    });
});
