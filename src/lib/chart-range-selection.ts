export type RangeSelectionPhase = 'start' | 'end';

export type RangeSelection = {
    phase: RangeSelectionPhase;
    index: number;
    startIndex: number;
    endIndex: number;
};

export type RangeSelectionRelease = {
    selection: RangeSelection;
    committed: [number, number] | null;
};

export function beginRangeSelection([startIndex, endIndex]: [number, number]): RangeSelection {
    return { phase: 'start', index: startIndex, startIndex, endIndex };
}

export function moveRangeSelection(selection: RangeSelection, index: number, maxIndex: number): RangeSelection {
    return { ...selection, index: Math.min(maxIndex, Math.max(0, index)) };
}

export function releaseRangeSelection(selection: RangeSelection): RangeSelectionRelease {
    if (selection.phase === 'start') {
        return {
            selection: { ...selection, phase: 'end', index: selection.endIndex, startIndex: selection.index },
            committed: null,
        };
    }
    return { selection, committed: [Math.min(selection.startIndex, selection.index), Math.max(selection.startIndex, selection.index)] };
}
