import { describe, expect, it } from 'vitest';
import {
    composeUtdtNowcastRows,
    overlayIndecOnNowcast,
    parseLatestUtdtNowcastRow,
    parsePovertyRateFromPdfText,
    parseUcaEdsaPovertyRows,
    parseUcaPovertyItemUrl,
    parseUcaPovertyPdfUrl,
    parseUtdtChartImageUrl,
    parseUtdtPeriodPdfLinks,
    parseUtdtShinyRows,
    parseUtdtShinyWorkerId,
    utdtShinyTracesIncludeProjection,
} from '../lib/pobreza-source';

describe('pobreza UTDT source parsing', () => {
    it('finds the current nowcast chart image in the page (png or webp)', () => {
        const html = '<p>El siguiente gráfico describe la evolución</p><img src="/imagen/_177879597705772700.webp" class="">';
        expect(parseUtdtChartImageUrl(html)).toBe('https://www.utdt.edu/imagen/_177879597705772700.webp');
    });

    it('extracts the latest nowcast from HTML text', () => {
        const html = 'El nowcast estima una tasa de pobreza de 29.2% para el semestre Nov25Abr26 con un intervalo';
        expect(parseLatestUtdtNowcastRow(html)).toEqual({ fecha: '2026-04-01', pobreza_utdt: 29.2 });
    });

    it('parses the monthly PDF archive links from the UTDT page', () => {
        const html = `
            <a href="/download.php?fname=_178423269927738400.pdf">Ene26Jun26</a>
            <a href="/download.php?fname=_178163550204131300.pdf">Dic25May26</a>
            <a href="/download.php?fname=_177879604483823000.pdf">Nov25Abr26</a>
            <a href="/download.php?fname=_173524235834907300.pdf">Informe completo aquí</a>
        `;

        expect(parseUtdtPeriodPdfLinks(html)).toEqual([
            { period: 'Ene26Jun26', url: 'https://www.utdt.edu/download.php?fname=_178423269927738400.pdf' },
            { period: 'Dic25May26', url: 'https://www.utdt.edu/download.php?fname=_178163550204131300.pdf' },
            { period: 'Nov25Abr26', url: 'https://www.utdt.edu/download.php?fname=_177879604483823000.pdf' },
        ]);
    });

    it('extracts the poverty rate from UTDT PDF text', () => {
        const text = `
            RESULTADOS
            Semestre Enero 2026 - Junio 2026
            El nowcast estima una tasa de pobreza de 31.6 por ciento para el primer semestre calendario de 2026
            con un intervalo del 95 por ciento de confianza entre [30.1%, 33.0%].
        `;
        expect(parsePovertyRateFromPdfText(text)).toBe(31.6);
    });

    it('extracts the current series from the UTDT Shiny traces', () => {
        expect(parseUtdtShinyRows([
            {
                name: 'oficial',
                y: [28.2],
                text: ['Tasa de pobreza: 28.2 <br>Semestre : Jul25Dic25'],
            },
            {
                name: 'serie',
                y: [31],
                text: ['Semestre : Jun25Nov25'],
            },
            {
                name: 'proy',
                y: [28.9, 29.4, 30, 30.3, 30.6, 31.6],
                text: [
                    'Semestre : Ago25Ene26',
                    'Semestre : Sep25Feb26',
                    'Semestre : Oct25Mar26',
                    'Semestre : Nov25Abr26',
                    'Semestre : Dic25May26',
                    'Semestre : Ene26Jun26',
                ],
            },
            { name: 'confidence-band', y: [20], text: ['Semestre : Ene26Jun26'] },
        ])).toEqual([
            { fecha: '2025-11-01', pobreza_utdt: 31 },
            { fecha: '2025-12-01', pobreza_utdt: 28.2 },
            { fecha: '2026-01-01', pobreza_utdt: 28.9 },
            { fecha: '2026-02-01', pobreza_utdt: 29.4 },
            { fecha: '2026-03-01', pobreza_utdt: 30 },
            { fecha: '2026-04-01', pobreza_utdt: 30.3 },
            { fecha: '2026-05-01', pobreza_utdt: 30.6 },
            { fecha: '2026-06-01', pobreza_utdt: 31.6 },
        ]);
    });

    it('lets the current projection overwrite overlapping EPH series points', () => {
        expect(parseUtdtShinyRows([
            {
                name: 'proy',
                y: [28.7],
                text: ['Semestre : Ago25Ene26'],
            },
            {
                name: 'serie',
                y: [30.2],
                text: ['Semestre : Ago25Ene26'],
            },
        ])).toEqual([{ fecha: '2026-01-01', pobreza_utdt: 28.7 }]);
    });

    it('detects when the Shiny graph includes the current projection', () => {
        expect(utdtShinyTracesIncludeProjection([{ name: 'oficial', y: [28.2] }])).toBe(false);
        expect(utdtShinyTracesIncludeProjection([{ name: 'proy', y: [31.3] }])).toBe(true);
    });

    it('replaces a leftover nowcast at the INDEC semester-end month with the official rate', () => {
        expect(overlayIndecOnNowcast([
            { fecha: '2025-12-01', pobreza_utdt: 30.6 },
            { fecha: '2026-01-01', pobreza_indec: 28.2, pobreza_utdt: 28.7 },
        ])).toEqual([
            { fecha: '2025-12-01', pobreza_utdt: 28.2 },
            { fecha: '2026-01-01', pobreza_indec: 28.2, pobreza_utdt: 28.7 },
        ]);
    });

    it('overlays the latest PDF and page headline on the current Shiny series', () => {
        expect(composeUtdtNowcastRows({
            shiny: [
                { fecha: '2026-01-01', pobreza_utdt: 28.7 },
                { fecha: '2026-08-01', pobreza_utdt: 31.1 },
            ],
            pdf: [{ fecha: '2026-08-01', pobreza_utdt: 31.3 }],
            latest: { fecha: '2026-08-01', pobreza_utdt: 31.3 },
        })).toEqual([
            { fecha: '2026-01-01', pobreza_utdt: 28.7 },
            { fecha: '2026-08-01', pobreza_utdt: 31.3 },
        ]);
    });

    it('extracts the worker ID from the UTDT Shiny bootstrap response', () => {
        expect(parseUtdtShinyWorkerId('{"config":{"workerId":"abc123"}}')).toBe('abc123');
        expect(parseUtdtShinyWorkerId('invalid')).toBeNull();
    });
});

