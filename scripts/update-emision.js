const https = require('https');
const fs = require('fs').promises;
const path = require('path');

const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEPT', 'OCT', 'NOV', 'DIC'];
const MONTHS_IDX = { ENE: 0, FEB: 1, MAR: 2, ABR: 3, MAY: 4, JUN: 5, JUL: 6, AGO: 7, SEPT: 8, OCT: 9, NOV: 10, DIC: 11 };

function isoToFecha(dateStr) {
    const d = new Date(dateStr + 'T12:00:00Z');
    return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}`;
}

function fechaToTimestamp(fecha) {
    const parts = fecha.split(' ');
    return new Date(2000 + parseInt(parts[2]), MONTHS_IDX[parts[1]], parseInt(parts[0])).getTime();
}

async function fetchBcraVariable(idVariable, from, to) {
    const url = `https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias/${idVariable}?Desde=${from}&Hasta=${to}`;

    return new Promise((resolve) => {
        const agent = new https.Agent({ rejectUnauthorized: false });
        https.get(url, { agent }, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        const parsed = JSON.parse(data);
                        resolve(parsed.results?.[0]?.detalle || []);
                    } catch {
                        resolve([]);
                    }
                } else {
                    console.error(`BCRA API returned ${res.statusCode} for var ${idVariable}`);
                    resolve([]);
                }
            });
        }).on('error', (err) => {
            console.error(`Error fetching var ${idVariable}:`, err.message);
            resolve([]);
        });
    });
}

async function updateEmisionData() {
    const dbPath = path.join(process.cwd(), 'src', 'data', 'db', 'emision.json');

    let existingData = [];
    try {
        const existing = await fs.readFile(dbPath, 'utf-8');
        existingData = JSON.parse(existing).data || [];
        console.log(`Loaded ${existingData.length} existing records`);
    } catch {
        console.log('No existing data found');
    }

    const existingByFecha = new Map(existingData.map(d => [d.fecha, d]));

    const lastFecha = existingData.length ? existingData[existingData.length - 1].fecha : null;
    const lastDateISO = lastFecha
        ? (() => {
            const parts = lastFecha.split(' ');
            return `20${parts[2]}-${String(MONTHS_IDX[parts[1]] + 1).padStart(2, '0')}-${String(parts[0]).padStart(2, '0')}`;
        })()
        : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const toDate = new Date().toISOString().split('T')[0];

    console.log(`Fetching BCRA data from ${lastDateISO} to ${toDate}...`);
    const [compraData, tcData] = await Promise.all([
        fetchBcraVariable(78, lastDateISO, toDate),
        fetchBcraVariable(4, lastDateISO, toDate),
    ]);

    console.log(`Fetched ${compraData.length} compra records, ${tcData.length} TC records`);

    const tcByFecha = new Map(tcData.map(d => [d.fecha, d.valor]));

    let appended = 0;
    for (const d of compraData) {
        const fecha = isoToFecha(d.fecha);
        if (existingByFecha.has(fecha)) continue;

        const tc = tcByFecha.get(d.fecha) ?? 0;
        const compraDolares = d.valor ?? 0;
        const BCRA = compraDolares * tc;
        const manual = { Licitaciones: 0, 'Resultado fiscal': 0, Vencimientos: 0, Licitado: 0 };

        existingByFecha.set(fecha, {
            fecha,
            CompraDolares: compraDolares,
            TC: tc,
            BCRA,
            Vencimientos: manual.Vencimientos,
            Licitado: manual.Licitado,
            Licitaciones: manual.Licitaciones,
            'Resultado fiscal': manual['Resultado fiscal'],
            TOTAL: BCRA + manual.Licitaciones + manual['Resultado fiscal'],
        });
        appended++;
    }

    if (appended === 0) {
        console.log('No new records to append.');
        return;
    }

    const merged = Array.from(existingByFecha.values())
        .sort((a, b) => fechaToTimestamp(a.fecha) - fechaToTimestamp(b.fecha));

    await fs.writeFile(dbPath, JSON.stringify({ lastUpdate: new Date().toISOString(), data: merged }, null, 2));

    console.log(`\nAppended ${appended} new records (${merged.length} total)`);
    console.log('Last 3 records:');
    merged.slice(-3).forEach(d => {
        console.log(`  ${d.fecha}: BCRA=${Math.round(d.BCRA).toLocaleString()}, TC=${d.TC}, Compra=${d.CompraDolares}`);
    });
}

updateEmisionData().catch(console.error);
