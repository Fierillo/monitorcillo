import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseEquilibraRssItem, parseIndecIpcWorkbook, parseIpcOnlineRssItem } from '../lib/inflacion-source';

function createWorkbook(rows: unknown[][]): Buffer {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Variación mensual IPC Nacional');
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('parseIndecIpcWorkbook', () => {
    it('extracts national monthly general and core IPC variations', () => {
        const result = parseIndecIpcWorkbook(createWorkbook([
            [],
            [],
            [],
            [],
            [],
            ['Total nacional', 'Mar-26', 'Apr-26'],
            [],
            ['Nivel general y divisiones COICOP'],
            [],
            ['Nivel general', '3.4', '2.6'],
            [],
            ['Núcleo', '3.2', '2.3'],
        ]));

        expect(result).toContainEqual({
            fecha: '2026-04-01',
            ipc_indec: 2.6,
            ipc_nucleo_indec: 2.3,
        });
    });
});

describe('parseEquilibraRssItem', () => {
    it('extracts IPC Nacional from RSS content', () => {
        const xml = `
            <item>
                <title>IPC mensual abril 2026</title>
                <content:encoded><![CDATA[<p>Según nuestros relevamientos de precios, en abril de 2026 el IPC Nacional subió 2,4% y la medición Núcleo 2,0%.</p>]]></content:encoded>
            </item>
        `;
        const result = parseEquilibraRssItem(xml);
        expect(result).not.toBeNull();
        expect(result?.fecha).toBe('2026-04-01');
        expect(result?.ipc_equilibra).toBe(2.4);
    });

    it('extracts IPC from older post format', () => {
        const xml = `
            <item>
                <title>IPC mensual marzo 2026</title>
                <content:encoded><![CDATA[<p>Según nuestros relevamientos, en marzo de 2026 la inflación nacional fue 3,3%, liderada por Regulados.</p>]]></content:encoded>
            </item>
        `;
        const result = parseEquilibraRssItem(xml);
        expect(result).not.toBeNull();
        expect(result?.fecha).toBe('2026-03-01');
        expect(result?.ipc_equilibra).toBe(3.3);
    });

    it('skips non-mensual posts', () => {
        const xml = `
            <item>
                <title>IPC semanal 1ra semana de febrero</title>
                <content:encoded><![CDATA[<p>La inflación nacional fue 0,5%.</p>]]></content:encoded>
            </item>
        `;
        expect(parseEquilibraRssItem(xml)).toBeNull();
    });

    it('returns null when no IPC value found', () => {
        const xml = `
            <item>
                <title>IPC mensual enero 2026</title>
                <content:encoded><![CDATA[<p>Resumen del mes sin datos específicos.</p>]]></content:encoded>
            </item>
        `;
        expect(parseEquilibraRssItem(xml)).toBeNull();
    });
});

describe('parseIpcOnlineRssItem', () => {
    it('extracts IPC from RSS description', () => {
        const xml = `
            <item>
                <title>IPC Abril 2026</title>
                <description><![CDATA[
Inflación: 1,71%
Interanual: 27,56%
]]></description>
            </item>
        `;
        const result = parseIpcOnlineRssItem(xml);
        expect(result).not.toBeNull();
        expect(result?.fecha).toBe('2026-04-01');
        expect(result?.ipc_online).toBe(1.71);
    });

    it('extracts IPC from RSS content encoded as fallback', () => {
        const xml = `
            <item>
                <title>IPC Marzo 2026</title>
                <content:encoded><![CDATA[<h2 style="text-align: center">2,60%</h2><p>La inflación...</p>]]></content:encoded>
            </item>
        `;
        const result = parseIpcOnlineRssItem(xml);
        expect(result).not.toBeNull();
        expect(result?.fecha).toBe('2026-03-01');
        expect(result?.ipc_online).toBe(2.6);
    });

    it('returns null when title has no month/year', () => {
        const xml = '<item><title>Bienvenidos</title><description><![CDATA[Inflación: 1,5%]]></description></item>';
        expect(parseIpcOnlineRssItem(xml)).toBeNull();
    });

    it('returns null when no percentage found', () => {
        const xml = '<item><title>IPC Abril 2026</title><description><![CDATA[Resumen del mes]]></description></item>';
        expect(parseIpcOnlineRssItem(xml)).toBeNull();
    });
});
