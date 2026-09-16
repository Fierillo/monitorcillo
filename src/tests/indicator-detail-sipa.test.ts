import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Indicator } from '@/types';

const storage = vi.hoisted(() => ({
    getIndicatorData: vi.fn(),
}));

vi.mock('../lib/db/client', () => ({ sql: { query: vi.fn(), transaction: vi.fn() } }));
vi.mock('../lib/db', () => ({ getRawData: vi.fn() }));
vi.mock('../lib/storage', () => storage);

import { getIndicatorDetailConfig } from '../lib/indicator-detail-configs';
import { SIPA_BREAKDOWN_SERIES } from '../lib/sipa-schema';

const sipaIndicator: Indicator = {
    id: 'sipa',
    fecha: 'JUN 26',
    fuente: 'Secretaría de Trabajo',
    indicador: 'Trabajo registrado (SIPA)',
    referencia: 'Mes anterior desest.',
    dato: '12,8 millones',
};

describe('SIPA indicator detail config', () => {
    beforeEach(() => {
        storage.getIndicatorData.mockReset();
        storage.getIndicatorData.mockResolvedValue([
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

    it('stacks modality bars under a total line and marks provisional months', async () => {
        const config = await getIndicatorDetailConfig(sipaIndicator);

        expect(config).not.toBeNull();
        expect(config?.areas.filter(area => area.type === 'bar').map(area => ({
            key: area.key,
            stackId: area.stackId,
            preliminaryKey: area.preliminaryKey,
            preliminaryFillPattern: area.preliminaryFillPattern,
            preliminaryLabel: area.preliminaryLabel,
        }))).toEqual(SIPA_BREAKDOWN_SERIES.map((series, index) => ({
            key: series.key,
            stackId: 'sipa',
            preliminaryKey: 'preliminary',
            preliminaryFillPattern: undefined,
            preliminaryLabel: index === 0 ? 'Provisorio: declaración AFIP incompleta' : undefined,
        })));
        expect(config?.areas.filter(area => area.preliminaryLabel)).toHaveLength(1);
        expect(config?.areas.find(area => area.key === 'total')).toMatchObject({
            type: 'line',
            hideInTooltip: true,
        });
        expect(config?.data).toEqual([
            expect.objectContaining({
                iso_fecha: '2026-06-01',
                total: 12773.4,
                provisional: true,
                preliminary: true,
            }),
        ]);
        expect(config?.showTooltipTotal).toBe(true);
    });
});
