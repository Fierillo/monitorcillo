import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MobileRangePicker from '../components/chart/MobileRangePicker';
import type { RangeSelection } from '../lib/chart-range-selection';

afterEach(cleanup);

const rows = Array.from({ length: 5 }, (_, index) => ({
    fecha: `MES ${index}`,
    iso_fecha: `2026-0${index + 1}-01`,
    valor: index,
}));

function selection(overrides: Partial<RangeSelection> = {}): RangeSelection {
    return { phase: 'end', index: 3, startIndex: 1, endIndex: 4, ...overrides };
}

function renderPicker(current: RangeSelection, handlers: { onSelectionChange?: (next: RangeSelection) => void; onCommit?: (range: [number, number]) => void; onCancel?: () => void } = {}) {
    render(<MobileRangePicker
        data={rows}
        xAxisKey="iso_fecha"
        labelByXAxisValue={new Map()}
        selection={current}
        maxIndex={rows.length - 1}
        visibleRange={[0, rows.length - 1]}
        chartWidth={320}
        plotLeft={8}
        plotRight={8}
        onSelectionChange={handlers.onSelectionChange ?? (() => undefined)}
        onCommit={handlers.onCommit ?? (() => undefined)}
        onCancel={handlers.onCancel ?? (() => undefined)}
    />);
    return () => screen.getByTestId('range-picker');
}

describe('mobile range picker', () => {
    it('shows the date of the endpoint under the guide', () => {
        renderPicker(selection());

        expect(screen.getByTestId('range-picker-date').textContent).toBe('MES 3');
    });

    it('asks which endpoint is being chosen', () => {
        renderPicker(selection({ phase: 'start' }));

        expect(screen.getByTestId('range-picker-hint').textContent).toContain('Desde');
    });

    it('moves the guide and the date live without re-rendering the chart', () => {
        const onSelectionChange = vi.fn();
        const onCommit = vi.fn();
        const overlay = renderPicker(selection(), { onSelectionChange, onCommit })();
        overlay.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 360, width: 320, height: 360, toJSON: () => ({}) });

        fireEvent.pointerDown(overlay, { pointerId: 1, pointerType: 'touch', clientX: 312, clientY: 120, isPrimary: true });
        fireEvent.pointerMove(overlay, { pointerId: 1, pointerType: 'touch', clientX: 160, clientY: 120, isPrimary: true });

        expect(onSelectionChange).not.toHaveBeenCalled();
        expect(screen.getByTestId('range-picker-date').textContent).toBe('MES 2');
        expect(screen.getByTestId('range-picker-guide').style.left).toBe('160px');

        fireEvent.pointerUp(overlay, { pointerId: 1, pointerType: 'touch', clientX: 160, clientY: 120, isPrimary: true });

        expect(onSelectionChange).not.toHaveBeenCalled();
        expect(onCommit).toHaveBeenCalledWith([1, 2]);
    });

    it('asks for the second endpoint without committing when the first is released', () => {
        const onSelectionChange = vi.fn();
        const onCommit = vi.fn();
        const overlay = renderPicker(selection({ phase: 'start', index: 1, startIndex: 1, endIndex: 4 }), { onSelectionChange, onCommit })();
        overlay.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 360, width: 320, height: 360, toJSON: () => ({}) });

        fireEvent.pointerDown(overlay, { pointerId: 1, pointerType: 'touch', clientX: 8, clientY: 120, isPrimary: true });
        fireEvent.pointerMove(overlay, { pointerId: 1, pointerType: 'touch', clientX: 84, clientY: 120, isPrimary: true });
        fireEvent.pointerUp(overlay, { pointerId: 1, pointerType: 'touch', clientX: 84, clientY: 120, isPrimary: true });

        expect(onCommit).not.toHaveBeenCalled();
        expect(onSelectionChange).toHaveBeenCalledWith({ phase: 'end', index: 4, startIndex: 1, endIndex: 4 });
    });

    it('can also be dragged with a mouse on desktop', () => {
        const onCommit = vi.fn();
        const overlay = renderPicker(selection(), { onCommit })();
        overlay.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 320, bottom: 360, width: 320, height: 360, toJSON: () => ({}) });

        fireEvent.pointerDown(overlay, { pointerId: 1, pointerType: 'mouse', clientX: 312, clientY: 120 });
        fireEvent.pointerMove(overlay, { pointerId: 1, pointerType: 'mouse', clientX: 160, clientY: 120 });
        expect(screen.getByTestId('range-picker-date').textContent).toBe('MES 2');
        fireEvent.pointerUp(overlay, { pointerId: 1, pointerType: 'mouse', clientX: 160, clientY: 120 });

        expect(onCommit).toHaveBeenCalledWith([1, 2]);
    });

    it('lets the user cancel', () => {
        const onCancel = vi.fn();
        renderPicker(selection(), { onCancel });

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});
