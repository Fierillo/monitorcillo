import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Indicator } from '@/types';

const storage = vi.hoisted(() => ({
    getIndicatorData: vi.fn(),
}));

const inflacionSource = vi.hoisted(() => ({
    fetchRemExpectationsHistory: vi.fn(),
    normalizeRemExpectations: vi.fn(),
}));

vi.mock('../lib/db/client', () => ({ sql: { query: vi.fn(), transaction: vi.fn() } }));
vi.mock('../lib/db', () => ({ getRawData: vi.fn() }));
vi.mock('../lib/storage', () => storage);
vi.mock('../lib/inflacion-source', () => inflacionSource);

import { getIndicatorDetailConfig } from '../lib/indicator-detail-configs';

const inflacionIndicator: Indicator = {
    id: 'inflacion',
    fecha: 'JUL 26',
    fuente: 'INDEC',
    indicador: 'Inflación (IPC)',
    referencia: 'Mes anterior',
    dato: '2,1%',
};

describe('Inflacion indicator detail config', () => {
    beforeEach(() => {
        storage.getIndicatorData.mockReset();
        inflacionSource.fetchRemExpectationsHistory.mockReset();
        inflacionSource.normalizeRemExpectations.mockReset();
        storage.getIndicatorData.mockResolvedValue([
            {
                fecha: 'JUL 26',
                iso_fecha: '2026-07-01',
                ipc_indec: 2.11,
                ipc_nucleo_indec: 1.9,
                ipc_equilibra: null,
                ipc_online: null,
                rem: null,
                ipim: 0.8,
                ipc: 2.11,
            },
        ]);
        inflacionSource.fetchRemExpectationsHistory.mockResolvedValue([]);
        inflacionSource.normalizeRemExpectations.mockReturnValue([]);
    });

    it('includes IPIM as a chart series in the IPC view', async () => {
        const config = await getIndicatorDetailConfig(inflacionIndicator);
        const ipcView = config?.views?.find(view => view.id === 'ipc');
        expect(ipcView?.areas.some(area => area.key === 'ipim' && area.name === 'IPIM')).toBe(true);
        expect(config?.areas.some(area => area.key === 'ipim' && area.name === 'IPIM')).toBe(true);
    });
});
