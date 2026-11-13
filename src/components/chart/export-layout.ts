/** Desktop viewport that defines every chart export (same default as shot.mjs). */
const DESKTOP_EXPORT_VIEWPORT = { width: 1521, height: 900 } as const;

const PAGE_PADDING_X = 40; // lg:p-10 at this viewport
const CARD_WIDTH_RATIO = 0.96; // sm:w-[96%]
const FRAME_PADDING_X = 16; // sm:p-4
const AXIS_LABEL_WIDTH = 20; // AxisLabel w-5, reserved on both sides so every chart fits
const PLOT_HEIGHT = 780;

export function desktopExportLayout() {
    const cardWidth = Math.floor((DESKTOP_EXPORT_VIEWPORT.width - PAGE_PADDING_X * 2) * CARD_WIDTH_RATIO);
    return {
        viewport: DESKTOP_EXPORT_VIEWPORT,
        cardWidth,
        chartSize: {
            width: cardWidth - FRAME_PADDING_X * 2 - AXIS_LABEL_WIDTH * 2,
            height: PLOT_HEIGHT,
        },
    };
}
