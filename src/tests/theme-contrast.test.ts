import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TOOLTIP_BACKGROUND, TOOLTIP_BOX } from '@/components/chart/ChartTooltip';

type Rgba = [number, number, number, number];

const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');

function token(name: string): string {
    const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8}|rgba?\\([^)]*\\))`));
    if (!match) throw new Error(`missing token --${name}`);
    return match[1];
}

function parse(color: string): Rgba {
    const hex = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
        const h = hex[1].length === 3 ? [...hex[1]].map(c => c + c).join('') : hex[1];
        return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1) as Rgba;
    }
    const rgb = color.match(/rgba?\(([^)]*)\)/i);
    if (!rgb) throw new Error(`unsupported color ${color}`);
    const [r, g, b, a = 1] = rgb[1].split(',').map(Number);
    return [r, g, b, a];
}

function over(top: string, bottom: string): string {
    const [r, g, b, a] = parse(top);
    const [br, bg, bb] = parse(bottom);
    const mix = (c: number, d: number) => Math.round(c * a + d * (1 - a));
    return `rgb(${mix(r, br)}, ${mix(g, bg)}, ${mix(b, bb)})`;
}

function luminance(color: string): number {
    const [r, g, b] = parse(color).map(v => v / 255);
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: string, bg: string): number {
    const [l1, l2] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
    return (l1 + 0.05) / (l2 + 0.05);
}

const gold = token('color-imperial-gold');
const goldLight = token('color-imperial-gold-light');
const ivory = token('color-imperial-ivory');
const cyan = token('color-imperial-cyan');
const night = token('color-imperial-night');
const blue = token('color-imperial-blue');
const pageBg = token('background');

const NORMAL = 4.5;
const LARGE_OR_UI = 3;

describe('theme contrast (WCAG)', () => {
    const textTokens = { goldLight, gold, ivory, cyan };
    const surfaces = { night, blue, pageBg };

    for (const [textName, fg] of Object.entries(textTokens)) {
        for (const [bgName, bg] of Object.entries(surfaces)) {
            it(`${textName} text on ${bgName} meets ${NORMAL}:1`, () => {
                expect(contrast(fg, bg)).toBeGreaterThanOrEqual(NORMAL);
            });
        }
    }

    it('table header gold text on night header background meets normal text contrast', () => {
        expect(contrast(gold, night)).toBeGreaterThanOrEqual(NORMAL);
    });

    it('gold hairlines are visible as UI boundaries on both surfaces', () => {
        expect(contrast(gold, night)).toBeGreaterThanOrEqual(LARGE_OR_UI);
        expect(contrast(gold, blue)).toBeGreaterThanOrEqual(LARGE_OR_UI);
    });

    it('chart and map tooltip text uses the ivory token and is readable over the translucent tooltip on the chart card', () => {
        expect(TOOLTIP_BOX.color.toLowerCase()).toBe(ivory.toLowerCase());
        const tooltipBg = over(TOOLTIP_BACKGROUND, blue);
        expect(contrast(TOOLTIP_BOX.color, tooltipBg)).toBeGreaterThanOrEqual(NORMAL);
        expect(contrast(gold, tooltipBg)).toBeGreaterThanOrEqual(NORMAL);
    });

    it('axis ticks (gold, muted cyan) on chart card background meet normal text contrast', () => {
        expect(contrast(gold, blue)).toBeGreaterThanOrEqual(NORMAL);
        expect(contrast(cyan, blue)).toBeGreaterThanOrEqual(NORMAL);
    });

    it('map legend and tooltip labels (gold/ivory) on map panel meet normal text contrast', () => {
        expect(contrast(gold, blue)).toBeGreaterThanOrEqual(NORMAL);
        expect(contrast(ivory, over(TOOLTIP_BACKGROUND, blue))).toBeGreaterThanOrEqual(NORMAL);
    });
});
