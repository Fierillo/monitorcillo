import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { fetchIcgCalendarSchedule, icgNextPublicationFromSchedule, icgPublicationDateFromSchedule, parseIcgCalendarImageUrl, parseIcgDiffusionSchedule, readIcgCalendarImageText, decodeUtdtPageHtml } from '../lib/icg-schedule';

describe('ICG UTDT diffusion calendar', () => {
    it('parses publication dates from a cronograma table', () => {
        const text = `
            Cronograma de difusión ICG 2027
            MES DÍA
            ENERO LUNES 25
            FEBRERO LUNES 22
            MARZO MARTES 23
        `;

        expect(parseIcgDiffusionSchedule(text)).toEqual([
            { period: '2027-01-01', publishedOn: '2027-01-25' },
            { period: '2027-02-01', publishedOn: '2027-02-22' },
            { period: '2027-03-01', publishedOn: '2027-03-23' },
        ]);
    });

    it('maps twelve day-column rows onto the calendar months of that year', () => {
        const text = `
            Cronograma de difusión ICG 2026
            LUNES 26
            LUNES 23
            LUNES 23
            LUNES 27
            LUNES 25
            LUNES 22
            LUNES 27
            LUNES 24
            LUNES 28
            LUNES 26
            LUNES 23
            LUNES 28
        `;
        expect(parseIcgDiffusionSchedule(text)).toEqual([
            { period: '2026-01-01', publishedOn: '2026-01-26' },
            { period: '2026-02-01', publishedOn: '2026-02-23' },
            { period: '2026-03-01', publishedOn: '2026-03-23' },
            { period: '2026-04-01', publishedOn: '2026-04-27' },
            { period: '2026-05-01', publishedOn: '2026-05-25' },
            { period: '2026-06-01', publishedOn: '2026-06-22' },
            { period: '2026-07-01', publishedOn: '2026-07-27' },
            { period: '2026-08-01', publishedOn: '2026-08-24' },
            { period: '2026-09-01', publishedOn: '2026-09-28' },
            { period: '2026-10-01', publishedOn: '2026-10-26' },
            { period: '2026-11-01', publishedOn: '2026-11-23' },
            { period: '2026-12-01', publishedOn: '2026-12-28' },
        ]);
    });

    it('prefers a complete weekday column over a partial month-name parse', () => {
        const text = `
            Cronograma de difusión ICG 2026
            ENERO LUNES 26
            LUNES 26
            LUNES 23
            LUNES 23
            LUNES 27
            LUNES 25
            LUNES 22
            LUNES 27
            LUNES 24
            LUNES 28
            LUNES 26
            LUNES 23
            LUNES 28
        `;
        expect(parseIcgDiffusionSchedule(text)[1]).toEqual({ period: '2026-02-01', publishedOn: '2026-02-23' });
        expect(parseIcgDiffusionSchedule(text)).toHaveLength(12);
    });

    it('dates a release from the cronograma row of that observation month', () => {
        const schedule = parseIcgDiffusionSchedule(`
            Cronograma de difusión ICG 2027
            ENERO LUNES 25
            FEBRERO LUNES 22
        `);
        expect(icgPublicationDateFromSchedule(schedule, '2027-02-01')).toBe('2027-02-22');
    });

    it('picks the next cronograma date after today', () => {
        const schedule = parseIcgDiffusionSchedule(`
            Cronograma de difusión ICG 2027
            ENERO LUNES 25
            FEBRERO LUNES 22
            MARZO MARTES 23
        `);
        expect(icgNextPublicationFromSchedule(schedule, '2027-02-10')).toBe('2027-02-22');
        expect(icgNextPublicationFromSchedule(schedule, '2027-02-22')).toBe('2027-03-23');
    });

    it('finds the cronograma image on the UTDT calendar page', () => {
        const html = `
            <h2>Cronograma de difusión 2027</h2>
            <img src="https://www.utdt.edu/imagen/_111.png" class="">
        `;
        expect(parseIcgCalendarImageUrl(html)).toBe('https://www.utdt.edu/imagen/_111.png');
    });

    it('decodes UTDT calendar html as latin1 so the cronograma image is found', () => {
        const buffer = Buffer.from(
            '<h2>Cronograma de difusi\xF3n 2026</h2><img src="https://www.utdt.edu/imagen/_111.png">',
            'latin1',
        );
        expect(parseIcgCalendarImageUrl(decodeUtdtPageHtml(buffer))).toBe('https://www.utdt.edu/imagen/_111.png');
    });

    it('loads the cronograma from the calendar page image', async () => {
        const html = `
            <h2>Cronograma de difusión 2027</h2>
            <img src="https://www.utdt.edu/imagen/_111.png">
        `;
        const schedule = await fetchIcgCalendarSchedule({
            fetchPage: async () => html,
            fetchImage: async (url) => {
                expect(url).toBe('https://www.utdt.edu/imagen/_111.png');
                return Buffer.from('image');
            },
            readImageText: async (buffer) => {
                expect(buffer.toString()).toBe('image');
                return 'Cronograma de difusión ICG 2027\nENERO LUNES 25\nFEBRERO LUNES 22';
            },
        });
        expect(schedule).toEqual([
            { period: '2027-01-01', publishedOn: '2027-01-25' },
            { period: '2027-02-01', publishedOn: '2027-02-22' },
        ]);
    });

    it('uses the page heading year when the image text has only month rows', async () => {
        const schedule = await fetchIcgCalendarSchedule({
            fetchPage: async () => `
                <h2>Cronograma de difusión 2027</h2>
                <img src="https://www.utdt.edu/imagen/_111.png">
            `,
            fetchImage: async () => Buffer.from('image'),
            readImageText: async () => 'ENERO LUNES 25\nFEBRERO LUNES 22',
        });
        expect(schedule).toEqual([
            { period: '2027-01-01', publishedOn: '2027-01-25' },
            { period: '2027-02-01', publishedOn: '2027-02-22' },
        ]);
    });

    it('reads publication rows from a cronograma table image', async () => {
        const buffer = readFileSync(join(process.cwd(), 'src/tests/fixtures/icg-cronograma-format.png'));
        const text = await readIcgCalendarImageText(buffer);
        expect(parseIcgDiffusionSchedule(`Cronograma de difusión ICG 2027\n${text}`)).toEqual([
            { period: '2027-01-01', publishedOn: '2027-01-25' },
            { period: '2027-02-01', publishedOn: '2027-02-22' },
            { period: '2027-03-01', publishedOn: '2027-03-23' },
        ]);
    });
});
