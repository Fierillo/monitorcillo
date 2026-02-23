const XLSX = require('xlsx');

function inspectExcel(filePath) {
    const workbook = XLSX.readFile(filePath);
    console.log(`File: ${filePath}`);
    console.log(`Sheets: ${workbook.SheetNames.join(', ')}`);

    workbook.SheetNames.slice(0, 3).forEach(sheetName => {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        console.log(`\n--- Sheet: ${sheetName} ---`);
        data.slice(0, 10).forEach(row => console.log(JSON.stringify(row)));
    });
}

inspectExcel('/tmp/series.xlsm');
inspectExcel('/tmp/serieanual.xls');
