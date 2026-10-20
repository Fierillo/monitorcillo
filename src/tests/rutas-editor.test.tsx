import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import RutasEditor from '../app/admin/components/RutasEditor';
import type { RutaTramoDraft } from '@/lib/rutas/status';

afterEach(cleanup);

const initial: RutaTramoDraft = {
    id: 'oriental',
    nombre: 'Tramo Oriental',
    rutas: '9, 12',
    km: '320',
    concesionaria: 'Corredores Viales',
    fechaTomaPosesion: '2025-04-01',
    obrasInicialesPct: '15',
    fechaHabilitacionTarifa: '',
    etapa: 'concesionado',
    pavimento: 'sin-dato',
};

it('edits a concession section and removes that row', () => {
    const onSave = vi.fn();
    function Editor() {
        const [rows, setRows] = useState([initial]);
        return (
            <RutasEditor
                data={rows}
                msg=""
                onAdd={() => setRows(current => [...current, { ...initial, id: 'nuevo', nombre: '' }])}
                onDelete={index => setRows(current => current.filter((_, rowIndex) => rowIndex !== index))}
                onSave={onSave}
                onCellChange={(index, field, value) => setRows(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: value } : row))}
            />
        );
    }
    render(<Editor />);

    const routes = screen.getByRole('textbox', { name: 'Rutas Tramo Oriental' }) as HTMLInputElement;
    fireEvent.change(routes, { target: { value: '9, 14' } });
    expect(routes.value).toBe('9, 14');
    expect((screen.getByRole('combobox', { name: 'Etapa Tramo Oriental' }) as HTMLSelectElement).value).toBe('concesionado');
    expect(screen.getByRole('option', { name: 'En licitación' })).toBeDefined();
    expect(screen.getByRole('option', { name: 'Sin dato' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Tramo Oriental' }));
    expect(screen.queryByRole('textbox', { name: 'Rutas Tramo Oriental' })).toBeNull();
});

function EditorWithStored({ onSave, stored = [initial] }: { onSave: () => void; stored?: RutaTramoDraft[] }) {
    const [rows, setRows] = useState([initial, { ...initial, id: 'sur', nombre: 'Tramo Sur' }]);
    return (
        <RutasEditor
            data={rows}
            stored={[...stored, { ...initial, id: 'sur', nombre: 'Tramo Sur' }]}
            msg=""
            onAdd={() => undefined}
            onDelete={index => setRows(current => current.filter((_, rowIndex) => rowIndex !== index))}
            onSave={onSave}
            onCellChange={() => undefined}
        />
    );
}

it('asks to confirm an irreversible save that deletes stored tramos, and cancel saves nothing', () => {
    const onSave = vi.fn();
    render(<EditorWithStored onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Tramo Oriental' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Eliminar tramos' });
    expect(dialog.textContent).toContain('irreversible');
    expect(dialog.textContent).toContain('Tramo Oriental');
    expect(dialog.textContent).toContain('sectores de km');
    expect(dialog.textContent).toContain('ofertas');
    expect(dialog.textContent).not.toContain('Tramo Sur');
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar y guardar' }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('saves without asking when no stored tramo is removed', () => {
    const onSave = vi.fn();
    render(<EditorWithStored onSave={onSave} stored={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar Tramo Oriental' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onSave).toHaveBeenCalledOnce();
});
