import { beforeEach, expect, it, vi } from 'vitest';

const database = vi.hoisted(() => ({ query: vi.fn(), transaction: vi.fn() }));
vi.mock('../lib/db/client', () => ({ sql: database }));

import { getRutasOfertas } from '../lib/db/rutas';
import { ofertaLabels } from '../lib/rutas/ofertas';
import { RUTAS_OFERTAS, RUTAS_SEED } from './fixtures/rutas';
import { tipOferta } from '../lib/rutas/tooltip';
import type { PaintedRoute } from '../lib/rutas/status';

beforeEach(() => {
    database.query.mockReset();
    database.query.mockResolvedValue([]);
});

it('maps stored offers and returns nothing when the table is empty', async () => {
    database.query.mockResolvedValueOnce([{ tramo_id: 'pampa', concesionaria: 'X', tarifa: '2355.37', gano: true, resolucion: 'Res. 706/2026', fuente_url: 'https://b' }]);
    await expect(getRutasOfertas()).resolves.toEqual([{ tramoId: 'pampa', concesionaria: 'X', tarifa: 2355.37, gano: true, resolucion: 'Res. 706/2026', fuenteUrl: 'https://b' }]);
    await expect(getRutasOfertas()).resolves.toEqual([]);
});

it('import data offers point at known tramos with one winner each', () => {
    const ids = new Set(RUTAS_SEED.map(tramo => tramo.id));
    expect(RUTAS_OFERTAS.every(oferta => ids.has(oferta.tramoId))).toBe(true);
    const winners = RUTAS_OFERTAS.filter(oferta => oferta.gano).map(oferta => oferta.tramoId);
    expect(new Set(winners).size).toBe(winners.length);
});

it('ofertaLabels formats the winning tariff and the range of ranked offers', () => {
    const base = { resolucion: 'R', fuenteUrl: 'u' };
    const ofertas = [
        { ...base, tramoId: 'a', concesionaria: 'W', tarifa: 1989.67, gano: true },
        { ...base, tramoId: 'a', concesionaria: 'L', tarifa: 3086, gano: false },
        { ...base, tramoId: 'b', concesionaria: 'Z', tarifa: 1, gano: true },
    ];
    expect(ofertaLabels(ofertas, 'a')).toEqual({ tarifa: '$1.989,67 sin IVA', ofertas: '2 ($1.989,67 – $3.086)' });
    expect(ofertaLabels(ofertas.slice(2), 'b')).toEqual({ tarifa: '$1 sin IVA', ofertas: null });
    expect(ofertaLabels(ofertas, 'c')).toBeNull();
    expect(ofertaLabels(ofertas, null)).toBeNull();
});

it('tipOferta uses the hovered segment tramo', () => {
    const route = { segments: [{ tramoId: 'b' }, { tramoId: 'a' }] } as unknown as PaintedRoute;
    const ofertas = [{ tramoId: 'a', concesionaria: 'W', tarifa: 5, gano: true, resolucion: 'R', fuenteUrl: 'u' }];
    expect(tipOferta(route, 1, ofertas)?.tarifa).toBe('$5 sin IVA');
    expect(tipOferta(route, 0, ofertas)).toBeNull();
});
