import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EMAE_SECTORS } from '../lib/emae/schema';
import { contrastRatio } from '../lib/color-contrast';

const WCAG_NON_TEXT_CONTRAST = 3;

function chartBackgroundFromTheme(): string {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const match = css.match(/--color-imperial-blue:\s*(#[0-9A-Fa-f]{6})/i);
    if (!match) {
        throw new Error('Chart background token --color-imperial-blue was not found in src/app/globals.css. Add it or update the contrast test to follow the theme.');
    }
    return match[1];
}

describe('EMAE sector contrast on the chart canvas', () => {
    it('keeps every sector stroke color distinguishable from the chart background', () => {
        const background = chartBackgroundFromTheme();

        for (const sector of EMAE_SECTORS) {
            const borderColor = 'borderColor' in sector && typeof sector.borderColor === 'string'
                ? sector.borderColor
                : null;
            if (borderColor) {
                const borderRatio = contrastRatio(borderColor, background);
                expect(
                    borderRatio,
                    `${sector.key}.borderColor=${borderColor} vs canvas ${background} needs contrast ≥ ${WCAG_NON_TEXT_CONTRAST}:1 (got ${borderRatio.toFixed(2)}:1)`,
                ).toBeGreaterThanOrEqual(WCAG_NON_TEXT_CONTRAST);
            }

            const strokes: Array<{ role: string; color: string }> = [{ role: 'color', color: sector.color }];
            if ('secondaryColor' in sector && typeof sector.secondaryColor === 'string') {
                strokes.push({ role: 'secondaryColor', color: sector.secondaryColor });
            }

            for (const stroke of strokes) {
                const ratio = contrastRatio(stroke.color, background);
                const rescuedByBorder = borderColor != null && contrastRatio(borderColor, background) >= WCAG_NON_TEXT_CONTRAST;
                expect(
                    ratio >= WCAG_NON_TEXT_CONTRAST || rescuedByBorder,
                    `${sector.key}.${stroke.role}=${stroke.color} vs canvas ${background} needs contrast ≥ ${WCAG_NON_TEXT_CONTRAST}:1 (got ${ratio.toFixed(2)}:1), or a contrasting borderColor on that sector`,
                ).toBe(true);
            }
        }
    });
});
