const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

function excelDateToISO(serial) {
    if (typeof serial === 'string') return serial;
    const date = new Date((serial - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0];
}

function processOtros() {
    const wb = XLSX.readFile('/tmp/series.xlsm');
    const ws = wb.Sheets['INSTRUMENTOS DEL BCRA'];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

    const monthlyData = {}; // month -> { sum: 0, count: 0 }

    data.forEach(row => {
        const dateRaw = row[0];
        const valor = row[3];

        if (typeof dateRaw === 'number' && typeof valor === 'number') {
            const date = excelDateToISO(dateRaw);
            const month = date.slice(0, 7);
            if (!monthlyData[month]) monthlyData[month] = { sum: 0, count: 0 };
            monthlyData[month].sum += valor;
            monthlyData[month].count += 1;
        }
    });

    const result = {};
    for (const month in monthlyData) {
        result[month] = monthlyData[month].sum / monthlyData[month].count;
    }
    return result;
}

function processTesoro() {
    const wb = XLSX.readFile('/tmp/serieanual.xls');
    const sheets = wb.SheetNames.filter(n => n.toLowerCase().includes('serie semanal'));
    const result = {}; // month -> last_valor (or avg?)

    // User wants "ULTIMOS datos" to be updated. I'll take all available weekly data and for each month I'll take the last one.
    const allData = [];

    sheets.forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let dateRow = null;
        let targetRow = null;

        data.forEach((row, i) => {
            if (row && row.some(cell => typeof cell === 'number' && cell > 40000 && cell < 50000)) {
                if (!dateRow) dateRow = row;
            }
            if (row && row[0] && row[0].toString().includes('DEPOSITOS DEL GOBIERNO NACIONAL Y OTROS')) {
                targetRow = row;
            }
        });

        if (dateRow && targetRow) {
            for (let j = 1; j < targetRow.length; j++) {
                const dateRaw = dateRow[j];
                const valor = targetRow[j];
                if (typeof dateRaw === 'number' && typeof valor === 'number') {
                    const iso = excelDateToISO(dateRaw);
                    if (iso && iso.startsWith('20')) { // Only since year 2000
                        allData.push({
                            fecha: iso,
                            valor: valor / 1000 // Convert thousands to millions (API unit)
                        });
                    }
                }
            }
        }
    });

    // Sort and take last value per month
    allData.sort((a, b) => a.fecha.localeCompare(b.fecha));
    allData.forEach(d => {
        const month = d.fecha.slice(0, 7);
        result[month] = d.valor;
    });

    return result;
}

try {
    const otros = processOtros();
    const tesoro = processTesoro();

    const overrides = { otros, tesoro };
    fs.writeFileSync(path.join(__dirname, '../src/data/overrides/bcra.json'), JSON.stringify(overrides, null, 2));
    console.log('Successfully generated src/data/overrides/bcra.json');
} catch (error) {
    console.error('Error processing Excel files:', error);
    process.exit(1);
}
