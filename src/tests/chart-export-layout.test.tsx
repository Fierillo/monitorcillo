import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { desktopExportLayout } from '../components/chart/export-layout';
import IndicatorCompositeView from '../components/IndicatorCompositeView';

const toPng = vi.hoisted(() => vi.fn<(node: HTMLElement) => Promise<string>>(async () => 'data:image/png;base64,AAA'));

vi.mock('html-to-image', () => ({ toPng }));

const rows = [
    { fecha: 'ENE 23', iso_fecha: '2023-01-01', valor: 100 },
    { fecha: 'FEB 23', iso_fecha: '2023-02-01', valor: 110 },
    { fecha: 'MAR 23', iso_fecha: '2023-03-01', valor: 105 },
];
const areas = [{ key: 'valor', name: 'Valor', color: '#C9A44C', type: 'line' as const }];
const methodology = [
    { title: 'Fuente', description: 'INDEC' },
    { title: 'Detalle', description: 'Notas al pie' },
];

function setViewport(width: number) {
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true });
    window.dispatchEvent(new Event('resize'));
}

function stubImageExport() {
    class FakeImage {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        width = 10;
        height = 10;
        set src(_value: string) {
            queueMicrotask(() => this.onload?.());
        }
    }
    vi.stubGlobal('Image', FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
        fillRect() {},
        drawImage() {},
        set fillStyle(_value: string) {},
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,BBB');
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
}

function exportSnapshot(target: HTMLElement) {
    const chart = target.querySelector('[data-testid="chart-scroll-viewport"] > div') as HTMLElement | null;
    const watermark = target.querySelector('.watermark');
    const methodologyGrid = target.querySelector('.grid');
    const detail = [...target.querySelectorAll('.grid > div')].find(node => node.textContent?.includes('Detalle:'));
    return {
        chartWidth: chart?.style.width,
        chartHeight: chart?.style.height,
        watermarkClass: watermark?.className ?? '',
        methodologyClass: methodologyGrid?.className ?? '',
        detailClass: detail?.className ?? '',
    };
}

async function captureExport(viewportWidth: number) {
    setViewport(viewportWidth);
    toPng.mockClear();
    render(
        <IndicatorCompositeView
            title="EMAE"
            subtitle="INDEC"
            chartTitle="EMAE"
            data={rows}
            areas={areas}
            methodology={methodology}
            indicatorId="emae"
            valueFormat="index"
        />,
    );
    fireEvent.click(screen.getByTitle('Descargar gráfico'));
    await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
    });
    expect(toPng).toHaveBeenCalledTimes(1);
    return exportSnapshot(toPng.mock.calls[0][0] as HTMLElement);
}

describe('chart export layout', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        stubImageExport();
    });

    afterEach(() => {
        cleanup();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('defines one desktop export size from the 1521×900 reference viewport', () => {
        expect(desktopExportLayout()).toEqual({
            viewport: { width: 1521, height: 900 },
            cardWidth: 1383,
            chartSize: { width: 1311, height: 780 },
        });
    });

    it('exports the same chart size and typography from a phone and a desktop viewport', async () => {
        const { chartSize } = desktopExportLayout();
        const expected = {
            chartWidth: `${chartSize.width}px`,
            chartHeight: `${chartSize.height}px`,
            watermarkClass: expect.stringMatching(/(^|\s)text-4xl(\s|$)/),
            methodologyClass: expect.stringMatching(/(^|\s)grid-cols-2(\s|$)/),
            detailClass: expect.stringMatching(/(^|\s)col-span-2(\s|$)/),
        };

        const mobile = await captureExport(390);
        cleanup();
        const desktop = await captureExport(1521);

        expect(mobile).toMatchObject(expected);
        expect(desktop).toEqual(mobile);
        expect(mobile.watermarkClass).not.toMatch(/(^|\s)sm:text-4xl(\s|$)/);
        expect(mobile.methodologyClass).not.toMatch(/sm:grid-cols-2/);
        expect(mobile.detailClass).not.toMatch(/sm:col-span-2/);
    });
});
