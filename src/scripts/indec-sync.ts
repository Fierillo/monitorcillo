import fs from 'fs/promises';
import path from 'path';
import * as cheerio from 'cheerio';

interface Indicator {
    id: string;
    fecha: string;
    fuente: string;
    indicador: string;
    referencia: string;
    dato: string;
    trend?: 'up' | 'down' | 'neutral';
    hasDetails?: boolean;
    category?: string;
    sourceUrl?: string;
}

const CATALOG_DIR = path.join(process.cwd(), 'src', 'data', 'catalog');

async function syncIndecDates() {
    try {
        const indicatorsPath = path.join(CATALOG_DIR, 'indicators.json');
        const content = await fs.readFile(indicatorsPath, 'utf-8');
        const indicators: Indicator[] = JSON.parse(content);
        
        let updated = false;

        const monthsMap: Record<string, string> = {
            '01': 'ENE', '02': 'FEB', '03': 'MAR', '04': 'ABR', '05': 'MAY', '06': 'JUN',
            '07': 'JUL', '08': 'AGO', '09': 'SEPT', '10': 'OCT', '11': 'NOV', '12': 'DIC'
        };

        for (const indicator of indicators) {
            if (indicator.fuente === 'INDEC' && indicator.sourceUrl) {
                const internalUrl = indicator.sourceUrl.replace('/indec/web/', '/').replace(/-/g, '/');
                
                console.log(`Fetching data for ${indicator.id} from ${internalUrl}...`);
                
                try {
                    const response = await fetch(internalUrl);
                    if (!response.ok) {
                        console.error(`Failed to fetch ${internalUrl}: ${response.status} ${response.statusText}`);
                        continue;
                    }
                    
                    const html = await response.text();
                    const $ = cheerio.load(html);
                    
                    let newDate = '';
                    const titleText = $('.card-titulo3').first().text();
                    const dateMatch = titleText.match(/^(\d{2})\/(\d{2})\/(\d{2})\./);
                    
                    if (dateMatch) {
                        const day = parseInt(dateMatch[1]).toString();
                        const monthNum = dateMatch[2];
                        const yearShort = dateMatch[3];
                        const monthName = monthsMap[monthNum];
                        
                        if (monthName) {
                            newDate = `${day} ${monthName} ${yearShort}`;
                        }
                    } else {
                        const text = $('.card-texto3').text();
                        const textMatch = text.match(/En\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(\d{4})/i);
                        
                        if (textMatch) {
                            const month = textMatch[1].substring(0, 3).toUpperCase();
                            const monthCased = month === 'SEP' ? 'SEPT' : month;
                            const year = textMatch[2].slice(-2);
                            newDate = `${monthCased} ${year}`;
                        }
                    }

                    if (newDate && newDate !== indicator.fecha) {
                        console.log(`Updating ${indicator.id} date: ${indicator.fecha} -> ${newDate}`);
                        indicator.fecha = newDate;
                        updated = true;
                    } else if (newDate) {
                        console.log(`${indicator.id} is up to date (${newDate}).`);
                    } else {
                        console.log(`Could not find date pattern for ${indicator.id} in ${titleText.substring(0, 50)}...`);
                    }

                } catch (err) {
                    console.error(`Error fetching/parsing ${indicator.sourceUrl}:`, err);
                }
            }
        }

        if (updated) {
            await fs.writeFile(indicatorsPath, JSON.stringify(indicators, null, 2));
            console.log('Indicators catalog updated successfully.');
        } else {
            console.log('No updates needed.');
        }

    } catch (err) {
        console.error('Fatal error in sync process:', err);
    }
}

syncIndecDates();
