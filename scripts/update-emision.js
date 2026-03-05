const https = require('https');
const fs = require('fs').promises;
const path = require('path');

async function fetchBcraVariable(idVariable, from, to) {
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${idVariable}?Desde=${from}&Hasta=${to}`;
    
    return new Promise((resolve) => {
        const agent = new https.Agent({ rejectUnauthorized: false });
        
        https.get(url, { agent }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.results && parsed.results[0] ? parsed.results[0].detalle || [] : []);
                    } catch (e) {
                        resolve([]);
                    }
                } else {
                    console.error(`BCRA API returned ${res.statusCode}`);
                    resolve([]);
                }
            });
        }).on('error', (err) => {
            console.error(`Error fetching BCRA var ${idVariable}:`, err);
            resolve([]);
        });
    });
}

async function updateEmisionData() {
    console.log('Updating emision data (hybrid mode)...\n');
    
    // Cargar datos existentes
    const cachePath = path.join(process.cwd(), 'src', 'data', 'cache', 'emision.json');
    let existingData = [];
    try {
        const existing = await fs.readFile(cachePath, 'utf-8');
        const parsed = JSON.parse(existing);
        existingData = parsed.data || [];
        console.log(`Loaded ${existingData.length} existing records`);
    } catch (e) {
        console.log('No existing data found, starting fresh');
    }
    
    // Crear mapa de datos manuales existentes (Licitaciones y Resultado fiscal)
    const manualData = new Map();
    existingData.forEach(d => {
        manualData.set(d.fecha, {
            Licitaciones: d.Licitaciones || 0,
            'Resultado fiscal': d['Resultado fiscal'] || 0
        });
    });
    
    // Fetch datos del BCRA
    const toDate = new Date().toISOString().split('T')[0];
    const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    console.log(`Fetching BCRA data from ${fromDate} to ${toDate}...`);
    const bcraData = await fetchBcraVariable(78, fromDate, toDate);
    console.log(`Fetched ${bcraData.length} BCRA records\n`);
    
    // Combinar datos: BCRA (API) + Licitaciones/Resultado fiscal (manuales)
    const emisionData = bcraData.map((d) => {
        const fecha = formatDate(d.fecha);
        const manual = manualData.get(fecha) || { Licitaciones: 0, 'Resultado fiscal': 0 };
        const BCRA = Math.round((d.valor || 0) * 1000000); // Convertir a pesos
        
        return {
            fecha,
            BCRA,
            Licitaciones: manual.Licitaciones,
            'Resultado fiscal': manual['Resultado fiscal'],
            TOTAL: BCRA + manual.Licitaciones + manual['Resultado fiscal']
        };
    });
    
    // Agregar días manuales que no estén en la API (futuros o días faltantes)
    existingData.forEach(d => {
        if (!emisionData.find(e => e.fecha === d.fecha)) {
            emisionData.push({
                fecha: d.fecha,
                BCRA: d.BCRA || 0,
                Licitaciones: d.Licitaciones || 0,
                'Resultado fiscal': d['Resultado fiscal'] || 0,
                TOTAL: (d.BCRA || 0) + (d.Licitaciones || 0) + (d['Resultado fiscal'] || 0)
            });
        }
    });
    
    // Ordenar cronológicamente
    emisionData.sort((a, b) => parseDate(a.fecha) - parseDate(b.fecha));
    
    // Guardar
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(
        cachePath,
        JSON.stringify({
            lastUpdate: new Date().toISOString(),
            data: emisionData
        }, null, 2)
    );
    
    console.log(`Saved ${emisionData.length} total records`);
    console.log('\nLast 3 records:');
    emisionData.slice(-3).forEach(d => {
        console.log(`  ${d.fecha}: BCRA=${d.BCRA.toLocaleString()}, Licitaciones=${d.Licitaciones.toLocaleString()}, Fiscal=${d['Resultado fiscal'].toLocaleString()}, TOTAL=${d.TOTAL.toLocaleString()}`);
    });
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    const day = date.getDate();
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
    const month = months[date.getMonth()];
    return `${day}-${month}`;
}

function parseDate(fechaStr) {
    const [day, monthStr] = fechaStr.split('-');
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
    const month = months.indexOf(monthStr);
    const year = new Date().getFullYear();
    return new Date(year, month, parseInt(day));
}

updateEmisionData().catch(console.error);
