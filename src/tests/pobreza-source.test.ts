import { describe, expect, it } from 'vitest';
import { parseUtdtGithubPobrezaRows, parseUtdtPobrezaNowcast } from '../lib/pobreza-source';

describe('pobreza source parsing', () => {
    it('parses the UTDT poverty nowcast and confidence interval', () => {
        const html = 'El nowcast estima una tasa de pobreza de 29.0% para el semestre Oct25Mar26 con un intervalo del 95% de confianza entre [27.5%, 30.4%]. La incidencia proyectada se puede descomponer mecánicamente en un promedio ponderado de una tasa de pobreza de 29.5 por ciento para el cuarto trimestre de 2025 y 28.4 para el primer trimestre de 2026.';

        expect(parseUtdtPobrezaNowcast(html)).toEqual({
            fecha: '2026-01-01',
            pobreza_utdt_proyectada: 29,
            pobreza_utdt_first_quarter: 29.5,
            pobreza_utdt_second_quarter: 28.4,
            pobreza_utdt_proyectada_lower: 27.5,
            pobreza_utdt_proyectada_upper: 30.4,
        });
    });

    it('parses published UTDT quarterly reports from the GitHub page', () => {
        const markdown = '[Informe 2025 Q3](/assets/pdf/reporte_pobreza_q3_2025_final.pdf) [Q4](/assets/pdf/Reporte_pobreza_q4_2025_corregido.pdf) <a href="/download.php?fname=_177092971096373300.pdf">Ago25Ene26</a> <a href="/download.php?fname=_177334930254038900.pdf">Sep25Feb26</a> <a href="/download.php?fname=_177670649308033200.pdf">Oct25Mar26</a>';

        expect(parseUtdtGithubPobrezaRows(markdown)).toEqual([
            { fecha: '2025-07-01', pobreza_utdt: 33.2, pobreza_utdt_lower: 32.5, pobreza_utdt_upper: 33.9 },
            { fecha: '2025-08-01', pobreza_utdt: 33.2, pobreza_utdt_lower: 32.5, pobreza_utdt_upper: 33.9 },
            { fecha: '2025-09-01', pobreza_utdt: 33.2, pobreza_utdt_lower: 32.5, pobreza_utdt_upper: 33.9 },
            { fecha: '2025-10-01', pobreza_utdt: 35.9, pobreza_utdt_lower: 35.2, pobreza_utdt_upper: 36.6 },
            { fecha: '2025-11-01', pobreza_utdt: 35.9, pobreza_utdt_lower: 35.2, pobreza_utdt_upper: 36.6 },
            { fecha: '2025-12-01', pobreza_utdt: 35.9, pobreza_utdt_lower: 35.2, pobreza_utdt_upper: 36.6 },
            { fecha: '2026-01-01', pobreza_utdt_proyectada: 31, pobreza_utdt_proyectada_lower: 28.8, pobreza_utdt_proyectada_upper: 31.7 },
            { fecha: '2026-02-01', pobreza_utdt_proyectada: 28.6, pobreza_utdt_proyectada_lower: 29.2, pobreza_utdt_proyectada_upper: 32.1 },
            { fecha: '2026-03-01', pobreza_utdt_proyectada: 25.6, pobreza_utdt_proyectada_lower: 27.5, pobreza_utdt_proyectada_upper: 30.4 },
        ]);
    });
});
