import { describe, expect, it } from 'vitest';
import { parseSalaryPublicationDate } from '../lib/salary-source';

describe('salary official source parsing', () => {
    it('parses the salary report publication date from the INDEC page', () => {
        const html = '<div>17/04/26. Índice de salarios</div>';

        expect(parseSalaryPublicationDate(html)).toBe('2026-04-17');
    });
});
