import { expect, it, vi } from 'vitest';
import type { Indicator } from '@/types';
import { INVERSIONES } from './fixtures/inversiones';

vi.mock('../lib/db/client', () => ({ sql: { query: vi.fn(), transaction: vi.fn() } }));
vi.mock('../lib/db', () => ({ getRawData: vi.fn() }));
vi.mock('../lib/storage', () => ({ getIndicatorData: vi.fn() }));
const store = vi.hoisted(() => ({ getInversiones: vi.fn() }));
vi.mock('../lib/db/inversiones', () => store);

import { getIndicatorDetailConfig } from '../lib/indicator-detail-configs';

const indicator = { id: 'inversiones', fuente: 'Ministerio de Economía' } as Indicator;

it('builds the investments chart and methodology from stored data', async () => {
    store.getInversiones.mockResolvedValue(INVERSIONES);
    const config = await getIndicatorDetailConfig(indicator);
    expect(config?.data).toHaveLength(115);
    const text = config?.methodology.map(item => item.description).join('\n');
    expect(text).toContain('Al 31 de julio de 2026 comprende 21 proyectos por USD 46.708 millones.');
    expect(text).toContain('El último dato registra 22 proyectos por USD 101.241 millones.');
});

it('renders an empty chart when nothing is stored', async () => {
    store.getInversiones.mockResolvedValue({ approvals: [], observations: [], nonRigi: [] });
    const config = await getIndicatorDetailConfig(indicator);
    expect(config?.data).toEqual([]);
});

it('builds the unlinked-dates note from the stored approval notes', async () => {
    store.getInversiones.mockResolvedValue(INVERSIONES);
    const config = await getIndicatorDetailConfig(indicator);
    const note = config?.methodology.find(item => item.title === 'Fechas sin resolución enlazada');
    expect(note?.description).toBe('PSJ Cobre Mendocino (junio de 2026) y Sal de Oro II (julio de 2026) se asignan al mes de su primera aparición comprobable en los totales oficiales.');

    store.getInversiones.mockResolvedValue({ ...INVERSIONES, approvals: [{ month: '2025-03-01', amountUsdMillions: 1, note: 'Proyecto X' }] });
    const custom = await getIndicatorDetailConfig(indicator);
    expect(custom?.methodology.find(item => item.title === 'Fechas sin resolución enlazada')?.description).toBe('Proyecto X (marzo de 2025) se asigna al mes de su primera aparición comprobable en los totales oficiales.');

    store.getInversiones.mockResolvedValue({ ...INVERSIONES, approvals: INVERSIONES.approvals.map(({ month, amountUsdMillions }) => ({ month, amountUsdMillions })) });
    const none = await getIndicatorDetailConfig(indicator);
    expect(none?.methodology.some(item => item.title === 'Fechas sin resolución enlazada')).toBe(false);
});
