import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const database = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('../lib/db/client', () => ({ sql: database }));

import { saveRawData } from '../lib/db/raw';

describe('raw persistence', () => {
    beforeEach(() => {
        database.query.mockReset();
    });

    it('stores incoming rows as an upsert keyed by date', async () => {
        await saveRawData('icg', [{ fecha: '2026-01-01', icg: 2.5 }]);

        const [statement, values] = database.query.mock.calls[0];
        expect(statement).toContain('INSERT INTO icg_raw');
        expect(statement).toContain('ON CONFLICT (fecha) DO UPDATE SET');
        expect(values).toEqual(['2026-01-01', 2.5]);
    });

    it('never issues a statement that discards stored rows', async () => {
        await saveRawData('icg', [{ fecha: '2026-01-01', icg: 2.5 }]);

        const statements = database.query.mock.calls.map(([statement]) => statement).join(' ');
        expect(statements).not.toMatch(/DELETE|TRUNCATE|DROP/);
    });

    it('keeps the raw persistence layer free of destructive statements', () => {
        const source = readFileSync(join(process.cwd(), 'src/lib/db/raw.ts'), 'utf8');

        for (const statement of ['DELETE', 'TRUNCATE', 'DROP']) {
            expect(source, `src/lib/db/raw.ts must never issue ${statement}: raw tables are the only copy of the history`).not.toContain(statement);
        }
    });
});
