import { describe, expect, it } from 'vitest';
import { parseOfficialSalaryCsvRows } from '../lib/sync/poder-adquisitivo';

describe('parseOfficialSalaryCsvRows', () => {
    it('parses official INDEC salary CSV rows', () => {
        const rows = parseOfficialSalaryCsvRows(`periodo;IS_sector_privado_registrado;IS_sector_publico;IS_total_registrado;IS_sector_no_registrado;IS_indice_total
1/3/2026;8935,48;7344,33;8341,11;9916,02;8654,99`);

        expect(rows.get('2026-03-01')).toEqual({
            salario_registrado: 8341.11,
            salario_no_registrado: 9916.02,
            salario_privado: 8935.48,
            salario_publico: 7344.33,
        });
    });
});
