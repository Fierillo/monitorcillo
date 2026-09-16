function channelToLinear(channel: number): number {
    const normalized = channel / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function expandHex(hex: string): string {
    if (/^[0-9A-Fa-f]{3}$/.test(hex)) {
        return hex.split('').map((digit) => digit + digit).join('');
    }
    return hex;
}

function parseHexColor(color: string): [number, number, number] {
    const hex = expandHex(color.trim().replace(/^#/, ''));
    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
        throw new Error(`Expected a #RRGGBB color, got "${color}". Use a six-digit hex value.`);
    }
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

export function relativeLuminance(color: string): number {
    const [red, green, blue] = parseHexColor(color).map(channelToLinear);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground: string, background: string): number {
    const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background));
    const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background));
    return (lighter + 0.05) / (darker + 0.05);
}

export function readableTextColor(foreground: string, background: string, minimumRatio = 4.5): string {
    if (contrastRatio(foreground, background) >= minimumRatio) return foreground;
    return relativeLuminance(background) > 0.5 ? '#000000' : '#FFFFFF';
}
