import { describe, expect, it } from 'vitest';
import { contrastRatio, readableTextColor, relativeLuminance } from './color-contrast';

describe('color contrast', () => {
    it('measures black on white as the WCAG maximum', () => {
        expect(relativeLuminance('#000000')).toBe(0);
        expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
        expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5);
    });

    it('accepts short hex, mixed case, and surrounding spaces', () => {
        expect(contrastRatio(' #AbC ', '#abc')).toBeCloseTo(1, 5);
    });

    it('rejects a color that is not hex', () => {
        expect(() => relativeLuminance('red')).toThrow('Expected a #RRGGBB color, got "red"');
    });

    it('keeps a foreground that already clears the minimum ratio', () => {
        expect(readableTextColor('#000000', '#FFFFFF')).toBe('#000000');
    });

    it('switches to black on a light background and white on a dark one', () => {
        expect(readableTextColor('#eeeeee', '#ffffff')).toBe('#000000');
        expect(readableTextColor('#111111', '#000000')).toBe('#FFFFFF');
    });
});
