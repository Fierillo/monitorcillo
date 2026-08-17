import { describe, expect, it } from 'vitest';
import { parseIcaPublicationDate } from '../lib/balanza-source';

describe('ICA official source parsing', () => {
    it('parses the ICA report publication date from the INDEC page', () => {
        const html = '<div>21/08/26. Intercambio comercial argentino. Datos de julio de 2026</div>';

        expect(parseIcaPublicationDate(html)).toBe('2026-08-21');
    });
});
