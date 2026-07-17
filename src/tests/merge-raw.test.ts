import { describe, expect, it } from 'vitest';
import { mergeRawSeries } from '../lib/sync/merge-raw';

describe('mergeRawSeries', () => {
    it('keeps existing history when incoming is empty', () => {
        const existing = [
            { fecha: '2026-01-01', pobreza_utdt: 30.2 },
            { fecha: '2026-02-01', pobreza_utdt: 30.6 },
        ];

        const result = mergeRawSeries(existing, []);

        expect(result.emptyIncoming).toBe(true);
        expect(result.upserts).toEqual([]);
        expect(result.merged).toEqual(existing);
    });

    it('does not overwrite stored values with null or undefined', () => {
        const existing = [
            { fecha: '2026-05-01', pobreza_indec: 28.2 as number | null, pobreza_utdt: 29.6 as number | null },
        ];
        const incoming = [
            { fecha: '2026-05-01', pobreza_indec: 28.2, pobreza_utdt: null as number | null },
            { fecha: '2026-06-01', pobreza_utdt: 31.6 },
        ];

        const result = mergeRawSeries(existing, incoming);

        expect(result.merged).toEqual([
            { fecha: '2026-05-01', pobreza_indec: 28.2, pobreza_utdt: 29.6 },
            { fecha: '2026-06-01', pobreza_utdt: 31.6 },
        ]);
        expect(result.upserts).toEqual([
            { fecha: '2026-06-01', pobreza_utdt: 31.6 },
        ]);
    });

    it('updates only fields that actually change', () => {
        const existing = [
            { fecha: '2026-01-01', ipc_indec: 2.2, ipc_equilibra: 2.1 },
            { fecha: '2026-02-01', ipc_indec: 2.0, ipc_equilibra: null },
        ];
        const incoming = [
            { fecha: '2026-01-01', ipc_indec: 2.2, ipc_equilibra: 2.4 },
            { fecha: '2026-02-01', ipc_indec: 1.9, ipc_equilibra: 1.8 },
        ];

        const result = mergeRawSeries(existing, incoming);

        expect(result.upserts).toEqual([
            { fecha: '2026-01-01', ipc_equilibra: 2.4 },
            { fecha: '2026-02-01', ipc_indec: 1.9, ipc_equilibra: 1.8 },
        ]);
        expect(result.merged).toEqual([
            { fecha: '2026-01-01', ipc_indec: 2.2, ipc_equilibra: 2.4 },
            { fecha: '2026-02-01', ipc_indec: 1.9, ipc_equilibra: 1.8 },
        ]);
    });

    it('preserves historical rows missing from a partial fetch', () => {
        const existing = [
            { fecha: '2025-10-01', pobreza_utdt: 30.7 },
            { fecha: '2025-11-01', pobreza_utdt: 31.0 },
            { fecha: '2025-12-01', pobreza_utdt: 30.6 },
        ];
        const incoming = [
            { fecha: '2025-12-01', pobreza_utdt: 30.6 },
            { fecha: '2026-01-01', pobreza_utdt: 30.2 },
        ];

        const result = mergeRawSeries(existing, incoming);

        expect(result.merged.map((row) => row.fecha)).toEqual([
            '2025-10-01',
            '2025-11-01',
            '2025-12-01',
            '2026-01-01',
        ]);
        expect(result.upserts).toEqual([
            { fecha: '2026-01-01', pobreza_utdt: 30.2 },
        ]);
    });

    it('treats numeric strings from the database as equal to numbers', () => {
        const existing = [{ fecha: '2026-03-01', pobreza_utdt: '29' as string | number }];
        const incoming = [{ fecha: '2026-03-01', pobreza_utdt: 29 as string | number }];

        const result = mergeRawSeries(existing, incoming);

        expect(result.upserts).toEqual([]);
        expect(result.merged).toEqual([{ fecha: '2026-03-01', pobreza_utdt: '29' }]);
    });
});
