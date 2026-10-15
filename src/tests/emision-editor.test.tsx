import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import EmisionEditor from '../app/admin/components/EmisionEditor';
import { updateEmisionCell, withEmisionTotals } from '../app/admin/admin-utils';

afterEach(cleanup);

it('lets an admin type decimal rollover digits without losing the separator or precision', () => {
    function Editor() {
        const [rows, setRows] = useState(withEmisionTotals([{
            fecha: '14 OCT 26', TOTAL: 0, CompraDolares: 0, TC: 0, BCRA: 0,
            Vencimientos: 0, Licitado: 6_120_000, Licitaciones: 0, 'Resultado fiscal': 0,
        }]));
        return <EmisionEditor data={rows} msg="" onAdd={vi.fn()} onPop={vi.fn()} onSave={vi.fn()} onCellChange={(index, field, value) => setRows(previous => updateEmisionCell(previous, index, field, value))} />;
    }
    render(<Editor />);
    const input = screen.getByRole('textbox', { name: 'Rollover % 14 OCT 26' }) as HTMLInputElement;
    for (const value of ['120', '120,', '120,4', '120,42', '120,420', '120,4205']) {
        fireEvent.change(input, { target: { value } });
        expect(input.value).toBe(value);
    }
    expect((screen.getByRole('textbox', { name: 'Vencimientos 14 OCT 26' }) as HTMLInputElement).value).toBe(Math.round(6_120_000 * 100 / 120.4205).toLocaleString('es-AR'));
});

it('offers a rollover percentage input only from the start date and keeps all maturities read-only', () => {
    const rows = ['13 OCT 26', '14 OCT 26'].map(fecha => ({
        fecha, TOTAL: 0, CompraDolares: 0, TC: 0, BCRA: 0,
        Vencimientos: 5_000, Licitado: 6_000, Licitaciones: -1_000, 'Resultado fiscal': 0,
    }));
    render(<EmisionEditor data={withEmisionTotals(rows)} msg="" onAdd={vi.fn()} onPop={vi.fn()} onSave={vi.fn()} onCellChange={vi.fn()} />);

    expect(screen.getByRole('columnheader', { name: 'Rollover %' })).toBeDefined();
    expect((screen.getByRole('textbox', { name: 'Rollover % 14 OCT 26' }) as HTMLInputElement).readOnly).toBe(false);
    expect((screen.getByRole('textbox', { name: 'Rollover % 13 OCT 26' }) as HTMLInputElement).readOnly).toBe(true);
    for (const date of ['13 OCT 26', '14 OCT 26']) {
        const input = screen.getByRole('textbox', { name: `Vencimientos ${date}` }) as HTMLInputElement;
        expect(input.readOnly).toBe(true);
        expect(input.value).toBe('5.000');
    }
});
