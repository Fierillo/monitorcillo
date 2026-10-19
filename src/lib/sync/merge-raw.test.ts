import { describe, expect, it } from 'vitest';
import { mergeRawSeries } from './merge-raw';

type RawValue = number | string | null;

describe('mergeRawSeries edges', () => {
    it('does not wipe a stored value with an empty string', () => {
        const existing: Array<{ fecha: string; ipc: RawValue }> = [{ fecha: '2026-01-01', ipc: 2.1 }];
        const incoming: Array<{ fecha: string; ipc: RawValue }> = [{ fecha: '2026-01-01', ipc: '' }];
        const result = mergeRawSeries(existing, incoming);

        expect(result.merged).toEqual([{ fecha: '2026-01-01', ipc: 2.1 }]);
        expect(result.upserts).toEqual([]);
    });

    it('treats 1 and 1.0 as the same observation', () => {
        const existing: Array<{ fecha: string; pobreza_utdt: RawValue }> = [{ fecha: '2026-03-01', pobreza_utdt: '1.0' }];
        const incoming: Array<{ fecha: string; pobreza_utdt: RawValue }> = [{ fecha: '2026-03-01', pobreza_utdt: 1 }];
        const result = mergeRawSeries(existing, incoming);

        expect(result.upserts).toEqual([]);
        expect(result.merged).toEqual([{ fecha: '2026-03-01', pobreza_utdt: '1.0' }]);
    });

    it('ignores a blank date instead of inventing or duplicating a row', () => {
        const result = mergeRawSeries(
            [
                { fecha: '', ipc: 1 },
                { fecha: '2026-01-01', ipc: 2 },
            ],
            [
                { fecha: '', ipc: 9 },
                { fecha: '2026-01-01', ipc: 3 },
                { fecha: '2026-01-01', ipc: 4 },
            ],
        );

        expect(result.merged).toEqual([{ fecha: '2026-01-01', ipc: 4 }]);
    });

    it('treats null and an empty string as the same absent value', () => {
        const existing: Array<{ fecha: string; rem: RawValue }> = [{ fecha: '2026-04-01', rem: null }];
        const incoming: Array<{ fecha: string; rem: RawValue }> = [{ fecha: '2026-04-01', rem: '' }];
        const result = mergeRawSeries(existing, incoming);

        expect(result.upserts).toEqual([]);
    });
});