describe('pobreza UCA EDSA source parsing', () => {
    it('picks the first repository search hit that matches the EDSA poverty document family', () => {
        const html = `
            <tr><td headers="t3"><a href="/handle/1/10">Informe metodológico ODSA</a></td></tr>
            <tr>
              <td headers="t3">
                <a href="/handle/1/20">Condiciones&#x20;materiales&#x20;de&#x20;vida&#x20;de&#x20;los&#x20;hogares&#x20;y&#x20;la&#x20;población&#x20;(2010-2017)</a>
              </td>
            </tr>
            <tr>
              <td headers="t3">
                <a href="/handle/1/30">Condiciones materiales de vida de los hogares y la población (2010-2016)</a>
              </td>
            </tr>
        `;

        expect(parseUcaPovertyItemUrl(html)).toBe('https://repositorio.uca.edu.ar/handle/1/20');
    });

    it('prefers the repository bitstream PDF over other PDF links on the item page', () => {
        const html = `
            <a href="/static/guide.pdf">Guía</a>
            <a href="/bitstream/1/20/1/serie.pdf">serie.pdf</a>
            <a href="/handle/1/20">Ítem</a>
        `;

        expect(parseUcaPovertyPdfUrl(html)).toBe('https://repositorio.uca.edu.ar/bitstream/1/20/1/serie.pdf');
    });

    it('takes the people-poverty TOTALES nearest to Figura 2.4, not an earlier table', () => {
        const text = `
TOTALES
Estadístico10,111,112,113,114,115,116,117,1
Años 2000-2007. En porcentaje de población.
TOTALES
Límite inferior19,019,119,219,319,419,519,619,7
Estadístico20,120,220,320,420,520,620,720,8
Límite superior21,021,121,221,321,421,521,621,7
Figura 2.4
Personas en hogares en situación de pobreza
`;
        expect(parseUcaEdsaPovertyRows(text)).toEqual([
            { fecha: '2000-09-01', pobreza_uca: 20.1 },
            { fecha: '2001-09-01', pobreza_uca: 20.2 },
            { fecha: '2002-09-01', pobreza_uca: 20.3 },
            { fecha: '2003-09-01', pobreza_uca: 20.4 },
            { fecha: '2004-09-01', pobreza_uca: 20.5 },
            { fecha: '2005-09-01', pobreza_uca: 20.6 },
            { fecha: '2006-09-01', pobreza_uca: 20.7 },
            { fecha: '2007-09-01', pobreza_uca: 20.8 },
        ]);
    });

    it('keeps only the estadístico values when the confidence band is concatenated', () => {
        const text = `
Años 2000-2007. En porcentaje de población.
TOTALES
Estadístico Límite superior 20,1 20,2 20,3 20,4 20,5 20,6 20,7 20,8 30,1 30,2 30,3 30,4 30,5 30,6 30,7 30,8
Figura 2.4
Personas en hogares en situación de pobreza
`;
        expect(parseUcaEdsaPovertyRows(text)).toEqual([
            { fecha: '2000-09-01', pobreza_uca: 20.1 },
            { fecha: '2001-09-01', pobreza_uca: 20.2 },
            { fecha: '2002-09-01', pobreza_uca: 20.3 },
            { fecha: '2003-09-01', pobreza_uca: 20.4 },
            { fecha: '2004-09-01', pobreza_uca: 20.5 },
            { fecha: '2005-09-01', pobreza_uca: 20.6 },
            { fecha: '2006-09-01', pobreza_uca: 20.7 },
            { fecha: '2007-09-01', pobreza_uca: 20.8 },
        ]);
    });
});
