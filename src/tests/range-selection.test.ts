import { describe, expect, it } from 'vitest';
import { beginRangeSelection, moveRangeSelection, releaseRangeSelection } from '../lib/chart-range-selection';

const maxIndex = 99;

describe('range selection', () => {
    it('asks for the first endpoint at the current start', () => {
        expect(beginRangeSelection([40, 59])).toEqual({ phase: 'start', index: 40, startIndex: 40, endIndex: 59 });
    });

    it('follows the finger while choosing the first endpoint', () => {
        const moved = moveRangeSelection(beginRangeSelection([40, 59]), 12, maxIndex);

        expect(moved.index).toBe(12);
    });

    it('never moves an endpoint past the available history', () => {
        expect(moveRangeSelection(beginRangeSelection([40, 59]), -20, maxIndex).index).toBe(0);
        expect(moveRangeSelection(beginRangeSelection([40, 59]), 500, maxIndex).index).toBe(maxIndex);
    });

    it('asks for the second endpoint without committing yet', () => {
        const chosen = moveRangeSelection(beginRangeSelection([40, 59]), 12, maxIndex);
        const released = releaseRangeSelection(chosen);

        expect(released.committed).toBeNull();
        expect(released.selection).toEqual({ phase: 'end', index: 59, startIndex: 12, endIndex: 59 });
    });

    it('commits both endpoints in order once the second is released', () => {
        const start = moveRangeSelection(beginRangeSelection([40, 59]), 12, maxIndex);
        const end = moveRangeSelection(releaseRangeSelection(start).selection, 30, maxIndex);
        const released = releaseRangeSelection(end);

        expect(released.committed).toEqual([12, 30]);
    });

    it('keeps the endpoints in chronological order when they are crossed', () => {
        const start = moveRangeSelection(beginRangeSelection([40, 59]), 70, maxIndex);
        const end = moveRangeSelection(releaseRangeSelection(start).selection, 20, maxIndex);

        expect(releaseRangeSelection(end).committed).toEqual([20, 70]);
    });
});
