import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { parseEquilibraRssItem, parseIndecIpcCsv, parseIndecIpcPressRelease, parseIndecIpcWorkbook } from '../lib/inflacion-source';

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

describe('parseIndecIpcCsv', () => {
    it('extracts national monthly general and core variations, ignoring regions and other rows', () => {
        const csv = [
            'Codigo;Descripcion;Clasificador;Periodo;Indice_IPC;v_m_IPC;v_i_a_IPC;Region',
            '0;NIVEL GENERAL;Nivel general y divisiones COICOP;202609;12523,1733;2;33,5;GBA',
            '0;NIVEL GENERAL;Nivel general y divisiones COICOP;202608;12280,1;1,7;33,5;Nacional',
            '0;NIVEL GENERAL;Nivel general y divisiones COICOP;202609;12514,1508;1,9;33,4;Nacional',
            '01;Alimentos y bebidas no alcohólicas;Nivel general y divisiones COICOP;202609;13384,1945;2;35,1;Nacional',
            'Núcleo;;Categorias;202608;12441,1;1,8;31,6;Nacional',
            'Núcleo;;Categorias;202609;12654,4322;1,7;31,6;Nacional',
            'Regulados;;Categorias;202609;13238,1788;2,3;43,3;Nacional',
        ].join('\r\n');

        expect(parseIndecIpcCsv(csv)).toEqual([
            { fecha: '2026-08-01', ipc_indec: 1.7, ipc_nucleo_indec: 1.8 },
            { fecha: '2026-09-01', ipc_indec: 1.9, ipc_nucleo_indec: 1.7 },
        ]);
    });
});

describe('parseIndecIpcPressRelease', () => {
    it('extracts the month, general and core variation from the INDEC press release text', () => {
        const text = `Resumen ejecutivo. Septiembre de 2026
El nivel general del Índice de precios al consumidor registró un alza mensual de 1,9% en septiembre
de 2026 y acumuló en el año una variación de 23,6%.
A nivel de las categorías, los precios del IPC Núcleo (1,7%) tuvieron subas vinculadas a Comidas`;

        expect(parseIndecIpcPressRelease(text)).toEqual([{ fecha: '2026-09-01', ipc_indec: 1.9, ipc_nucleo_indec: 1.7 }]);
    });

    it('returns no rows when the text has no monthly variation', () => {
        expect(parseIndecIpcPressRelease('Página no encontrada')).toEqual([]);
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

    it('extracts IPC when general and core move together', () => {
        const xml = `
            <item>
                <title>IPC mensual junio 2025</title>
                <content:encoded><![CDATA[<p>En jun-25 tanto el IPC Nivel General como el IPC Núcleo subieron 2,0%.</p>]]></content:encoded>
            </item>
        `;
        const result = parseEquilibraRssItem(xml);
        expect(result).not.toBeNull();
        expect(result?.fecha).toBe('2025-06-01');
        expect(result?.ipc_equilibra).toBe(2.0);
    });

    it('extracts IPC from alza del IPC Nacional phrasing', () => {
        const xml = `
            <item>
                <title>IPC mensual noviembre 2024</title>
                <content:encoded><![CDATA[<p>Para noviembre 2024, nuestras estimaciones de precios arrojan un alza de 2,7% del IPC Nacional tanto para el Nivel General como el componente Núcleo.</p>]]></content:encoded>
            </item>
        `;
        const result = parseEquilibraRssItem(xml);
        expect(result).not.toBeNull();
        expect(result?.fecha).toBe('2024-11-01');
        expect(result?.ipc_equilibra).toBe(2.7);
    });

    it('extracts IPC when month name appears between inflacion nacional and value', () => {
        const xml = `
            <item>
                <title>IPC mensual junio 2026</title>
                <content:encoded><![CDATA[<p>Según nuestros relevamientos de precios, la inflación nacional de junio fue 1,9%, descendiendo 0,2 p.p. vs mayo.</p>]]></content:encoded>
            </item>
        `;
        const result = parseEquilibraRssItem(xml);
        expect(result).not.toBeNull();
        expect(result?.fecha).toBe('2026-06-01');
        expect(result?.ipc_equilibra).toBe(1.9);
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
