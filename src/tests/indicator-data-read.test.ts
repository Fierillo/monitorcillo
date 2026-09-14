import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getNormalizedData: vi.fn() }));

vi.mock('../lib/db', () => ({ getNormalizedData: mocks.getNormalizedData }));

import { getIndicatorData } from '../lib/storage';

describe('getIndicatorData', () => {
    beforeEach(() => {
        mocks.getNormalizedData.mockReset();
    });

    it('returns an empty series for an indicator that has never been stored', async () => {
        mocks.getNormalizedData.mockResolvedValue(null);

        await expect(getIndicatorData('icg')).resolves.toEqual([]);
        expect(mocks.getNormalizedData).toHaveBeenCalledWith('icg');
    });

    it('returns an empty series for an unknown indicator without querying the database', async () => {
        await expect(getIndicatorData('inexistente')).resolves.toEqual([]);
        expect(mocks.getNormalizedData).not.toHaveBeenCalled();
    });

    it('maps the public indicator id to its stored series', async () => {
        mocks.getNormalizedData.mockResolvedValue([{ fecha: 'DIC 25', icg: 2.29 }]);

        await expect(getIndicatorData('balanza-comercial')).resolves.toEqual([{ fecha: 'DIC 25', icg: 2.29 }]);
        expect(mocks.getNormalizedData).toHaveBeenCalledWith('balanza');
    });

    it('surfaces a database failure instead of rendering an empty chart', async () => {
        mocks.getNormalizedData.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));

        await expect(getIndicatorData('icg')).rejects.toThrow('ECONNREFUSED');
    });
});
